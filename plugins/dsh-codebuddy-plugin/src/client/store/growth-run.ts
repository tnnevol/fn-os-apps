/**
 * 成长任务执行的客户端运行态。
 *
 * 权威在宿主：`growthRunStatus` 读取宿主侧的运行状态（进程内账号锁表为准，
 * 见 `host/growth-run.ts`）。这里做五件事：
 *  - mount 时从宿主**采纳**状态，因此刷新页面后按钮仍是 loading，而不会
 *    因为组件 state 重置就变回可点击；
 *  - 记录本地发起的**单个任务**在跑（`$growthTaskInFlight`），让每个任务行
 *    只点亮自己的按钮；
 *  - 运行期间轮询宿主，跑完自动解除 loading 并让调用方重新拉取任务列表；
 *  - 把「哪些账号在跑」这一事实变成共享 atom，账号页按钮与弹框 tab 共用；
 *  - 把「禁用范围」算成纯函数（`isGrowthTaskDisabled` / `isRunAllDisabled`），
 *    因为这是本项目最容易搞错、也最需要单测守着的一条规则。
 *
 * 不把 running 只放在组件 state 里是刻意的：AccountsPage 是 keep-alive 常驻
 * 组件、弹框会随开关卸载重挂，任一处重置都会让用户看到「按钮又亮了」。
 *
 * **禁用范围以账号为界**（用户明确要求）：某个账号在跑任务时，**只有该账号**
 * 的任务按钮与账号管理页的「完成任务」（全账号）按钮禁用；其他账号的按钮保持
 * 可点，并且点下去会**真实执行**（宿主按账号加锁，不互相阻塞）。
 *
 * @module dsh-codebuddy/store/growth-run
 */

import { atom } from 'nanostores'
import { CODEBUDDY_AUTH_CHANNEL } from '../../contracts/constants.ts'
import type { ConnectionRpc, GrowthRunLogEntryView, GrowthRunStateView } from '../rpc.ts'
import { growthLogLines, growthLogText } from '../log-presentation.ts'

/** 宿主侧的成长任务执行状态（落盘 + 进程内锁表，刷新后可恢复）。 */
export const $growthRunning = atom<GrowthRunStateView>({ running: false })

/**
 * 本地发起的单个任务在跑集合，键为 `${accountId}:${taskCode}`。
 *
 * 与 `$growthRunning` 分开的原因：宿主同一时刻可能有多个账号在跑，但界面上每个
 * 任务行必须**只看自己**——用一个全局 running 决定所有任务按钮的状态，会让一个
 * 任务执行时把其余任务的按钮全部压成不可点。
 */
export const $growthTaskInFlight = atom<readonly string[]>([])

/**
 * 本地发起的「单账号一键完成」在跑集合（账号 id）。
 *
 * 与 `$growthTaskInFlight` 分开记录：一键完成不针对某个任务 code，因此无法用
 * 「账号:任务」作为键；同时它也要让该账号的**单项按钮**禁用（该账号正在跑一整轮）。
 */
export const $growthAccountInFlight = atom<readonly string[]>([])

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
 * 该账号是否正在跑**整轮**（一键完成：它名下的每个任务都在被逐个处理）。
 *
 * 与「单项任务在跑」区分开：单项运行时只该点亮那一个任务行，其余任务按钮仍
 * 可用；整轮运行时该账号名下所有任务按钮都该显示进行中。
 *
 * 判定依据：账号在 `accountIds` 里，但 `taskCodes` 没有它的条目——后者只在
 * **单项执行**时写入（见 host 的 `growthRunRegistry`）。
 *
 * @param hostState - 宿主运行状态。
 * @param accountId - 账号本地 id。
 */
export function isAccountRoundRunning(hostState: GrowthRunStateView, accountId: string): boolean {
  if (hostState.running !== true) return false
  if (!(hostState.accountIds?.includes(accountId) ?? false)) return false
  return hostState.taskCodes?.[accountId] === undefined
}

/**
 * 该任务是否正在执行。
 *
 * 同时看四个来源，缺一都会在某些场景下显示错：
 *  - 本地单项集合（刚点下、宿主还没落盘）；
 *  - 本地一键完成集合（该账号整轮在跑）；
 *  - 宿主侧的单项执行（覆盖「提交后刷新页面」——那时本地集合已丢）；
 *  - 宿主侧的整轮执行（该账号名下的每个任务都在跑）。
 *
 * @param inFlight - 本地单项在跑集合。
 * @param hostState - 宿主运行状态。
 * @param accountId - 账号本地 id。
 * @param taskCode - 任务 code。
 * @param accountInFlight - 本地发起的一键完成在跑账号集合。
 */
export function isGrowthTaskRunning(
  inFlight: readonly string[],
  hostState: GrowthRunStateView,
  accountId: string,
  taskCode: string,
  accountInFlight: readonly string[] = [],
): boolean {
  if (inFlight.includes(growthTaskKey(accountId, taskCode))) return true
  if (accountInFlight.includes(accountId)) return true
  if (hostState.running !== true) return false
  if (hostState.taskCodes?.[accountId] === taskCode) return true
  // 兼容只有 `mode/accountId/taskCode` 的单项形态（旧状态文件，或宿主报告的
  // 单项执行）：它只点亮那一条任务，不把整个账号算作整轮在跑。
  if (hostState.mode === 'one' && hostState.accountId === accountId && hostState.taskCode === taskCode) return true
  return isAccountRoundRunning(hostState, accountId)
}

