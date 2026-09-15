/**
 * 任务执行日志抽屉。
 *
 * 从管理后台下方滑出的 `SideSheet`，内部是**终端风格**的虚拟滚动日志。日志内容来自
 * 宿主落盘的 `GrowthRunState`（见 `host/growth-run.ts`），因此「执行中逐条冒出」与
 * 「跑完回看」是同一份数据。
 *
 * 四个刻意的选择：
 *  - **抽屉占屏幕下半部分**（`50vh`）：日志是横向长行（时间 + 账号 + 任务 + 状态），
 *    左右抽屉会把每行挤到折行，底部抽屉宽度才够；占一半高度则让上半部分仍能看到面板；
 *  - **上半部分磨砂蒙层**：`maskStyle` 做半透明 + `backdrop-filter: blur`，
 *    被遮住的账号卡片仍然可辨，而不是压成一片死黑；
 *  - **虚拟滚动用 Semi `Table`**：Semi 只有 `Table` 自带虚拟化（`virtualized`，底层
 *    `react-window`）——`List` / `ScrollList` 都没有，官方文档把 `List` 的虚拟化交给
 *    外部 `react-virtualized`。多账号 × 16 个任务的日志可达数百行，全量渲染会明显卡顿，
 *    所以走 Semi 自己的虚拟化能力，而不是自己写窗口化；
 *  - **按段着色而非代码高亮**：Semi 只注册了 Prism core、没有加载任何语言词法
 *    （连 `log` 都没有），且 `CodeHighlight` 只接收纯字符串、无法注入分段标记——
 *    要按「时间/账号/状态」分段上色只能自己渲染单元格。等宽字体与数据侧补齐
 *    （见 `log-presentation.ts`）保证列对齐。
 *
 * @module dsh-codebuddy/ui/growth-run-drawer
 */

import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@nanostores/react'
import { DshSideSheet, DshTable, DshTabs } from '@tnnevol/dsh-semi-ui'
import type { ConnectionRpc, GrowthRunStateView } from '../rpc.ts'
import { $growthOptimistic, $growthRunning, GROWTH_RUN_POLL_MS, hydrateGrowthRunState, selectGrowthRunView } from '../store/growth-run.ts'
import { growthLogLines } from '../log-presentation.ts'
import type { GrowthLogLine } from '../log-presentation.ts'
import type { Translate } from '../../types/client/panel-types'

/** 抽屉高度：占视口下半部分，上半部分留给面板（配合磨砂蒙层仍可辨认）。 */
const DRAWER_HEIGHT = '50vh'

/**
 * 抽屉的层级。
 *
 * 必须**高于 Semi Modal 的默认 `zIndex: 1000`**：成长任务的单项「完成」按钮在
 * 账号信息弹框里，点它也会打开这个抽屉——两者层级相同的话，后挂载的那层会盖住
 * 另一层（Semi 的 Portal 复用容器，靠挂载顺序决定谁在上，并不稳定）。
 * 取 1010 与仓库里 toast 的层级口径一致。
 */
const DRAWER_Z_INDEX = 1010

/**
 * 单行高度（像素）。
 *
 * 虚拟滚动必须知道行高才能算出可视区间；日志行固定不折行（见 SCSS 的 `white-space: pre`），
 * 所以是常数。12px 等宽字 × 1.6 行高 ≈ 19px，取 24 留出呼吸空间。
 */
const LOG_ROW_HEIGHT = 24

/** 固定列宽度；说明列会按终端实际宽度动态填充。 */
const COLUMN_WIDTH = {
  time: 96,
  account: 180,
  code: 220,
  status: 112,
  message: 520,
} as const

const FIXED_COLUMN_WIDTH = COLUMN_WIDTH.time + COLUMN_WIDTH.account + COLUMN_WIDTH.code + COLUMN_WIDTH.status
/** 终端过窄时仍保留一个可读的最小说明列宽度。 */
const MIN_TABLE_WIDTH = FIXED_COLUMN_WIDTH + COLUMN_WIDTH.message

