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
  // 宿主已结束：清掉本地在跑集合，避免清理失败时按钮永久 loading。
  if (!result.value.running) $growthTaskInFlight.set([])
  return result.value
}

/** 按行格式化一条日志的时间戳（HH:MM:SS，本地时区）。 */
function formatLogTime(at: number): string {
  const date = new Date(at)
  const pad = (value: number): string => (value < 10 ? `0${value}` : String(value))
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * 把日志条目渲染成等宽文本，供 `CodeHighlight` 展示。
 *
 * 每行形如 `12:34:56 [账号] 任务code  状态  说明`，用空格对齐而不是表格：
 * 抽屉里是原始日志块（方案 A），对齐由等宽字体保证，复制出去也是可读的纯文本。
 *
 * @param entries - 宿主返回的日志条目。
 * @returns 多行文本；无条目时返回空串（调用方据此显示空态）。
 */
export function formatGrowthRunLog(entries: readonly GrowthRunLogEntryView[] | undefined): string {
  if (entries === undefined || entries.length === 0) return ''
  // 任务 code 对齐到最长者：日志里 code 长度不一（chat_5 与 Expert_team_use_3），
  // 不补齐会让状态列参差不齐、很难扫读。
  const codeWidth = entries.reduce((max, entry) => Math.max(max, entry.code.length), 0)
  return entries
    .map(entry => {
      const time = formatLogTime(entry.at)
      const account = `[${entry.account}]`
      const code = entry.code.padEnd(codeWidth, ' ')
      const status = entry.status.padEnd(11, ' ')
      return `${time} ${account} ${code}  ${status}${entry.message ?? ''}`.trimEnd()
    })
    .join('\n')
}

/**
 * 标记本地进入全量执行态（在 RPC 发出前调用，让按钮立刻进入 loading）。
 */
export function markGrowthRunning(): void {
  $growthRunning.set({ running: true, mode: 'all', startedAt: Date.now() })
}
