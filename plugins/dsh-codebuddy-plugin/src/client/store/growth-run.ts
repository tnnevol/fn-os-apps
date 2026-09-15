/**
 * 成长任务执行的客户端运行态。
 *
 * 权威在宿主：`growthRunStatus` 读取宿主侧落盘的运行状态（见
 * `host/growth-run.ts`）。这里做四件事：
 *  - mount 时从宿主**采纳**状态，因此刷新页面后按钮仍是 loading，而不会
 *    因为组件 state 重置就变回可点击；
 *  - 记录本地发起的**单个任务**在跑（`$growthTaskInFlight`），让每个任务行
 *    只点亮自己的按钮；
 *  - 运行期间轮询宿主，跑完自动解除 loading 并让调用方重新拉取任务列表；
 *  - 把「有任务在跑」这一事实变成共享 atom，账号页按钮与弹框 tab 共用。
 *
 * 不把 running 只放在组件 state 里是刻意的：AccountsPage 是 keep-alive 常驻
 * 组件、弹框会随开关卸载重挂，任一处重置都会让用户看到「按钮又亮了」。
 *
 * @module dsh-codebuddy/store/growth-run
 */

import { atom } from 'nanostores'
import { CODEBUDDY_AUTH_CHANNEL } from '../../contracts/constants.ts'
import type { ConnectionRpc, GrowthRunLogEntryView, GrowthRunStateView } from '../rpc.ts'
import { growthLogLines, growthLogText } from '../log-presentation.ts'

/** 宿主侧的全量/单项执行状态（落盘，刷新后可恢复）。 */
export const $growthRunning = atom<GrowthRunStateView>({ running: false })

/**
 * 本地发起的单个任务在跑集合，键为 `${accountId}:${taskCode}`。
 *
 * 与 `$growthRunning` 分开的原因：宿主同一时刻只跑一轮队列，但界面上每个任务
 * 行必须**只看自己**——用一个全局 running 决定所有任务按钮的状态，会让一个
 * 任务执行时把其余任务的按钮全部压成不可点。
 */
export const $growthTaskInFlight = atom<readonly string[]>([])

/**
 * 本地乐观起点：单项任务刚点下、宿主还没落盘时的临时状态。
 *
 * 为什么需要它：`growthRun` 是**异步落盘**的——宿主先建队列（`beginGrowthRun`）
 * 再拉任务列表，才写出第一条日志。这段时间抽屉若显示上一轮的日志或空态，用户会
 * 以为点击没生效。所以点下按钮的瞬间就在本地造一条「正在执行」。
 *
 * 只在这条记录**仍比宿主状态新**时生效（见 `selectGrowthRunView`），宿主一旦写出
 * 本轮状态就自然让位，不会重复显示。
 */
export const $growthOptimistic = atom<{ accountId: string, taskCode: string, account: string, startedAt: number } | undefined>(undefined)

/** 轮询间隔：与宿主回读节奏（3s）同量级，够用且不打扰。 */
export const GROWTH_RUN_POLL_MS = 2_000

/** 单个任务在跑集合的键。 */
export function growthTaskKey(accountId: string, taskCode: string): string {
  return `${accountId}:${taskCode}`
}

/**
 * 该任务是否正在执行。
 *
 * 同时看本地在跑集合与宿主状态：后者覆盖「提交后刷新页面」的场景——那时本地
 * 集合已丢，但宿主仍在跑同一个任务。
 *
 * @param inFlight - 本地在跑集合。
 * @param hostState - 宿主运行状态。
 * @param accountId - 账号本地 id。
 * @param taskCode - 任务 code。
 */
export function isGrowthTaskRunning(
  inFlight: readonly string[],
  hostState: GrowthRunStateView,
  accountId: string,
  taskCode: string,
): boolean {
  if (inFlight.includes(growthTaskKey(accountId, taskCode))) return true
  return hostState.running
    && hostState.mode === 'one'
    && hostState.accountId === accountId
    && hostState.taskCode === taskCode
}

/** 标记一个任务开始执行。 */
export function markGrowthTaskRunning(accountId: string, taskCode: string): void {
  const key = growthTaskKey(accountId, taskCode)
  const current = $growthTaskInFlight.get()
  if (!current.includes(key)) $growthTaskInFlight.set([...current, key])
}

/**
 * 记下单项执行的本地乐观起点（在发起 RPC 前调用）。
 *
 * @param accountId - 账号本地 id。
 * @param taskCode - 任务 code。
 * @param account - 账号展示名，用于日志里的 `[账号]` 列。
 */
export function markGrowthOptimistic(accountId: string, taskCode: string, account: string): void {
  $growthOptimistic.set({ accountId, taskCode, account, startedAt: Date.now() })
}

/** 清掉本地乐观起点（宿主已接管或本轮已结束）。 */
export function clearGrowthOptimistic(): void {
  $growthOptimistic.set(undefined)
}