/**
 * 上半部分蒙层的「磨砂玻璃」样式。
 *
 * 颜色取 DSH 自己的蒙层 token（`--dsw-alias-bg-mask-1`，浅色 `#0000003d`、
 * 暗色 `#00000080`）——**不能**用 Semi 的默认蒙层色：本仓库的主题桥
 * （`packages/dsh-semi-ui/src/theme.scss`）把 `--semi-color-overlay-bg` 映射到
 * `--dsw-alias-bg-base`（不透明的白/黑），直接用会把上半屏压成一片实心，
 * 既不是半透明也看不到下面的账号卡片。
 *
 * `backdrop-filter` 给被遮住的账号卡片留下轮廓，方便对照「哪个号在跑」；
 * `-webkit-` 前缀供 Safari。
 */
const FROSTED_MASK_STYLE: CSSProperties = {
  background: 'var(--dsw-alias-bg-mask-1, rgba(0, 0, 0, 0.24))',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
}

/**
 * 测量一个元素的可用尺寸。
 *
 * 为什么需要它：Semi `Table` 的虚拟化**要求 `scroll.y` 与 `style.width` 都是数字**
 * （见官方文档「虚拟化表格」），不接受 `50vh` 或 `100%` 这类相对值。抽屉高度是
 * `50vh`，只有实测才知道具体像素，所以这里用 `ResizeObserver` 跟随容器尺寸
 * （窗口缩放、抽屉动画结束都会触发）。
 *
 * 没有 `ResizeObserver` 的环境（旧浏览器、测试）退化为「挂载时量一次」，
 * 不抛错——量不到就返回 0，调用方据此退化为不启用虚拟化的普通表格。
 *
 * @param ref - 被测量的容器。
 * @param active - 是否处于需要测量的状态（抽屉未展开时容器尺寸为 0）。
 * @returns 实测宽高（像素）；无法测量时为 `{ width: 0, height: 0 }`。
 */
function useMeasuredSize(ref: { current: HTMLElement | null }, active: boolean): { width: number, height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (!active || element === null) {
      setSize({ width: 0, height: 0 })
      return
    }
    const measure = (): void => {
      setSize({ width: element.clientWidth, height: element.clientHeight })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => { observer.disconnect() }
  }, [ref, active])
  return size
}

/** 一行的渲染数据：展示字段 + 稳定 key + 是否处于进行中。 */
interface LogRow extends GrowthLogLine {
  key: string
  live: boolean
}

/**
 * 把逐行展示数据转成表格行。
 *
 * `key` 用「时间戳-账号-任务-序号」：同一毫秒内同一任务的多次记录（如
 * `执行中` 后紧跟 `等待上游计分`）时间戳可能相同，只靠前三个字段会撞 key。
 *
 * @param lines - `growthLogLines` 的输出。
 * @param running - 该轮是否仍在执行（最后一行才可能是 live）。
 */
function toRows(lines: readonly GrowthLogLine[], running: boolean): LogRow[] {
  return lines.map((line, index) => ({
    ...line,
    key: `${line.at}-${line.account}-${line.code}-${index}`,
    /**
     * 只有**最后一行**且仍在执行时才标成 live。
     *
     * 为什么限定最后一行：`running` / `waiting` 是过程标记，一旦后续行出现就说明
     * 它已经过去了——给历史行加呼吸动画会让整屏一直在闪。
     */
    live: running && line.tone === 'info' && index === lines.length - 1,
  }))
}

/**
 * 任务执行日志抽屉。
 *
 * @param rpc - 连接 RPC。
 * @param t - 翻译函数。
 * @param visible - 是否展开。
 * @param onClose - 关闭回调。
 */
