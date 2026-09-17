/**
 * 成长任务列表与其执行控件。
 *
 * 这里是**展示层**：账号归属由调用方决定（账号信息弹框的「成长任务」tab 只传
 * 单个账号），任务数据与执行都经 RPC；运行态来自共享的 `$growthRunning`
 * store，因此刷新页面后仍然显示 loading（权威是宿主，见 `host/growth-run.ts`）。
 *
 * 四处刻意的结构选择：
 *  - **刷新与一键完成都放在列表内部**：任务列表长在弹框 tab 里，页面级区块头
 *    既会与账号卡片刷新混淆、又在弹框里够不到；一键完成属于「这个账号的这几个
 *    任务」，和刷新是同一个工具栏里的两个动作，因此**一键完成在左、刷新在右**
 *    （先动手、后取数）；
 *  - **列表内部再分「未完成 / 已完成」两栏**（button 型二级 Tab，与「用量信息」
 *    下的资源状态 Tab 同一形态）：已完成的任务通常占多数，混在一起会把待办的
 *    那几条挤到看不见，分成两栏后默认落在未完成上；
 *  - **禁用范围以账号为界**：只有正在跑任务的那个账号禁用；其他账号的按钮保持
 *    可点且点下去会真实执行（宿主按账号加锁）。规则在 `store/growth-run.ts` 里
 *    是纯函数，便于单测守住；
 *  - **一键完成只跑本账号**：它调 `growthRunAccount`（宿主只对该账号加锁），
 *    因此与其他账号的执行互不阻塞。
 *
 * @module dsh-codebuddy/ui/growth-task-list
 */

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@nanostores/react'
import { DshButton, DshTabs, DshTag } from '@tnnevol/dsh-semi-ui'
import { CODEBUDDY_AUTH_CHANNEL } from '../../contracts/constants.ts'
import type { ConnectionRpc, GrowthTaskView, GrowthTasksResult } from '../rpc.ts'
import {
  $growthAccountInFlight,
  $growthRunning,
  $growthTaskInFlight,
  clearGrowthAccountRunning,
  clearGrowthOptimistic,
  clearGrowthTaskRunning,
  growthTaskKey,
  hydrateGrowthRunState,
  isAccountRunDisabled,
  isGrowthTaskDisabled,
  isGrowthTaskRunning,
  markGrowthAccountRunning,
  markGrowthOptimistic,
  markGrowthTaskRunning,
} from '../store/growth-run.ts'
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
 * @param accountName - 账号展示名（本地乐观日志的 `[账号]` 列要用）。
 * @param notify - 结果提示。
 * @param onOpenLog - 执行任务时打开日志抽屉（复用同一份宿主日志）。
 */