/**
 * 该账号是否有**任何**成长任务在跑（单项或整轮）。
 *
 * 「一键完成」按钮的禁用依据：它要对整个账号跑一遍，而宿主对该账号只有一把锁——
 * 该账号已有任务在跑时，再点一键完成只会被拒绝。其他账号不受影响。
 *
 * @param hostState - 宿主运行状态。
 * @param accountId - 账号本地 id。
 * @param accountInFlight - 本地发起的一键完成在跑账号集合。
 */
export function isAccountBusy(
  hostState: GrowthRunStateView,
  accountId: string,
  accountInFlight: readonly string[] = [],
): boolean {
  if (accountInFlight.includes(accountId)) return true
  if (hostState.running !== true) return false
  if (hostState.taskCodes?.[accountId] !== undefined) return true
  if (hostState.accountId === accountId) return true
  return hostState.accountIds?.includes(accountId) ?? false
}

/**
 * 单个任务行的「完成」按钮是否应禁用。
 *
 * 禁用范围刻意**窄**（这是既有验收条件 FNOS-005-09-AC-03 的要求）：
 *  - 该任务自己正在跑 → 禁用（避免重复提交同一个任务）；
 *  - 该账号正在跑**整轮**（一键完成/完成任务）→ 该账号名下所有任务按钮禁用，
 *    因为宿主正在逐个处理它们；
 *  - **同账号的其它任务**在跑单项时不禁用——那是独立的一次上报，宿主也允许；
 *  - **其他账号**的任务一律不禁用。
 *
 * @param inFlight - 本地单项在跑集合。
 * @param hostState - 宿主运行状态。
 * @param accountId - 账号本地 id。
 * @param taskCode - 任务 code。
 * @param accountInFlight - 本地发起的一键完成在跑账号集合。
 */
export function isGrowthTaskDisabled(
  inFlight: readonly string[],
  hostState: GrowthRunStateView,
  accountId: string,
  taskCode: string,
  accountInFlight: readonly string[] = [],
): boolean {
  if (inFlight.includes(growthTaskKey(accountId, taskCode))) return true
  if (accountInFlight.includes(accountId)) return true
  if (isAccountRoundRunning(hostState, accountId)) return true
  if (hostState.running !== true) return false
  // 该任务自己在跑（新形态经 taskCodes，旧形态经 mode/accountId/taskCode）。
  if (hostState.taskCodes?.[accountId] === taskCode) return true
  return hostState.mode === 'one' && hostState.accountId === accountId && hostState.taskCode === taskCode
}

/**
 * 账号信息弹框里「一键完成」按钮是否应禁用。
 *
 * 依据是**该账号**是否已有成长任务在跑（宿主按账号加锁）；其他账号的状态与
 * 此按钮无关。
 *
 * @param hostState - 宿主运行状态。
 * @param accountId - 账号本地 id。
 * @param accountInFlight - 本地发起的一键完成在跑账号集合。
 */
export function isAccountRunDisabled(
  hostState: GrowthRunStateView,
  accountId: string,
  accountInFlight: readonly string[] = [],
): boolean {
  return isAccountBusy(hostState, accountId, accountInFlight)
}

/**
 * 账号管理页「完成任务」（全账号）按钮是否应禁用。
 *
 * 规则（用户明确要求）：**只要有任何账号在跑成长任务**就禁用这个按钮。
 * 原因是它本身就是「全部账号」这个范围——其他账号的成长任务已经在跑时，再点
 * 「完成任务」只会与正在跑的那一轮重叠。
 *
 * 依据必须是**宿主状态**（含刷新页面后从宿主采纳的状态），不能只凭本页组件
 * state：否则刷新页面后会出现「实际在跑却可点」。
 *
 * 注意这里与「账号级按钮不禁用」并不矛盾：被禁的是**跨全部账号**的那一个入口，
 * 其他账号自己的「完成」与「一键完成」仍可点。
 *
 * @param hostState - 宿主运行状态。
 * @param accountInFlight - 本地发起的一键完成在跑账号集合。
 */
export function isRunAllDisabled(
  hostState: GrowthRunStateView,
  accountInFlight: readonly string[] = [],
): boolean {
  if (accountInFlight.length > 0) return true
  return hostState.running === true
}

/** 标记一个任务开始执行。 */
export function markGrowthTaskRunning(accountId: string, taskCode: string): void {
  const key = growthTaskKey(accountId, taskCode)
  const current = $growthTaskInFlight.get()
  if (!current.includes(key)) $growthTaskInFlight.set([...current, key])
}

/** 记下一个账号的一键完成开始执行（该账号整轮在跑）。 */
export function markGrowthAccountRunning(accountId: string): void {
  const current = $growthAccountInFlight.get()
  if (!current.includes(accountId)) $growthAccountInFlight.set([...current, accountId])
}

/** 记下一个账号的一键完成结束。 */
export function clearGrowthAccountRunning(accountId: string): void {
  $growthAccountInFlight.set($growthAccountInFlight.get().filter(item => item !== accountId))
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
    $growthAccountInFlight.set([])
    $growthOptimistic.set(undefined)
  } else {
    // 宿主已接管的账号从本地集合里摘掉，避免本地记录永久残留。
    const hostAccounts = new Set(result.value.accountIds ?? [])
    const localAccounts = $growthAccountInFlight.get().filter(id => !hostAccounts.has(id))
    if (localAccounts.length !== $growthAccountInFlight.get().length) $growthAccountInFlight.set(localAccounts)
    if (result.value.mode === 'one' && result.value.accountId !== undefined && result.value.taskCode !== undefined) {
      const key = growthTaskKey(result.value.accountId, result.value.taskCode)
      $growthTaskInFlight.set($growthTaskInFlight.get().filter(item => item !== key))
    }
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
  $growthRunning.set({ running: true, mode: 'all', startedAt: Date.now(), accountIds: [] })
}
