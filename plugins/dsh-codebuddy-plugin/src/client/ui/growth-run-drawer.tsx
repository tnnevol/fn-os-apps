/**
 * 任务执行日志抽屉。
 *
 * 方案 A：从管理后台下方滑出的 `SideSheet`，内部用 `CodeHighlight` 展示等宽原始
 * 日志。日志内容来自宿主逐条落盘的 `GrowthRunState.log`（见 `host/growth-run.ts`），
 * 因此「执行中逐条冒出」与「跑完回看」是同一份数据。
 *
 * 三个刻意的选择：
 *  - **抽屉而非弹框**：执行要跑几十秒，抽屉贴底、不遮挡面板主体，边跑还能边看任务列表；
 *  - **`placement="bottom"`**：日志是横向长行（时间 + 账号 + 任务 + 状态），
 *    左右抽屉会把每行挤到折行，底部抽屉的宽度才够；
 *  - **语言传 `log`**：Prism 没有 log 词法，取到空 grammar 会退化为纯文本（不报错），
 *    这正是我们要的——日志本身不需要着色，等宽对齐就够了。
 *
 * @module dsh-codebuddy/ui/growth-run-drawer
 */

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@nanostores/react'
import { DshCodeHighlight, DshSideSheet, DshSpin } from '@tnnevol/dsh-semi-ui'
import type { ConnectionRpc, GrowthRunStateView } from '../rpc.ts'
import { $growthRunning, GROWTH_RUN_POLL_MS, formatGrowthRunLog, hydrateGrowthRunState } from '../store/growth-run.ts'
import type { Translate } from '../../types/client/panel-types'

/** 抽屉高度：够放十余行日志并可滚动，又不至于盖住整个面板。 */
const DRAWER_HEIGHT = 320

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
   * 依赖里带 `visible`，收起时 effect 清理并清掉定时器。
   */
  useEffect(() => {
    if (!visible || !running.running) return
    let active = true
    const timer = setInterval(() => {
      void hydrateGrowthRunState(rpc).then((next) => {
        if (active && next !== undefined) setState(next)
      })
    }, GROWTH_RUN_POLL_MS)
    return () => { active = false; clearInterval(timer) }
  }, [rpc, running.running, visible])

  // 展开时立刻拉一次：否则要等第一个轮询周期才看到内容。
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
      className="dsh-codebuddy-growth-log-sheet"
    >
      <div className="dsh-codebuddy-growth-log-body">
        {text.length === 0
          ? <p className="dsh-codebuddy-muted">{running.running ? t('growthLogWaiting') : t('growthLogEmpty')}</p>
          : (
            <>
              {running.running ? (
                <p className="dsh-codebuddy-muted">
                  <DshSpin size="small" /> {t('growthLogRunning')}
                </p>
              ) : null}
              <DshCodeHighlight code={text} language="log" lineNumber />
            </>
          )}
      </div>
    </DshSideSheet>
  )
}
