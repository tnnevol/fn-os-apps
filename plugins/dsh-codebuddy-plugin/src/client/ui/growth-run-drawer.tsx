/**
 * 任务执行日志抽屉。
 *
 * 从管理后台下方滑出的 `SideSheet`，内部是**终端风格**的日志视图。日志内容来自
 * 宿主逐条落盘的 `GrowthRunState.log`（见 `host/growth-run.ts`），因此「执行中逐条
 * 冒出」与「跑完回看」是同一份数据。
 *
 * 三个刻意的选择：
 *  - **抽屉占屏幕下半部分**（`50vh`）：日志是横向长行（时间 + 账号 + 任务 + 状态），
 *    左右抽屉会把每行挤到折行，底部抽屉宽度才够；占一半高度则让上半部分仍能看到面板；
 *  - **上半部分磨砂蒙层**：`maskStyle` 做半透明 + `backdrop-filter: blur`，
 *    被遮住的账号卡片仍然可辨，而不是压成一片死黑；
 *  - **不用 `CodeHighlight`，自己渲染逐行**：Semi 只注册了 Prism core、没有加载任何
 *    语言词法（连 `log` 都没有），且 `CodeHighlight` 只接收纯字符串、无法注入分段
 *    标记——要按「时间/账号/状态」分段上色只能自己渲染。等宽字体与数据侧补齐
 *    （见 `log-presentation.ts`）保证列对齐。
 *
 * @module dsh-codebuddy/ui/growth-run-drawer
 */

import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@nanostores/react'
import { DshSideSheet } from '@tnnevol/dsh-semi-ui'
import type { ConnectionRpc, GrowthRunStateView } from '../rpc.ts'
import { $growthOptimistic, $growthRunning, GROWTH_RUN_POLL_MS, hydrateGrowthRunState, selectGrowthRunView } from '../store/growth-run.ts'
import { growthLogLines } from '../log-presentation.ts'
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

  const lines = useMemo(() => growthLogLines(view?.log), [view?.log])

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
        {/* 终端：深色底、亮色字，按段着色。整块（含滚动条）使用同一底色，
            避免滚动条落在另一种背景上显得「溢出」（见 styles/growth-tasks.scss）。 */}
        <div className="dsh-codebuddy-growth-log-terminal">
          <div className="dsh-codebuddy-growth-log-scroll">
            {lines.length === 0
              ? <p className="dsh-codebuddy-growth-log-empty">{t('growthLogEmpty')}</p>
              : (
                <ol className="dsh-codebuddy-growth-log-lines">
                  {lines.map((line, index) => {
                    /**
                     * 只有**最后一行**且仍在执行时才标成 live。
                     *
                     * 为什么限定最后一行：`running` / `waiting` 是过程标记，一旦后续
                     * 行出现就说明它已经过去了——给历史行加呼吸动画会让整屏一直在闪。
                     */
                    const live = view?.running === true && line.tone === 'info' && index === lines.length - 1
                    return (
                      <li
                        key={`${line.at}-${line.account}-${line.code}-${index}`}
                        className={`dsh-codebuddy-growth-log-line${live ? ' is-live' : ''}`}
                      >
                        <span className="dsh-codebuddy-growth-log-time">{line.time}</span>
                        <span className="dsh-codebuddy-growth-log-account">{line.account}</span>
                        <span className="dsh-codebuddy-growth-log-code">{line.code}</span>
                        <span className={`dsh-codebuddy-growth-log-status is-${line.tone}`}>
                          {live ? <span className="dsh-codebuddy-growth-log-dots" aria-hidden /> : null}
                          {line.status.trim()}
                        </span>
                        {line.message === undefined ? null : <span className="dsh-codebuddy-growth-log-message">{line.message}</span>}
                      </li>
                    )
                  })}
                </ol>
              )}
          </div>
        </div>
      </div>
    </DshSideSheet>
  )
}
