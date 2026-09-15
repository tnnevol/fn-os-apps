/**
 * 任务执行日志抽屉。
 *
 * 方案 A：从管理后台下方滑出的 `SideSheet`，内部用 `CodeHighlight` 展示等宽原始
 * 日志。日志内容来自宿主逐条落盘的 `GrowthRunState.log`（见 `host/growth-run.ts`），
 * 因此「执行中逐条冒出」与「跑完回看」是同一份数据。
 *
 * 四个刻意的选择：
 *  - **抽屉占屏幕下半部分**（`50vh`）：日志是横向长行（时间 + 账号 + 任务 + 状态），
 *    左右抽屉会把每行挤到折行，底部抽屉宽度才够；占一半高度则让上半部分仍能看到面板；
 *  - **上半部分磨砂蒙层**：`maskStyle` 上做半透明 + `backdrop-filter: blur`，
 *    被遮住的账号卡片仍然可辨，而不是压成一片死黑；
 *  - **日志区固定高度、内部滚动**：抽屉本身不整体滚动（标题与状态行始终可见），
 *    只有日志块滚，长日志不会把标题顶出视口；
 *  - **语言传 `log`**：Prism 没有 log 词法，取到空 grammar 会退化为纯文本（不报错），
 *    这正是我们要的——日志本身不需要着色，等宽对齐就够了。
 *
 * @module dsh-codebuddy/ui/growth-run-drawer
 */

import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@nanostores/react'
import { DshCodeHighlight, DshSideSheet } from '@tnnevol/dsh-semi-ui'
import type { ConnectionRpc, GrowthRunStateView } from '../rpc.ts'
import { $growthRunning, GROWTH_RUN_POLL_MS, formatGrowthRunLog, hydrateGrowthRunState } from '../store/growth-run.ts'
import type { Translate } from '../../types/client/panel-types'

/** 抽屉高度：占视口下半部分，上半部分留给面板（配合磨砂蒙层仍可辨认）。 */
const DRAWER_HEIGHT = '50vh'

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
  // 抽屉里的日志取自 store；组件卸载后仍保留最近一轮（宿主也持久化了）。
  const [state, setState] = useState<GrowthRunStateView | undefined>(undefined)

  // 与 store 同步：store 是宿主状态的镜像，这里只做渲染用的快照。
  useEffect(() => { setState(running) }, [running])

  /**
   * 展开期间轮询宿主，让日志逐条追上来。
   *
   * 只在**展开且正在跑**时轮询：关着的时候没必要请求；跑完就停，避免空转。
   * **先立刻拉一次再起定时器**：否则点开抽屉后要干等一个轮询周期才有内容，
   * 那段时间就是用户看到的「准备中」。
   */
  useEffect(() => {
    if (!visible || !running.running) return
    let active = true
    const pull = async (): Promise<void> => {
      const next = await hydrateGrowthRunState(rpc)
      if (active && next !== undefined) setState(next)
    }
    void pull()
    const timer = setInterval(() => { void pull() }, GROWTH_RUN_POLL_MS)
    return () => { active = false; clearInterval(timer) }
  }, [rpc, running.running, visible])

  // 展开时立刻拉一次：覆盖「跑完后再打开回看」的情形（那时不会轮询）。
  useEffect(() => {
    if (!visible) return
    void hydrateGrowthRunState(rpc).then((next) => { if (next !== undefined) setState(next) })
  }, [rpc, visible])

  const text = useMemo(() => formatGrowthRunLog(state?.log), [state?.log])

  return (
    <DshSideSheet
      title={t('growthLogTitle')}
      placement="bottom"
      height={DRAWER_HEIGHT}
      visible={visible}
      onCancel={onClose}
      maskStyle={FROSTED_MASK_STYLE}
      className="dsh-codebuddy-growth-log-sheet"
    >
      <div className="dsh-codebuddy-growth-log-body">
        {/* 状态行常驻：让「正在执行」与日志滚动互不影响。 */}
        {running.running ? <p className="dsh-codebuddy-muted">{t('growthLogRunning')}</p> : null}
        {/* 日志区固定高度 + 内部滚动（见 styles/growth-tasks.scss）。 */}
        <div className="dsh-codebuddy-growth-log-scroll">
          {text.length === 0
            ? <p className="dsh-codebuddy-muted">{t('growthLogEmpty')}</p>
            : <DshCodeHighlight code={text} language="log" lineNumber />}
        </div>
      </div>
    </DshSideSheet>
  )
}
