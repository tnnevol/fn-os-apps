/**
 * 成长任务列表与其执行控件。
 *
 * 这里是**展示层**：账号归属由调用方决定（账号信息弹框的「成长任务」tab 只传
 * 单个账号），任务数据与执行都经 RPC；运行态来自共享的 `$growthRunning`
 * store，因此刷新页面后仍然显示 loading（权威是宿主落盘状态，见
 * `host/growth-run.ts`）。
 *
 * 两处刻意的结构选择：
 *  - **刷新按钮放在列表内部**：任务列表长在弹框 tab 里，页面级区块头既会与
 *    账号卡片刷新混淆、又在弹框里够不到；
 *  - **列表内部再分「未完成 / 已完成」两栏**（button 型二级 Tab，与「用量信息」
 *    下的资源状态 Tab 同一形态）：已完成的任务通常占多数，混在一起会把待办的
 *    那几条挤到看不见，分成两栏后默认落在未完成上。
 *
 * @module dsh-codebuddy/ui/growth-task-list
 */

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@nanostores/react'
import { DshButton, DshTabs, DshTag } from '@tnnevol/dsh-semi-ui'
import { CODEBUDDY_AUTH_CHANNEL } from '../../contracts/constants.ts'
import type { ConnectionRpc, GrowthTaskView, GrowthTasksResult } from '../rpc.ts'
import { $growthRunning, $growthTaskInFlight, clearGrowthTaskRunning, growthTaskKey, hydrateGrowthRunState, isGrowthTaskRunning, markGrowthTaskRunning } from '../store/growth-run.ts'
import { groupGrowthTasks } from '../growth-task-groups.ts'
import type { Translate } from '../../types/client/panel-types'

/** 二级 Tab：默认停在「未完成」，因为那是要动手的那一栏。 */
type GrowthTabKey = 'pending' | 'done'

/**
 * 单个账号的成长任务列表。
 *
 * @param rpc - 连接 RPC。
 * @param t - 翻译函数。
 * @param accountId - 目标账号本地 id。
 * @param notify - 结果提示。
 * @param onOpenLog - 执行单项任务时打开日志抽屉（复用同一份宿主日志）。
 */