export function GrowthTaskList({ rpc, t, accountId, accountName, notify, onOpenLog }: {
  rpc: ConnectionRpc
  t: Translate
  accountId: string | undefined
  /** 账号展示名：本地乐观日志的 `[账号]` 列要用。 */
  accountName?: string
  notify: (ok: boolean, text: string) => void
  onOpenLog?: () => void
}): ReactNode {
  const [tasks, setTasks] = useState<GrowthTaskView[]>([])
  const [error, setError] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<GrowthTabKey>('pending')
  /** 刷新重入标志：见 reload 内的说明（loading 不拦点击，必须自己挡）。 */
  const reloadingRef = useRef(false)
  /** 一键完成重入标志：同上，Semi 的 loading 不拦点击。 */
  const runAccountRef = useRef(false)
  const running = useStore($growthRunning)
  const inFlight = useStore($growthTaskInFlight)
  const accountInFlight = useStore($growthAccountInFlight)

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

  /** 结束收尾（成功与失败共用）：先解本地 loading，再以宿主为准，最后清乐观记录。 */
  const settle = useCallback(async (): Promise<void> => {
    await hydrateGrowthRunState(rpc)
    clearGrowthOptimistic()
  }, [rpc])

  const runOne = async (taskCode: string): Promise<void> => {
    if (accountId === undefined) return
    // 同上：单项按钮用 loading 表达进行中，重复点击由这里挡住，
    // 且**只挡自己**——其它任务不受影响。
    if (inFlight.includes(growthTaskKey(accountId, taskCode))) return
    // 该账号正在跑整轮时不再接受单项：宿主对该账号只有一把锁，点了也只会被拒。
    if (isAccountRunDisabled(running, accountId, accountInFlight)) return
    markGrowthTaskRunning(accountId, taskCode)
    // 宿主落盘前先给抽屉一条具体日志（见 store 里的 selectGrowthRunView）。
    markGrowthOptimistic(accountId, taskCode, accountName ?? accountId)
    /**
     * 与「一键完成」同一处理：先把抽屉打开，再看结果。
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
      /**
       * 收尾顺序是刻意的：先解除本行 loading，再**以宿主为准**刷新一次，
       * 最后兜底清掉本地乐观记录。
       *
       * 乐观清理放在 hydrate **之后**：hydrate 在宿主已接管或本轮已结束时会自己
       * 清掉乐观记录。若提前清，`state` 可能还停在宿主的**上一轮**日志上，
       * 抽屉会闪一下旧内容再跳到新内容。放在最后既避免这次闪烁，又能在 RPC
       * 失败（hydrate 返回 undefined、state 没更新）时兜住，
       * 不让抽屉永远卡在「开始执行…」。
       */
      clearGrowthTaskRunning(accountId, taskCode)
      await settle()
    }
  }

  /**
   * 一键完成：只对本账号的全部可自动化任务跑一轮。
   *
   * 与其他账号互不阻塞（宿主按账号加锁），因此**不做全局禁用**——只挡本账号的
   * 重入。禁用态表达为 `loading`（该账号整轮在跑）而不是 `disabled`：Semi 的
   * `disabled` 优先级高于 `loading`，叠上去会把转圈吃掉；重复点击由这里的 ref
   * 与 store 判断挡住。
   */
  const runAccount = async (): Promise<void> => {
    if (accountId === undefined) return
    if (runAccountRef.current) return
    if (accountInFlight.includes(accountId)) return
    runAccountRef.current = true
    markGrowthAccountRunning(accountId)
    // 点下即展开日志抽屉：整轮要跑几十秒，用户需要看到进度而不是干等。
    onOpenLog?.()
    try {
      const result = await rpc.call<{ status?: string, error?: string, pending?: number }>(
        CODEBUDDY_AUTH_CHANNEL,
        'growthRunAccount',
        { id: accountId },
      )
      if (!result.ok) {
        notify(false, result.error.message)
        return
      }
      // 「跑完」不等于「跑成功」：宿主如实汇报剩余未完成项，这里也如实提示。
      if (result.value.status === 'skipped') {
        notify(false, result.value.error ?? t('growthRunBusy'))
      } else if ((result.value.pending ?? 0) > 0) {
        notify(false, `${t('growthRunPending')} ${result.value.pending}`)
      } else {
        notify(true, t('growthRunDone'))
      }
      await reload()
    } finally {
      runAccountRef.current = false
      clearGrowthAccountRunning(accountId)
      await settle()
    }
  }

  const groups = useMemo(() => groupGrowthTasks(tasks), [tasks])
  // 该账号是否已在跑（单项或整轮）：一键完成按钮的 disabled 依据。
  const accountBusy = isAccountRunDisabled(running, accountId ?? '', accountInFlight)

  if (accountId === undefined) return <p className="dsh-codebuddy-muted">{t('growthTasksEmpty')}</p>

  /** 一栏内容：任务行，或该栏自己的空态。 */
  const renderRows = (rows: GrowthTaskView[], emptyKey: 'growthTasksEmpty' | 'growthTasksDoneEmpty'): ReactNode =>
    rows.length === 0
      ? <p className="dsh-codebuddy-muted">{t(emptyKey)}</p>
      : rows.map(task => {
        // 每个任务行看自己的状态：该任务在跑、或该账号在跑整轮时点亮/禁用。
        const taskRunning = isGrowthTaskRunning(inFlight, running, accountId, task.taskCode, accountInFlight)
        const taskDisabled = isGrowthTaskDisabled(inFlight, running, accountId, task.taskCode, accountInFlight)
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
                  // loading 与 disabled 各表达一件事，但**同一时刻只呈现一个**：
                  // Semi 的 disabled 优先级高于 loading，正在跑时叠加 disabled 会把
                  // 转圈吃掉，用户只看到灰按钮。因此进行中用 loading，禁用只留给
                  // 「同账号有其它任务在跑（且不是这一条）」。
                  {...taskRunning ? { loading: true } : { disabled: taskDisabled }}
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
        <div className="dsh-codebuddy-growth-task-actions">
          {/* 一键完成在左、刷新在右：先动手、后取数；与弹框里「用量信息」Tab 的
              动作顺序同一读法。
              本账号执行中一律用 loading（不是 disabled：Semi 的 disabled 优先级
              高于 loading，叠上去会把转圈吃掉）。重复点击由 runAccount 内的 ref
              与 store 判断挡住。刷新页面后宿主仍报告该账号在跑，因此这里依旧
              loading，直到宿主报告结束。 */}
          <DshButton
            size="small"
            theme="light"
            type="primary"
            loading={accountBusy}
            onClick={() => { void runAccount() }}
          >
            {t('growthRunAccount')}
          </DshButton>
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