export function GrowthRunDrawer({ rpc, t, visible, onClose }: {
  rpc: ConnectionRpc
  t: Translate
  visible: boolean
  onClose: () => void
}): ReactNode {
  const running = useStore($growthRunning)
  const optimistic = useStore($growthOptimistic)
  // 抽屉里的日志取自 store；组件卸载后仍保留最近一轮（宿主也持久化了）。
  const [state, setState] = useState<GrowthRunStateView | undefined>(undefined)
  /** 当前查看哪一轮：本次（宿主最新）或上次（`previousLog`）。 */
  const [round, setRound] = useState<'current' | 'previous'>('current')

  // 与 store 同步：store 是宿主状态的镜像，这里只做渲染用的快照。
  useEffect(() => { setState(running) }, [running])

  /**
   * 实际渲染用的状态：宿主状态与本地乐观起点的合并结果。
   *
   * 单项执行刚点下时宿主还没落盘，此时显示该任务的具体日志（而不是空态或上一轮
   * 的内容）；宿主一旦写出本轮日志就自动让位。
   */
  const view = useMemo(
    () => selectGrowthRunView(state, optimistic, t('growthLogStarting')),
    [state, optimistic, t],
  )

  /**
   * 展开期间轮询宿主，让日志逐条追上来。
   *
   * 只在**展开且正在跑**时轮询：关着的时候没必要请求；跑完就停，避免空转。
   * **先立刻拉一次再起定时器**：否则点开抽屉后要干等一个轮询周期才有内容，
   * 那段时间就是用户看到的空态。
   */
  useEffect(() => {
    // 本地乐观态下也必须轮询：那时 `running.running` 可能还是 false，但执行已经在路上，
    // 不拉就永远看不到后续日志。乐观记录由 hydrate 在宿主接管后自动清掉。
    if (!visible || (!running.running && optimistic === undefined)) return
    let active = true
    const pull = async (): Promise<void> => {
      const next = await hydrateGrowthRunState(rpc)
      if (active && next !== undefined) setState(next)
    }
    void pull()
    const timer = setInterval(() => { void pull() }, GROWTH_RUN_POLL_MS)
    return () => { active = false; clearInterval(timer) }
  }, [rpc, running.running, optimistic, visible])

  // 展开时立刻拉一次：覆盖「跑完后再打开回看」的情形（那时不会轮询）。
  useEffect(() => {
    if (!visible) return
    void hydrateGrowthRunState(rpc).then((next) => { if (next !== undefined) setState(next) })
  }, [rpc, visible])

  const previousLines = useMemo(() => growthLogLines(view?.previousLog), [view?.previousLog])
  const hasPrevious = previousLines.length > 0
  // 上一轮已经不存在时（新一轮把 previousLog 挤掉）自动回到本次，避免停在空视图。
  useEffect(() => { if (!hasPrevious) setRound('current') }, [hasPrevious])

  const activeLog = round === 'previous' ? view?.previousLog : view?.log
  const rows = useMemo(
    () => toRows(growthLogLines(activeLog), round === 'current' && view?.running === true),
    [activeLog, round, view?.running],
  )

  const terminalRef = useRef<HTMLDivElement | null>(null)
  const { width, height } = useMeasuredSize(terminalRef, visible)
  /**
   * Semi 虚拟化内部会把所有列宽相加作为虚拟行宽，而不是自动拉伸到 wrapper。
   * 因此说明列按实际容器宽度补足，避免宽屏日志右侧出现一整块裸背景。
   */
  const tableWidth = Math.max(MIN_TABLE_WIDTH, width)
  const columns = useMemo(
    () => createLogColumns(Math.max(COLUMN_WIDTH.message, tableWidth - FIXED_COLUMN_WIDTH)),
    [tableWidth],
  )

  return (
    <DshSideSheet
      title={t('growthLogTitle')}
      placement="bottom"
      height={DRAWER_HEIGHT}
      zIndex={DRAWER_Z_INDEX}
      visible={visible}
      onCancel={onClose}
      maskStyle={FROSTED_MASK_STYLE}
      className="dsh-codebuddy-growth-log-sheet"
    >
      <div className="dsh-codebuddy-growth-log-body">
        {/* 状态行常驻：让「正在执行」与日志滚动互不影响。 */}
        {view?.running === true ? <p className="dsh-codebuddy-muted">{t('growthLogRunning')}</p> : null}
        {/* 只保留两轮日志（本次 / 上次），因此这里最多两个页签；没有上一轮时不渲染，
            免得出现一个永远空着的入口。 */}
        {hasPrevious
          ? (
            <DshTabs
              type="button"
              size="small"
              activeKey={round}
              onChange={(key: string) => { setRound(key as 'current' | 'previous') }}
              className="dsh-codebuddy-growth-log-rounds"
            >
              <DshTabs.TabPane itemKey="current" tab={<span className="dsh-codebuddy-resource-tab">{t('growthLogRoundCurrent')}</span>} />
              <DshTabs.TabPane itemKey="previous" tab={<span className="dsh-codebuddy-resource-tab">{t('growthLogRoundPrevious')}</span>} />
            </DshTabs>
          )
          : null}
        {/* 终端：深色底、亮色字，按段着色。整块（含滚动条）使用同一底色，
            避免滚动条落在另一种背景上显得「溢出」（见 styles/growth-tasks.scss）。 */}
        <div className="dsh-codebuddy-growth-log-terminal" ref={terminalRef}>
          {rows.length === 0
            ? <p className="dsh-codebuddy-growth-log-empty">{t('growthLogEmpty')}</p>
            : (
              <DshTable
                className="dsh-codebuddy-growth-log-table"
                columns={columns}
                dataSource={rows}
                rowKey="key"
                pagination={false}
                showHeader={false}
                // 虚拟化必须拿到数字高度与宽度；测量到 0（尚未布局）时退化为普通表格，
                // 保证首帧也有内容，而不是一片空白。
                {...height > 0 && width > 0
                  ? {
                      virtualized: { itemSize: LOG_ROW_HEIGHT },
                      scroll: { y: height, x: tableWidth },
                      style: { width },
                    }
                  : {}}
                onRow={(record: LogRow) => ({
                  className: `dsh-codebuddy-growth-log-line${record.live ? ' is-live' : ''}`,
                })}
              />
            )}
        </div>
      </div>
    </DshSideSheet>
  )
}