export function GrowthTaskList({ rpc, t, accountId, notify, onOpenLog }: {
  rpc: ConnectionRpc
  t: Translate
  accountId: string | undefined
  notify: (ok: boolean, text: string) => void
  onOpenLog?: () => void
}): ReactNode {
  const [tasks, setTasks] = useState<GrowthTaskView[]>([])
  const [error, setError] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<GrowthTabKey>('pending')
  /** 刷新重入标志：见 reload 内的说明（loading 不拦点击，必须自己挡）。 */
  const reloadingRef = useRef(false)
  const running = useStore($growthRunning)
  const inFlight = useStore($growthTaskInFlight)

  const reload = useCallback(async (): Promise<void> => {
    if (accountId === undefined) return
    // 重入 guard：Semi 的 loading 不会拦点击，只有 disabled 才拦；刷新按钮刻意
    // 用 loading 表达进行中，所以这里必须自己挡住重复请求。
    if (reloadingRef.current) return
    reloadingRef.current = true
    setLoading(true)
    const result = await rpc.call<GrowthTasksResult>(CODEBUDDY_AUTH_CHANNEL, 'growthTasks', {})
    setLoading(false)
    reloadingRef.current = false
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    setError(undefined)
    const account = result.value.accounts.find(item => item.id === accountId)
    setTasks(account?.tasks ?? [])
    if (account?.error !== undefined) setError(account.error)
  }, [accountId, rpc])

  // 挂载时先采纳宿主运行态：刷新页面后若还在跑，按钮必须保持 loading。
  useEffect(() => { void hydrateGrowthRunState(rpc) }, [rpc])
  useEffect(() => { void reload() }, [reload])

  const runOne = async (taskCode: string): Promise<void> => {
    if (accountId === undefined) return
    // 同上：单项按钮用 loading 表达进行中，重复点击由这里挡住，
    // 且**只挡自己**——其它任务不受影响。
    if (inFlight.includes(growthTaskKey(accountId, taskCode))) return
    markGrowthTaskRunning(accountId, taskCode)
    /**
     * 与「完成任务」同一处理：先把抽屉打开，再看结果。
     *
     * 放在发起 RPC **之前**——单项任务里也有耗时的（领养、专家链），
     * 等 RPC 回来再打开就只剩结果、看不到过程了。
     */
    onOpenLog?.()
    try {
      const result = await rpc.call(CODEBUDDY_AUTH_CHANNEL, 'growthRun', { id: accountId, taskCode })
      if (!result.ok) {
        notify(false, result.error.message)
        return
      }
      notify(true, t('growthRunDone'))
      await reload()
    } finally {
      // 无论成功失败都要收尾：先清本地在跑标记解除本行 loading，再以宿主为准。
      clearGrowthTaskRunning(accountId, taskCode)
      await hydrateGrowthRunState(rpc)
    }
  }

  const groups = useMemo(() => groupGrowthTasks(tasks), [tasks])

  if (accountId === undefined) return <p className="dsh-codebuddy-muted">{t('growthTasksEmpty')}</p>

  /** 一栏内容：任务行，或该栏自己的空态。 */
  const renderRows = (rows: GrowthTaskView[], emptyKey: 'growthTasksEmpty' | 'growthTasksDoneEmpty'): ReactNode =>
    rows.length === 0
      ? <p className="dsh-codebuddy-muted">{t(emptyKey)}</p>
      : rows.map(task => {
        // 每个任务行只看自己的在跑状态：一个任务执行不影响其它任务按钮。
        const taskRunning = isGrowthTaskRunning(inFlight, running, accountId, task.taskCode)
        return (
          <div key={task.taskCode} className="dsh-codebuddy-growth-task-row">
            <div className="dsh-codebuddy-growth-task-main">
              <strong>{task.title ?? task.taskCode}</strong>
              <span className="dsh-codebuddy-muted">{task.taskCode}</span>
              {!task.automatable && task.automationReason !== undefined
                ? <span className="dsh-codebuddy-muted">{task.automationReason}</span>
                : null}
            </div>
            <div className="dsh-codebuddy-growth-task-meta">
              <span>{task.current}/{task.target}</span>
              {task.claimed ? <DshTag size="small" type="light" color="green">{t('growthClaimed')}</DshTag> : null}
              {!task.automatable ? <DshTag size="small" type="light" color="orange">{t('growthManual')}</DshTag> : null}
              {task.claimable ? <DshTag size="small" type="light" color="blue">{t('growthClaimable')}</DshTag> : null}
              {task.automatable && !task.claimed ? (
                <DshButton
                  size="small"
                  theme="light"
                  loading={taskRunning}
                  onClick={() => { void runOne(task.taskCode) }}
                >
                  {t('growthRunOne')}
                </DshButton>
              ) : null}
            </div>
          </div>
        )
      })

  return (
    <div className="dsh-codebuddy-growth-task-list">
      <div className="dsh-codebuddy-growth-task-toolbar">
        <span className="dsh-codebuddy-muted">{t('growthTasksDesc')}</span>
        {/* 刷新是只读取数，没有「真实不可用」的状态需要禁用：在别的任务跑着时
            刷新列表反而更有用（能看到进度）。所以只给 loading 表达本次读取在途，
            不叠 disabled —— 叠了还会因为 Semi 的 disabled 优先于 loading 而把
            转圈吃掉。重入由 reload 内的 reloadingRef 挡住。 */}
        <DshButton
          size="small"
          theme="light"
          loading={loading}
          onClick={() => { void reload() }}
        >
          {t('refresh')}
        </DshButton>
      </div>
      {error !== undefined ? <p className="dsh-codebuddy-error">{error}</p> : null}
      {loading && tasks.length === 0 ? <p className="dsh-codebuddy-muted">{t('loading')}</p> : null}
      {!loading && tasks.length === 0 ? <p className="dsh-codebuddy-muted">{t('growthTasksEmpty')}</p> : null}
      {tasks.length > 0 ? (
        <DshTabs
          type="button"
          size="small"
          activeKey={tab}
          onChange={(key: string) => { setTab(key as GrowthTabKey) }}
        >
          <DshTabs.TabPane
            itemKey="pending"
            tab={<span className="dsh-codebuddy-resource-tab">{t('growthTabPending')}<i>{groups.pending.length}</i></span>}
          >
            {/* 滚动容器与「用量信息」的资源列表同一口径（`min(52vh, 620px)` +
                overflow）：任务多时只滚列表本身，工具栏与弹框高度保持稳定。 */}
            <div className="dsh-codebuddy-growth-task-body">
              {renderRows(groups.pending, 'growthTasksEmpty')}
            </div>
          </DshTabs.TabPane>
          <DshTabs.TabPane
            itemKey="done"
            tab={<span className="dsh-codebuddy-resource-tab">{t('growthTabDone')}<i>{groups.done.length}</i></span>}
          >
            <div className="dsh-codebuddy-growth-task-body">
              {renderRows(groups.done, 'growthTasksDoneEmpty')}
            </div>
          </DshTabs.TabPane>
        </DshTabs>
      ) : null}
    </div>
  )
}