/**
 * 合并宿主状态与本地乐观起点，得到抽屉该渲染的状态。
 *
 * 宿主状态**优先**：一旦它写出了本轮单项执行的日志，就说明已经接管，本地那条
 * 临时记录必须让位（否则会重复显示一条「正在执行」）。反之则用本地记录，
 * 让点下按钮的瞬间就有该任务的具体日志，而不是上一轮的内容或空态。
 *
 * @param state - 宿主最近一次上报的状态。
 * @param optimistic - 本地乐观起点。
 * @param startingMessage - 那条临时日志的说明文案。
 */
export function selectGrowthRunView(
  state: GrowthRunStateView | undefined,
  optimistic: { accountId: string, taskCode: string, account: string, startedAt: number } | undefined,
  startingMessage: string,
): GrowthRunStateView | undefined {
  if (optimistic === undefined) return state
  // 宿主已经在跑**这一次**单项执行，且已写出日志 → 交给宿主。
  const hostOwnsThisRun = state?.mode === 'one'
    && state.accountId === optimistic.accountId
    && state.taskCode === optimistic.taskCode
    && (state.log?.length ?? 0) > 0
  if (hostOwnsThisRun) return state
  return {
    running: true,
    mode: 'one',
    accountId: optimistic.accountId,
    taskCode: optimistic.taskCode,
    startedAt: optimistic.startedAt,
    log: [{
      at: optimistic.startedAt,
      account: optimistic.account,
      code: optimistic.taskCode,
      status: 'running',
      message: startingMessage,
    }],
  }
}

/**
 * 全量执行（「完成任务」）期间是否应禁用单项任务按钮。
 *
 * 宿主只有一个执行队列（`growthTasksGuard`），全量跑着时再点单项只会被判重拒绝；
 * 与其让用户点了没反应，不如直接禁用。**单项执行不影响其它单项**——那是刻意的：
 * 每个任务行只看自己的状态。
 *
 * @param hostState - 宿主运行状态。
 * @param inFlight - 本地在跑集合（单项执行才有值）。
 */
export function isBlockedByRunAll(hostState: GrowthRunStateView, inFlight: readonly string[]): boolean {
  // 本地刚发起单项、宿主还没落盘的瞬间可能仍是上一轮的 mode='all'，此时不该被禁。
  if (inFlight.length > 0) return false
  return hostState.running && hostState.mode === 'all'
}

/** 标记一个任务结束执行。 */
export function clearGrowthTaskRunning(accountId: string, taskCode: string): void {
  const key = growthTaskKey(accountId, taskCode)
  $growthTaskInFlight.set($growthTaskInFlight.get().filter(item => item !== key))
}

/**
 * 从宿主读取一次运行状态并写入 store。
 * @param rpc - 连接 RPC。
 * @returns 宿主报告的运行状态；RPC 失败时为 `undefined`（保留现有值）。
 */
export async function hydrateGrowthRunState(rpc: ConnectionRpc): Promise<GrowthRunStateView | undefined> {
  const result = await rpc.call<GrowthRunStateView>(CODEBUDDY_AUTH_CHANNEL, 'growthRunStatus', {})
  if (!result.ok) return undefined
  $growthRunning.set(result.value)
  // 宿主已写出本轮单项状态 → 本地乐观记录让位，避免重复显示。
  const optimistic = $growthOptimistic.get()
  if (optimistic !== undefined) {
    const takenOver = result.value.mode === 'one'
      && result.value.accountId === optimistic.accountId
      && result.value.taskCode === optimistic.taskCode
      && (result.value.log?.length ?? 0) > 0
    if (takenOver) $growthOptimistic.set(undefined)
  }
  // 宿主已结束：清掉本地在跑集合，避免清理失败时按钮永久 loading。
  if (!result.value.running) {
    $growthTaskInFlight.set([])
    $growthOptimistic.set(undefined)
  }
  return result.value
}

/**
 * 把日志条目渲染成等宽纯文本。
 *
 * 渲染已改由 {@link ./log-presentation.ts} 的逐行数据驱动（终端风格需要按段上色，
 * 而 `CodeHighlight` 只吃纯字符串）。这里保留该函数供「复制纯文本」与既有测试使用，
 * 实现委托给同一份逐行数据，保证屏幕对齐与复制结果一致。
 *
 * @param entries - 宿主返回的日志条目。
 * @returns 多行文本；无条目时返回空串。
 */
export function formatGrowthRunLog(entries: readonly GrowthRunLogEntryView[] | undefined): string {
  return growthLogText(growthLogLines(entries))
}

/**
 * 标记本地进入全量执行态（在 RPC 发出前调用，让按钮立刻进入 loading）。
 */
export function markGrowthRunning(): void {
  $growthRunning.set({ running: true, mode: 'all', startedAt: Date.now() })
}