/**
 * 列定义工厂放在组件外：Semi `Table` 内部对 `columns`/`dataSource` 做**浅比较**，
 * 每次渲染新建字面量会触发多余的内部更新（官方 FAQ 明确提醒）。
 *
 * 说明列宽由调用方按容器宽度计算，保证虚拟化内部的 row width 与可见区域一致。
 */
function createLogColumns(messageWidth: number) {
  return [
    {
      title: '时间',
      dataIndex: 'time',
      width: COLUMN_WIDTH.time,
      render: (text: string) => <span className="dsh-codebuddy-growth-log-time">{text}</span>,
    },
    {
      title: '账号',
      dataIndex: 'account',
      width: COLUMN_WIDTH.account,
      render: (text: string) => <span className="dsh-codebuddy-growth-log-account">{text}</span>,
    },
    {
      title: '任务',
      dataIndex: 'code',
      width: COLUMN_WIDTH.code,
      render: (text: string) => <span className="dsh-codebuddy-growth-log-code">{text}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: COLUMN_WIDTH.status,
      render: (text: string, record: LogRow) => (
        <span className={`dsh-codebuddy-growth-log-status is-${record.tone}`}>
          {record.live ? <span className="dsh-codebuddy-growth-log-dots" aria-hidden /> : null}
          {text.trim()}
        </span>
      ),
    },
    {
      title: '说明',
      dataIndex: 'message',
      width: messageWidth,
      render: (text: string | undefined) => (
        text === undefined ? null : <span className="dsh-codebuddy-growth-log-message">{text}</span>
      ),
    },
  ]
}
