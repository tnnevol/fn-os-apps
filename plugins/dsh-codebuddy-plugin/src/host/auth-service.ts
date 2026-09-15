/**
 * Host 侧 OAuth 服务，通过私有 RPC 通道暴露给 Web 客户端。
 *
 * 浏览器登录是长时运行的操作（要等待人工完成登录），因此把登录
 * 流程拆成了两个 RPC endpoint：`startLogin` 负责生成握手，并
 * 返回用户必须打开的 URL；`pollLogin` 则检查该握手是否已经
 * 完成。`status` 与 `logout` 是设置页其余时间驱动的读取/清除
 * 一对。
 *
 * @module dsh-codebuddy/auth-service
 */

import type { SessionAnalyticsServices, ProbeOutcome, CodeBuddyAuthStatus, CodeBuddyLoginStart, CodeBuddyLoginPoll, CodeBuddyUsageWindow, CodeBuddyUsageResult, CodeBuddyAccountView, CodeBuddyAccountsResult, CodeBuddyAccountsChanged, PendingLogin, RpcOk, RpcErr } from '../types/host/auth-service'
export type { SessionAnalyticsServices, CodeBuddyAuthStatus, CodeBuddyLoginStart, CodeBuddyLoginPoll, CodeBuddyUsageWindow, CodeBuddyUsageResult, CodeBuddyAccountView, CodeBuddyAccountsResult, CodeBuddyAccountsChanged } from '../types/host/auth-service'
import type { Context } from '@deepseek-ai/cordis'
import type { CodeBuddyIdentity } from './codebuddy.ts'
import {
  CODEBUDDY_CLIENT_ENDPOINTS,
  CODEBUDDY_CLIENT_VERSIONS,
  CODEBUDDY_DEFAULT_ENVIRONMENT,
  CODEBUDDY_ENVIRONMENT_ENDPOINTS,
  normalizeClientId,
  type CodeBuddyClientId,
  type CodeBuddyEnvironment,
  CODEBUDDY_AUTH_CHANNEL,
} from '../contracts/constants.ts'

import { getCheckinStatus, performCheckin, fetchUsage } from './usage.ts'
import { BackoffGate, mapWithConcurrency, RunGuard } from './concurrency.ts'
import { claimTravel, departTravel, fetchTravelLocations, fetchTravelStatus } from './travel.ts'
import { acceptGrowthTasks, claimGrowthTask, isAutomatableGrowthTask, listGrowthTasks, sortGrowthTasksByOrder } from './growth-tasks.ts'
import { runGrowthTaskAction } from './growth-actions.ts'
import { appendGrowthRunLog, beginGrowthRun, finishGrowthRun, loadGrowthRunState } from './growth-run.ts'
import { getLoginAccount, pollAuthToken, requestAuthState } from './codebuddy.ts'
import {
  clearStorage,
  loadStorage,
  saveStorage,
  mutateStorage,
  buildAccountEntry,
  activeEntry,
  nextActiveId,
  resolveEntryEndpoint,
  loadAutoSwitchConfig,
  saveAutoSwitchConfig,
  loadAutoCheckinConfig,
  saveAutoCheckinConfig,
  loadAutoTravelConfig,
  saveAutoTravelConfig,
} from './storage.ts'
import type { CodeBuddySession } from './session.ts'
import type { CodeBuddyAccountEntry, CodeBuddyStorage } from './storage.ts'
import type { UsageSnapshot, UsageWindow } from './usage.ts'
import { collectCodeBuddyTokenStats, type CodeBuddyTokenStatsRequest } from './token-stats.ts'

/**
 * 派发失败是否为「该账号没有猫猫」。
 *
 * 只认服务端文案（对照 workbuddy-switch 的 `classify_depart_error`）。
 * 切记不可改用 `status.buddy_id`：那是**当前在旅行的猫猫 id**，未派发时为 0，
 * 用它判断会让从未派发过的账号永远得不到派发。
 */
function isNoBuddyError(message: string): boolean {
  return message.toLowerCase().includes('no active buddy')
}

/**
 * 面板/签到批量探测的并发账号数。每个账号会并发打出 2–3 个请求，取值太小
 * 退化成串行、太大则给 meter 平面造成瞬时压力；4 是这两者之间的折中。
 */
const CONCURRENCY = 4
const GROWTH_POLL_ATTEMPTS = 4
const GROWTH_POLL_GAP_MS = 3_000

function waitForGrowthPoll(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('aborted'))
      return
    }
    const timer = setTimeout(resolve, GROWTH_POLL_GAP_MS)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason ?? new Error('aborted'))
    }, { once: true })
  })
}

type ConnectionService = {
  rpc: {
    handle: (
      channel: string,
      handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>,
    ) => () => Promise<void> | void
  }
}

/**
 * 主动切换周期的间隔。
 *
 * 主动切换靠轮询实现：只有周期性探测才能在「没有请求发生」时发现额度将尽，
 * 从而在下一个提问到来前把账号换好（这正是它相对纯被动换号的价值——用户不
 * 感知一次失败）。纯被动机制（如 DSH 自带的重连）只在失败后触发，替代不了它。
 *
 * 取 1 分钟而非 30s：额度是分钟级变化的东西，30s 窗口内的变化通常为零，而每次
 * 探测都是一次远端往返。1 分钟足以让「快用完」被及时换掉，请求量减半；叠加
 * 统探测的 30s TTL 缓存后，相邻两轮若落在同一 TTL 窗口内还会直接命中缓存。
 */
const AUTO_SWITCH_INTERVAL_MS = 60_000

function ok<T>(value: T): RpcOk<T> {
  return { ok: true, value }
}

function err(code: string, message: string): RpcErr {
  return { ok: false, error: { code, message, details: {} } }
}

/**
 * 把自有数据 {@link UsageWindow} 投影成客户端接收的 RPC 安全形状，
 * 可选字段仅在存在时拓宽输出。
 * @param window - 该计量窗口。
 * @returns 客户端安全的投影。
 */
function projectWindow(window: UsageWindow): CodeBuddyUsageWindow {
  return {
    name: window.name,
    ...window.used === undefined ? {} : { used: window.used },
    ...window.limit === undefined ? {} : { limit: window.limit },
    ...window.usedPercent === undefined ? {} : { usedPercent: window.usedPercent },
    ...window.resetsAt === undefined ? {} : { resetsAt: window.resetsAt },
  }
}

/**
 * CodeBuddy 鉴权 RPC 服务。
 *
 * 握手由 `startLogin` 发起，再由 `pollLogin` 轮询至完成，
 * 其凭据由适配器的 `CodeBuddySession` 在下一次请求时取用——
 * 因此通过 UI 完成的登录，无需重启即可作用于正在运行的
 * harness。`logout` 则会清空凭据文件，并使 session 缓存失效。
 */
export class CodeBuddyAuthService {
  /** 按 state id 索引的进行中握手。 */
  private readonly pending = new Map<string, PendingLogin>()

  private readonly logger: { warn: (m: unknown) => void, info: (m: unknown) => void }

  /**
   * 插件已卸载。周期开关的初始配置是异步读取的，回调可能在卸载**之后**才
   * 落地；若此时再启动定时器，就绕过了 effect 的清理（effect 已执行过），
   * 留下真正的孤儿定时器。所有 start* 都先检查这个标志。
   */
  private disposed = false

  /** RPC route registration must finish before the host starts serving the Web UI. */
  private readonly rpcReady: Promise<unknown>

  constructor(
    ctx: Context,
    private readonly session?: CodeBuddySession,
    /** 当前账号（或其凭据）变化后回调：用于触发 llm/adapters-updated，让模型选择器与用量即时刷新。 */
    private readonly onActiveChanged?: () => void,
    /** DSH logical session 查询；仅在无持久化/查询支持的 profile 中缺席。 */
    private readonly analytics?: SessionAnalyticsServices,
  ) {
    this.logger = ctx.logger
    // 后台周期定时器必须随插件卸载一起清掉：`setInterval` 是进程级句柄，
    // 插件被 disable/热重载后残留的定时器会继续以旧配置访问远端账号。
    // 用单个 effect 覆盖全部周期——disposer 在卸载时才读取字段，
    // 因此之后新起的定时器同样被清掉，不必为每次开关重复注册。
    ctx.effect(() => () => {
      this.disposed = true
      this.stopAutoSwitchCycle()
      this.stopAutoCheckinCycle()
      this.stopTravelCycle()
    }, 'dsh-codebuddy: background cycles')
    const registerRpc = (connectionCtx: Context): void => {
      // Read and call the service through the injected Context property. `ctx.get()`
      // returns the raw service and loses the caller Context; `connection.rpc.handle()`
      // needs that Context to own the Web-server route registration.
      const injected = connectionCtx as unknown as { connection?: ConnectionService }
      if (injected.connection === undefined) {
        throw new Error('dsh-codebuddy: connection service is unavailable')
      }
      // dsh 0.1.5-rc.2 移除了按通道的 `{ authority: 'loopback' }` 信任选项。
      // `handle()` 自身已经把 disposer 绑定到当前调用 Context 的生命周期，
      // 不再额外包一层 effect，避免把路由所有权退回 Connection 服务 Context。
      injected.connection.rpc.handle(
        CODEBUDDY_AUTH_CHANNEL,
        (endpoint, payload, signal) => this.dispatch(endpoint, payload, signal),
      )
    }

    // `connection.rpc.handle()` resolves the HTTP route owner from the Context
    // used to read `connection`. Use a child Context that explicitly injects both
    // services, then let the plugin await it before the Web UI can issue its first
    // RPC request. This also keeps lightweight test contexts working: their
    // no-op `inject` implementation simply produces an already-resolved value.
    this.rpcReady = Promise.resolve(ctx.inject(['connection', 'webServer'], registerRpc))
    void loadAutoSwitchConfig().then((config) => {
      this.autoSwitch = config.enabled
      this.autoSwitchThresholdPct = config.thresholdPct
      this.prefsLoadedFromDisk = config.fromDisk
      if (config.enabled) this.startAutoSwitchCycle()
    }).catch(() => {
      // 读取偏好只是建议性的；代码内默认值已经生效。
    })
    void loadAutoCheckinConfig().then((config) => {
      this.autoCheckin = config.enabled
      if (config.enabled) this.startAutoCheckinCycle()
    }).catch(() => {
      // 读取偏好只是建议性的；代码内默认值已经生效。
    })
    void loadAutoTravelConfig().then((config) => {
      this.autoTravel = config.enabled
      if (config.enabled) this.startTravelCycle()
    }).catch(() => {
      // 读取偏好只是建议性的；代码内默认值已经生效。
    })
  }

  /** Wait until the authenticated CodeBuddy RPC route has been mounted. */
  async ready(): Promise<void> {
    await this.rpcReady
  }

  /** 自动每日签到开关（全部账号）。默认开启。 */
  autoCheckin = true

  /**
   * 连续「每个账号都失败」的自动签到周期轮数。达到上限后周期退避停止，
   * 直到出现下一轮成功。
   */
  private static readonly AUTO_CHECKIN_FAILURE_LIMIT = 3
  /**
   * 连续全失败时退避：到阈值后放慢重试，冷却期满**自动恢复**。
   * 此前是到阈值就永久 standby，那样计数再无下降机会，周期只能靠重启恢复。
   */
  private readonly autoCheckinBackoff = new BackoffGate(
    CodeBuddyAuthService.AUTO_CHECKIN_FAILURE_LIMIT,
    30 * 60_000,
  )
  private autoCheckinTimer: ReturnType<typeof setInterval> | undefined
  private readonly autoCheckinGuard = new RunGuard('auto-checkin')

  /** 自动签到：逐账号查状态，未签到的提交；已签到的跳过。对照 workbuddy-switch
   *  `run_checkin_cycle`。返回逐账号结果供日志/UI 使用。 */
  async runAutoCheckinCycle(): Promise<{ status: string, accounts: Array<{ id: string, name: string, result: string, error?: string }> }> {
    if (!this.autoCheckin) return { status: 'disabled', accounts: [] }
    if (this.autoCheckinBackoff.shouldSkip()) return { status: 'backoff', accounts: [] }
    // 串行访问 N 个账号可能超过 30 分钟以外的任何重入来源（手动 RPC + 定时器）：
    // 未结束时跳过，避免同一账号被重复提交签到。
    const guard = this.autoCheckinGuard.tryAcquire()
    if (guard === undefined) return { status: 'skipped', accounts: [] }
    try {
      return await this.runAutoCheckinPass()
    } finally {
      guard.release()
    }
  }

  private async runAutoCheckinPass(): Promise<{ status: string, accounts: Array<{ id: string, name: string, result: string, error?: string }> }> {
    const storage = await loadStorage()
    if (storage === undefined) return { status: 'no_accounts', accounts: [] }
    const rows: Array<{ id: string, name: string, result: string, error?: string }> = []
    let failed = 0
    for (const entry of storage.accounts) {
      const push = (result: string, error?: string): void => {
        const row: { id: string, name: string, result: string, error?: string } = {
          id: entry.id,
          name: entry.account.label ?? entry.account.nickname,
          result,
          ...error === undefined || error.length === 0 ? {} : { error },
        }
        rows.push(row)
      }
      const identity = this.session?.identityFor(entry)
      if (identity === undefined) continue
      // 企业账号不支持签到，自动签到跳过。
      if (identity.enterpriseId !== undefined) {
        push('skipped')
        continue
      }
      if (entry.auth.refreshExpiresAt <= Date.now()) {
        push('expired')
        failed += 1
        continue
      }
      try {
        const status = await getCheckinStatus(resolveEntryEndpoint(entry), identity)
        if (status.ok && status.todayCheckedIn) {
          push('already')
          continue
        }
        if (!status.ok) {
          push('error', status.error)
          failed += 1
          continue
        }
        const done = await performCheckin(resolveEntryEndpoint(entry), identity)
        if (done.ok) push(done.already === true ? 'already' : 'success')
        else {
          push('error', done.error)
          failed += 1
        }
      } catch {
        push('error', 'probe failed')
        failed += 1
      }
    }
    // 全部账号都失败才算失败轮；任一账号成功即恢复正常节奏。
    if (failed === storage.accounts.length && storage.accounts.length > 0) this.autoCheckinBackoff.fail()
    else this.autoCheckinBackoff.succeed()
    return { status: 'ok', accounts: rows }
  }

  /** 启动周期性自动签到（启动时执行一次，之后每 30 分钟一次，
   *  对应 workbuddy-switch 的 CHECKIN_RECOVERY_INTERVAL）。 */
  startAutoCheckinCycle(): void {
    if (this.disposed) return
    if (this.autoCheckinTimer !== undefined) return
    void this.runAutoCheckinCycle()
    this.autoCheckinTimer = setInterval(() => { void this.runAutoCheckinCycle() }, 30 * 60_000)
  }

  stopAutoCheckinCycle(): void {
    if (this.autoCheckinTimer !== undefined) {
      clearInterval(this.autoCheckinTimer)
      this.autoCheckinTimer = undefined
    }
  }

  /** 自动猫猫旅行开关（仅个人账号）。默认开启。 */
  autoTravel = true

  /**
   * 连续「每个够格账号都失败」的旅行轮数。达到上限后周期退避停止，
   * 而不是对一个不可达的平面持续捶打。
   */
  private static readonly TRAVEL_FAILURE_LIMIT = 3
  /**
   * 连续全失败时退避：到阈值后放慢重试，冷却期满**自动恢复**。
   * 此前是到阈值就永久 standby，那样计数再无下降机会，周期只能靠重启恢复。
   */
  private readonly travelBackoff = new BackoffGate(
    CodeBuddyAuthService.TRAVEL_FAILURE_LIMIT,
    30 * 60_000,
  )
  private travelTimer: ReturnType<typeof setInterval> | undefined
  private travelClaimTimer: ReturnType<typeof setInterval> | undefined
  private readonly travelDispatchGuard = new RunGuard('travel-dispatch')
  private readonly travelClaimGuard = new RunGuard('travel-claim')
  /** 正在领取中的账号 id：两个旅行周期的守卫互相独立，需按账号去重。 */
  private readonly claiming = new Set<string>()

  /** 派发周期：逐账号同步状态并按状态机推进。
   *
   * - `arrived` → 领取奖励；
   * - `traveling` → 等待（记录到达时间供 UI 倒计时）；
   * - `idle` + `daily_limit_reached` → 今日已旅行（不再派发）；
   * - `idle` → 派发（依次尝试地点列表）。
   *
   * 企业账号成长中心不可用（403），无 Buddy 的账号派发会被拒——
   * 后者属可重试原因，不能记为当日完成。 */
  async runTravelCycle(): Promise<{ status: string, accounts: Array<{ id: string, name: string, result: string, state?: string, arriveAt?: number, locationName?: string, rewardCredit?: number, error?: string }> }> {
    if (!this.autoTravel) return { status: 'disabled', accounts: [] }
    if (this.travelBackoff.shouldSkip()) return { status: 'backoff', accounts: [] }
    const guard = this.travelDispatchGuard.tryAcquire()
    if (guard === undefined) return { status: 'skipped', accounts: [] }
    try {
      return await this.runTravelPass()
    } finally {
      guard.release()
    }
  }

  private async runTravelPass(): Promise<{ status: string, accounts: Array<{ id: string, name: string, result: string, state?: string, arriveAt?: number, locationName?: string, rewardCredit?: number, error?: string }> }> {
    const storage = await loadStorage()
    if (storage === undefined) return { status: 'no_accounts', accounts: [] }
    type TravelRow = { id: string, name: string, result: string, state?: string, arriveAt?: number, locationName?: string, rewardCredit?: number, error?: string }
    const rows: TravelRow[] = []
    let eligible = 0
    let failed = 0
    for (const entry of storage.accounts) {
      const identity = this.session?.identityFor(entry)
      if (identity === undefined) continue
      const name = entry.account.label ?? entry.account.nickname
      const push = (row: Omit<TravelRow, 'id' | 'name'>): void => { rows.push({ id: entry.id, name, ...row }) }
      // 成长中心仅对个人用户开放，企业账号直接跳过。
      if (identity.enterpriseId !== undefined) {
        push({ result: 'skipped' })
        continue
      }
      if (entry.auth.refreshExpiresAt <= Date.now()) {
        push({ result: 'expired' })
        continue
      }
      eligible += 1
      const endpoint = resolveEntryEndpoint(entry)
      try {
        const status = await fetchTravelStatus(endpoint, identity)
        if (!status.ok) {
          if (status.unsupported === true) push({ result: 'skipped' })
          else {
            push({ result: 'error', ...status.error === undefined ? {} : { error: status.error } })
            failed += 1
          }
          continue
        }
        if (status.state === 'traveling') {
          push({
            result: 'traveling',
            state: 'traveling',
            arriveAt: status.arriveAt,
            ...status.locationName === undefined ? {} : { locationName: status.locationName },
          })
          continue
        }
        if (status.state === 'arrived') {
          const claimed = await this.claimArrived(entry.id, endpoint, identity, status.recordId)
          if (claimed.ok) {
            push({
              result: 'claimed',
              state: 'idle',
              ...claimed.rewardCredit === undefined ? {} : { rewardCredit: claimed.rewardCredit },
            })
          } else if (claimed.busy === true) {
            // 领取周期正在处理同一账号：不算失败，也不重复 claim。
            push({ result: 'claiming', state: 'arrived' })
          } else {
            push({ result: 'error', ...claimed.error === undefined ? {} : { error: claimed.error } })
            failed += 1
          }
          continue
        }
        // state === 'idle'
        if (status.dailyLimitReached) {
          push({ result: 'daily-limit', state: 'idle' })
          continue
        }
        // 不再用 `buddy_id <= 0` 判定「没有猫猫」：实测该字段表示**当前正在
        // 旅行的猫猫 id**，而不是账号是否拥有猫猫。未派发的账号一律返回 0，
        // 派发成功后才变成真实 id（实测 0 → 7317310）。按它拦截会让「从未派发
        // 过的账号」永远得不到派发——越是没派过就越被拦住，正是卡片显示
        // 「暂无猫猫」的原因。
        // 真正的「没有猫猫」以派发失败的 `no active buddy` 文案为准，对照
        // workbuddy-switch 的 classify_depart_error。
        const departed = await this.departAtAnyLocation(endpoint, identity)
        if (departed.ok) {
          push({
            result: 'departed',
            state: 'traveling',
            ...departed.arriveAt === undefined ? {} : { arriveAt: departed.arriveAt },
            ...departed.locationName === undefined ? {} : { locationName: departed.locationName },
          })
        } else if (departed.already === true) {
          push({ result: 'traveling', state: 'traveling' })
        } else if (departed.noBuddy === true) {
          // 服务端明确说没有猫猫：可重试原因（账号后来可能获得猫猫），
          // 不记为失败，免得把一个只是没猫猫的账号算成全失败。
          push({ result: 'no-buddy' })
        } else {
          push({ result: 'error', ...departed.error === undefined ? {} : { error: departed.error } })
          failed += 1
        }
      } catch {
        push({ result: 'error', error: 'probe failed' })
        failed += 1
      }
    }
    // 仅当每个「够格的」账号都失败才算失败轮——企业账号跳过与无 Buddy 都不算。
    if (eligible > 0 && failed === eligible) this.travelBackoff.fail()
    else this.travelBackoff.succeed()
    return { status: 'ok', accounts: rows }
  }

  /**
   * 领取一个已到达的账号，并保证同一账号不会被两个周期同时领取。
   *
   * 派发与领取两个周期各有独立守卫，而 30 与 15 分钟的最小公倍数是 30 分钟，
   * 所以它们的定时器每 30 分钟就会对齐一次：那一刻两个周期都可能读到同一个
   * `arrived` 账号并各自发起 claim。输的一方会收到服务端拒绝，若照旧记为
   * `error`，就会把本来健康的一轮算成全失败，无端把派发周期推向退避。
   *
   * 因此按账号去重：已有领取在途时直接返回 `busy`，让调用方记为「领取中」
   * 而不是失败。
   */
  private async claimArrived(
    accountId: string,
    endpoint: string,
    identity: CodeBuddyIdentity,
    recordId: number,
  ): Promise<{ ok: boolean, busy?: boolean, rewardCredit?: number, error?: string }> {
    if (this.claiming.has(accountId)) return { ok: false, busy: true }
    this.claiming.add(accountId)
    try {
      return await claimTravel(endpoint, identity, recordId)
    } finally {
      this.claiming.delete(accountId)
    }
  }

  /** 依次尝试地点列表派发，返回首个成功的结果（含到达时间）。
   *
   * 失败原因按文案分类（对照 workbuddy-switch 的 `classify_depart_error`）：
   * `no active buddy` 是**唯一**可信的「没有猫猫」依据——`status.buddy_id`
   * 表示当前在旅行的猫猫，未派发时为 0，不能用来判断是否拥有猫猫。 */
  private async departAtAnyLocation(
    endpoint: string,
    identity: CodeBuddyIdentity,
  ): Promise<{ ok: boolean, already?: boolean, noBuddy?: boolean, arriveAt?: number, locationName?: string, error?: string }> {
    const locations = await fetchTravelLocations(endpoint, identity)
    if (locations.length === 0) return { ok: false, error: 'no locations available' }
    let lastError = 'depart failed'
    for (const location of locations) {
      const result = await departTravel(endpoint, identity, location.id)
      if (result.ok) {
        // 派发成功后回读一次状态：到达时间只有 status 会给出。
        const status = await fetchTravelStatus(endpoint, identity)
        return {
          ok: true,
          ...status.arriveAt > 0 ? { arriveAt: status.arriveAt } : {},
          ...status.locationName === undefined ? {} : { locationName: status.locationName },
        }
      }
      if (result.already === true) return { ok: false, already: true }
      lastError = result.error ?? lastError
      if (isNoBuddyError(lastError)) return { ok: false, noBuddy: true, error: lastError }
      // 企业账号等确定性拒绝不再换地点重试。
      if (result.unsupported === true) return { ok: false, error: lastError }
    }
    return { ok: false, error: lastError }
  }

  /**
   * 单账号签到（供「完成任务」串联使用）。
   *
   * 与自动周期同源：先查状态，已签到直接返回 `already`（**不重复提交**），
   * 企业账号返回 `skipped`。失败不抛错——签到只是成长流程的前置步骤之一，
   * 不该因为它中止后续任务。
   *
   * @param id - 账号本地 id（仅用于日志/结果标识）。
   * @param name - 账号展示名。
   * @param endpoint - 该账号的服务根。
   * @param identity - 该账号的身份。
   */
  private async checkinOneAccount(
    id: string,
    name: string,
    endpoint: string,
    identity: CodeBuddyIdentity,
  ): Promise<{ id: string, name: string, result: string, error?: string }> {
    if (identity.enterpriseId !== undefined) return { id, name, result: 'skipped' }
    try {
      const status = await getCheckinStatus(endpoint, identity)
      if (status.ok && status.todayCheckedIn) return { id, name, result: 'already' }
      if (!status.ok) return { id, name, result: 'error', ...status.error === undefined ? {} : { error: status.error } }
      const done = await performCheckin(endpoint, identity)
      if (done.ok) return { id, name, result: done.already === true ? 'already' : 'success' }
      return { id, name, result: 'error', ...done.error === undefined ? {} : { error: done.error } }
    } catch (error) {
      return { id, name, result: 'error', error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * 单账号旅行推进（供「完成任务」串联使用）。
   *
   * 与派发周期同源，复用 `claimArrived` / `departAtAnyLocation`：
   *  - `traveling` → `traveling`（在途，跳过，不重复派发）；
   *  - `arrived` → 领取奖励；
   *  - `idle` + `daily_limit_reached` → `daily-limit`（今日已旅行，跳过）；
   *  - `idle` → 尝试派发；没有猫猫返回 `no-buddy`（可重试，不算失败）。
   *
   * **必须先领养猫猫**：没有 Buddy 时派发只会被服务端拒（`no active buddy`），
   * 所以调用方把领养排在旅行之前。
   */
  private async travelOneAccount(
    id: string,
    name: string,
    endpoint: string,
    identity: CodeBuddyIdentity,
  ): Promise<{ id: string, name: string, result: string, rewardCredit?: number, error?: string }> {
    if (identity.enterpriseId !== undefined) return { id, name, result: 'skipped' }
    try {
      const status = await fetchTravelStatus(endpoint, identity)
      if (!status.ok) {
        if (status.unsupported === true) return { id, name, result: 'skipped' }
        return { id, name, result: 'error', ...status.error === undefined ? {} : { error: status.error } }
      }
      if (status.state === 'traveling') return { id, name, result: 'traveling' }
      if (status.state === 'arrived') {
        const claimed = await this.claimArrived(id, endpoint, identity, status.recordId)
        if (claimed.ok) return { id, name, result: 'claimed', ...claimed.rewardCredit === undefined ? {} : { rewardCredit: claimed.rewardCredit } }
        if (claimed.busy === true) return { id, name, result: 'claiming' }
        return { id, name, result: 'error', ...claimed.error === undefined ? {} : { error: claimed.error } }
      }
      if (status.dailyLimitReached) return { id, name, result: 'daily-limit' }
      const departed = await this.departAtAnyLocation(endpoint, identity)
      if (departed.ok) return { id, name, result: 'departed' }
      if (departed.already === true) return { id, name, result: 'traveling' }
      if (departed.noBuddy === true) return { id, name, result: 'no-buddy' }
      return { id, name, result: 'error', ...departed.error === undefined ? {} : { error: departed.error } }
    } catch (error) {
      return { id, name, result: 'error', error: error instanceof Error ? error.message : String(error) }
    }
  }

  /** 只查状态、不改状态：面板展示用（不触发派发）。 */
  async travelStatusAll(): Promise<unknown> {
    const storage = await loadStorage()
    if (storage === undefined) return { accounts: [] }
    const rows = []
    for (const entry of storage.accounts) {
      const identity = this.session?.identityFor(entry)
      const name = entry.account.label ?? entry.account.nickname
      if (identity === undefined) continue
      if (identity.enterpriseId !== undefined) {
        rows.push({ id: entry.id, name, ok: false, unsupported: true, buddyId: 0 })
        continue
      }
      const status = await fetchTravelStatus(resolveEntryEndpoint(entry), identity)
      rows.push({ id: entry.id, name, ...status })
    }
    return { accounts: rows }
  }

  /** 领取周期：只处理「已到达待领取」的账号，不派发、不换地点。
   *
   * 与派发周期分开是刻意的：到达时间可能落在两个 30 分钟派发点之间，
   * 15 分钟的领取节奏能更快把奖励落袋；反之只领取的轮次很轻（每账号一次
   * status + 可能的 claim），不会因为跑得太勤而反复试探地点列表。
   *
   * 只读 `traveling` → 到点后复查为 `arrived` 才领取；仍在途中的账号本轮不做
   * 任何写操作，所以与派发周期并发也不会重复派发。 */
  async runTravelClaimCycle(): Promise<{ status: string, claimed?: number, accounts: Array<{ id: string, name: string, result: string, state?: string, arriveAt?: number, locationName?: string, rewardCredit?: number, error?: string }> }> {
    if (!this.autoTravel) return { status: 'disabled', accounts: [] }
    const guard = this.travelClaimGuard.tryAcquire()
    if (guard === undefined) return { status: 'skipped', accounts: [] }
    try {
      const storage = await loadStorage()
      if (storage === undefined) return { status: 'no_accounts', accounts: [] }
      type ClaimRow = { id: string, name: string, result: string, state?: string, arriveAt?: number, locationName?: string, rewardCredit?: number, error?: string }
      const rows: ClaimRow[] = []
      for (const entry of storage.accounts) {
        const identity = this.session?.identityFor(entry)
        if (identity === undefined) continue
        const name = entry.account.label ?? entry.account.nickname
        const push = (row: Omit<ClaimRow, 'id' | 'name'>): void => { rows.push({ id: entry.id, name, ...row }) }
        // 与派发周期同一套准入：企业账号成长中心不可用，过期凭据无法访问。
        if (identity.enterpriseId !== undefined) {
          push({ result: 'skipped' })
          continue
        }
        if (entry.auth.refreshExpiresAt <= Date.now()) {
          push({ result: 'expired' })
          continue
        }
        try {
          const status = await fetchTravelStatus(resolveEntryEndpoint(entry), identity)
          if (!status.ok) {
            // 领取轮次把查询失败记为等待而非错误：下一轮会再试，不影响派发周期的退避计数。
            push({ result: status.unsupported === true ? 'skipped' : 'wait' })
            continue
          }
          if (status.state !== 'arrived') {
            // traveling / idle / 今日已旅行都不属于领取轮次的职责。
            push({
              result: status.state === 'traveling' ? 'traveling' : 'idle',
              ...status.state === undefined ? {} : { state: status.state },
              ...status.arriveAt === undefined ? {} : { arriveAt: status.arriveAt },
              ...status.locationName === undefined ? {} : { locationName: status.locationName },
            })
            continue
          }
          const claimed = await this.claimArrived(entry.id, resolveEntryEndpoint(entry), identity, status.recordId)
          if (claimed.ok) {
            push({
              result: 'claimed',
              state: 'idle',
              ...claimed.rewardCredit === undefined ? {} : { rewardCredit: claimed.rewardCredit },
            })
          } else if (claimed.busy === true) {
            // 派发周期正在领取同一账号：留到下一轮，不算错误。
            push({ result: 'claiming', state: 'arrived' })
          } else {
            push({ result: 'error', ...claimed.error === undefined ? {} : { error: claimed.error } })
          }
        } catch {
          push({ result: 'wait' })
        }
      }
      const claimedCount = rows.filter(row => row.result === 'claimed').length
      return { status: 'ok', accounts: rows, ...claimedCount === 0 ? {} : { claimed: claimedCount } }
    } finally {
      guard.release()
    }
  }

  /** 启动旅行周期：派发在启动时执行一次，之后每 30 分钟一次；领取在启动时
   *  执行一次，之后每 15 分钟一次，对应 workbuddy-switch 的
   *  TRAVEL_RETRY_INTERVAL / TRAVEL_CLAIM_INTERVAL 拆分。 */
  startTravelCycle(): void {
    if (this.disposed) return
    if (this.travelTimer === undefined) {
      void this.runTravelCycle()
      this.travelTimer = setInterval(() => { void this.runTravelCycle() }, 30 * 60_000)
    }
    if (this.travelClaimTimer === undefined) {
      // 这里刻意不立即执行：派发周期的启动轮已经处理过 arrived 账号，
      // 两个周期同时起步会让同一账号在启动瞬间被领取两次。重启后「不空等
      // 15 分钟」由派发周期的启动轮保证。
      this.travelClaimTimer = setInterval(() => { void this.runTravelClaimCycle() }, 15 * 60_000)
    }
  }

  stopTravelCycle(): void {
    if (this.travelTimer !== undefined) {
      clearInterval(this.travelTimer)
      this.travelTimer = undefined
    }
    if (this.travelClaimTimer !== undefined) {
      clearInterval(this.travelClaimTimer)
      this.travelClaimTimer = undefined
    }
  }

  /**
   * 广播「账号可见数据已变」，让两端视图重新拉取。
   *
   * 机制是 adapter replace → harness 的 `llm/adapters-updated` → 浏览器端
   * `accountEpoch` +1 → 面板与用量指示器重取。名字里的 "models" 来自它最初
   * 唯一的用途（账号切换后模型目录要换），但它在客户端承担的语义更宽：这是本
   * 插件**唯一**的跨视图同步通道，凡是改了「面板/指示器会展示的账号数据」都要
   * 走它。
   *
   * 为什么不能只在返回体里带上新数据就够了：RPC 的响应只回到**发起调用的那个
   * 组件**，另一个已挂载的视图（设置页 ↔ 管理面板都是常驻、不卸载）不会收到
   * 任何通知，会一直显示旧值。改名曾因此不同步——设置页改名后自己 `setAccounts`
   * 立即正确，面板却停留在旧备注名，直到用户手动刷新或碰巧发生别的广播。
   *
   * 因此调用时机是：**改了别处也会展示的账号数据就要调**，而不是「模型目录变了
   * 才调」。改名与模型目录无关，仍需要它。
   */
  private notifyModels(): void {
    // 先让 session 失效（调用方已做或这里再做一次无妨），再触发 harness 目录刷新。
    this.session?.invalidate()
    try { this.onActiveChanged?.() } catch { /* 广播失败不影响账号操作结果 */ }
  }

  /** 额度失败时是否允许自动切换当前账号。 */
  /**
   * Host 上是否读取到了**磁盘上已有的** auto-switch 配置。
   *
   * 用于区分两种情形：① 老用户首次升级（磁盘无配置，只有 localStorage 有）；
   * ② Host 已有权威配置。前者允许客户端一次性迁移，后者必须一律以 Host 为准，
   * 否则就是「用旧值覆盖新值」。
   */
  private prefsLoadedFromDisk = false

  autoSwitch = true
  /** 当前账号剩余额度低于该百分比时主动切换。 */
  autoSwitchThresholdPct = 10
  /**
   * 连续「每个账号探测都失败」的自动切换周期轮数（meter 对所有
   * 账号都不可达）。达到该轮数后，周期退避停止，直到下一轮探测
   * 成功——「所有账号都报错」应终止自动切换，而不是永远捶打
   * 一个死掉的 meter 平面。
   */
  private static readonly ALL_PROBE_FAILURE_LIMIT = 3
  /**
   * 连续全失败时退避：到阈值后放慢重试，冷却期满**自动恢复**。
   * 此前是到阈值就永久 return，那样计数再无下降机会，自动切换只能靠重启恢复。
   */
  private readonly autoSwitchBackoff = new BackoffGate(
    CodeBuddyAuthService.ALL_PROBE_FAILURE_LIMIT,
    5 * 60_000,
  )
  private autoSwitchTimer: ReturnType<typeof setInterval> | undefined
  private readonly autoSwitchGuard = new RunGuard('auto-switch')
  private readonly growthTasksGuard = new RunGuard('growth-tasks')

  /** 把已持久化的偏好推到 host 侧的门与周期。 */
  setAutoSwitchConfig(enabled: boolean, thresholdPct: number): void {
    this.autoSwitch = enabled
    this.autoSwitchThresholdPct = Math.max(0, Math.min(100, Math.round(thresholdPct)))
  }

  /**
   * 一次主动自动切换轮：对当前账号做低于阈值的检查，探测其余
   * 账号，并切换到其中最健康的那个。周期会记录连续「全部探测
   * 失败」的轮数，并在达到上限之后退避停止。
   */
  async runAutoSwitchCycle(): Promise<void> {
    if (!this.autoSwitch) return
    if (this.autoSwitchBackoff.shouldSkip()) return
    // 探针走远端 meter，慢网络下可能超过 30s 间隔：上一轮未结束时跳过本轮，
    // 避免叠加出重复的账号切换。
    const guard = this.autoSwitchGuard.tryAcquire()
    if (guard === undefined) return
    try {
      const before = await this.session?.activeAccountSummary()
      if (before === undefined) return
      let probed = false
      try {
        const result = await this.session?.failoverIfBelowThreshold(this.autoSwitchThresholdPct)
        probed = true
        // 任一探针成功即恢复正常节奏（含「无需切换」这种健康结果）。
        this.autoSwitchBackoff.succeed()
        if (result !== undefined) {
          // 主动阈值切换同样要刷新模型目录与消息框额度。
          this.notifyModels()
          this.logger?.info?.(`dsh-codebuddy: proactive switch "${result.from}" → "${result.to}" (${result.remaining}% remaining)`)
        }
        void before
      } catch (error) {
        // 抛异常的一轮意味着连当前账号的探测都出错了：在没有任何探测
        // 成功时把它记为一轮失败。
        if (!probed) {
          this.autoSwitchBackoff.fail()
          this.logger?.warn?.(`dsh-codebuddy: auto-switch probe failed (${this.autoSwitchBackoff.consecutiveFailures}/${CodeBuddyAuthService.ALL_PROBE_FAILURE_LIMIT})`)
          this.logger?.warn?.(error)
        }
      }
    } finally {
      guard.release()
    }
  }

  /**
   * 启动周期性主动检查（1 分钟节奏，廉价的 meter 探测）。
   *
   * 间隔的取舍：主动切换的价值是「无感」——额度将尽时下一个提问悄悄换号，用户
   * 不感知一次失败。这要求轮询（纯被动只在失败后才知道）。
   *
   * 但额度是**分钟级**变化的东西，30s 偏密：每次探测都是一次远端往返，而额度
   * 在一个 30s 窗口里的变化通常为零。1 分钟已足够让「快用完」被及时发现，同时
   * 把周期请求量减半。
   *
   * 叠加统探测的 30s TTL 缓存后，相邻两轮周期若落在同一 TTL 窗口内会直接命中
   * 缓存，实际远端请求进一步减少。
   */
  startAutoSwitchCycle(): void {
    if (this.disposed) return
    if (this.autoSwitchTimer !== undefined) return
    this.autoSwitchTimer = setInterval(() => { void this.runAutoSwitchCycle() }, AUTO_SWITCH_INTERVAL_MS)
  }

  stopAutoSwitchCycle(): void {
    if (this.autoSwitchTimer !== undefined) {
      clearInterval(this.autoSwitchTimer)
      this.autoSwitchTimer = undefined
    }
  }

  /** 把一个 RPC endpoint 路由到对应的 handler。 */
  private async dispatch(endpoint: string, payload: unknown, signal: AbortSignal): Promise<RpcOk<unknown> | RpcErr> {
    switch (endpoint) {
      case 'status': return ok(await this.status())
      case 'startLogin': {
        const raw = typeof payload === 'object' && payload !== null
          ? payload as {
            label?: unknown
            environment?: unknown
            endpoint?: unknown
            activate?: unknown
            client?: unknown
          }
          : undefined
        const label = typeof raw?.label === 'string' ? raw.label : undefined
        const environment = typeof raw?.environment === 'string' ? raw.environment : undefined
        const endpoint = typeof raw?.endpoint === 'string' ? raw.endpoint : undefined
        const activate = raw?.activate === undefined ? true : raw.activate === true
        // client 走 normalizeClientId 收敛：非法值一律回退 CLI，避免一个拼错的
        // 客户端名把端点解析带到错误的服务上。
        const client = raw?.client === undefined ? undefined : normalizeClientId(raw.client)
        return ok(await this.startLogin({
          ...(label === undefined ? {} : { label }),
          ...(environment === undefined ? {} : { environment }),
          ...(endpoint === undefined ? {} : { endpoint }),
          ...(client === undefined ? {} : { client }),
          activate,
        }))
      }
      case 'loginLink': {
        const raw = typeof payload === 'object' && payload !== null ? payload as { state?: unknown } : undefined
        const state = typeof raw?.state === 'string' ? raw.state : ''
        return ok(await this.loginLink(state))
      }
      case 'pollLogin': {
        const state = typeof payload === 'object' && payload !== null && 'state' in payload
          ? String((payload as { state: unknown }).state)
          : ''
        return ok(await this.pollLogin(state))
      }
      case 'logout': return ok(await this.logout())
      case 'usage': return ok(await this.usage())
      case 'accounts': return ok(await this.accounts())
      case 'removeAccount': {
        const id = typeof payload === 'object' && payload !== null && 'id' in payload
          ? String((payload as { id: unknown }).id)
          : ''
        return ok(await this.removeAccount(id))
      }
      case 'panelStatus': return ok(await this.panelStatus(signal))
      case 'checkinStatus': {
        const raw = typeof payload === 'object' && payload !== null ? payload as { id?: unknown } : undefined
        const id = typeof raw?.id === 'string' ? raw.id : undefined
        return ok(await this.checkinStatus(id, signal))
      }
      case 'checkin': {
        const raw = typeof payload === 'object' && payload !== null ? payload as { id?: unknown } : undefined
        const id = typeof raw?.id === 'string' ? raw.id : undefined
        return ok(await this.checkin(id, signal))
      }
      case 'checkinAll': return ok(await this.checkinAll(signal))
      case 'growthTasks': return ok(await this.growthTasksAll(signal))
      case 'growthRun': {
        const raw = typeof payload === 'object' && payload !== null ? payload as { id?: unknown, taskCode?: unknown } : undefined
        const id = typeof raw?.id === 'string' ? raw.id : ''
        const taskCode = typeof raw?.taskCode === 'string' ? raw.taskCode : ''
        if (id.length === 0 || taskCode.length === 0) return err('invalid-request', 'growthRun requires id and taskCode')
        return ok(await this.growthRunOne(id, taskCode, signal))
      }
      case 'growthRunAll': return ok(await this.growthRunAll(signal))
      case 'growthRunStatus': return ok(await this.growthRunStatus())
      case 'creditExpiry': return ok(await this.creditExpiryAll(signal))
      case 'tokenStats': {
        const raw = typeof payload === 'object' && payload !== null
          ? payload as { startTime?: unknown, endTime?: unknown, allTime?: unknown, sessionIds?: unknown }
          : undefined
        /**
         * 入参说明：原 `{days, allTime}` 改为 `{startTime, endTime, allTime}`。
         *
         * **端点必传**：服务端不再持有「现在」的概念——之前版本在缺端点时会退化
         * 到「以请求时刻为终点向前推 30 天」的兜底窗口，但这等于让同一个接口对
         * 不同请求得到不同窗口、且对客户端调试不透明。契约现在要求客户端负责
         * 「按钮的固定范围从当前时间倒退」的换算（`resolveRange` 完成），服务端
         * 只负责按端点过滤与按日聚合。缺端点直接拒收，让故障面立刻可见，而不是
         * 静默给一个错得没痕的数字。
         */
        if (typeof raw?.startTime !== 'number' || !Number.isFinite(raw.startTime)) {
          return err('invalid-request', 'tokenStats requires startTime (number)')
        }
        if (typeof raw?.endTime !== 'number' || !Number.isFinite(raw.endTime)) {
          return err('invalid-request', 'tokenStats requires endTime (number)')
        }
        if (raw.endTime < raw.startTime) {
          return err('invalid-request', 'tokenStats endTime must be >= startTime')
        }
        const allTime = raw?.allTime === true ? true : undefined
        const sessionIds = Array.isArray(raw?.sessionIds)
          ? raw.sessionIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
          : undefined
        return ok(await this.tokenStats({
          startTime: raw.startTime,
          endTime: raw.endTime,
          ...(allTime === undefined ? {} : { allTime }),
          ...(sessionIds === undefined ? {} : { sessionIds }),
        }, signal))
      }
      case 'autoPrefs': {
        /**
         * 只读端点：三个自动开关与阈值。客户端据此把 **Host 作为配置权威**。
         *
         * 在此之前 Host 对这几个偏好只写不读 —— 客户端 mount 时把 localStorage
         * 的值推上来，于是 Host 上更新的值（例如另一个窗口改过的）会在下次挂载
         * 时被**静默覆盖**。实测复现：Host 为 `{enabled:false, thresholdPct:25}`，
         * 被另一窗口的旧 localStorage 上推成 `{enabled:true, thresholdPct:10}`。
         *
         * 有了这个读通道，挂载改为「先读 Host → 写入本地 store（不推回）」，
         * 未迁移过的浏览器仍可通过下面的 `hasStoredPrefs` 走一次性迁移。
         */
        return ok({
          autoSwitch: this.autoSwitch,
          autoSwitchThresholdPct: this.autoSwitchThresholdPct,
          autoCheckin: this.autoCheckin,
          autoTravel: this.autoTravel,
          /**
           * Host 上是否已有**显式**持久化过的配置。
           *
           * `false` 表示 Host 只是用了默认值，此时允许客户端把已有的
           * localStorage 值迁移上来（老用户升级路径）；`true` 表示 Host 有真实
           * 配置，客户端必须无条件服从而不得反向覆盖。
           */
          hasStoredPrefs: this.prefsLoadedFromDisk,
        })
      }
      case 'autoSwitch': {
        const raw = typeof payload === 'object' && payload !== null
          ? payload as { enabled?: unknown, thresholdPct?: unknown }
          : undefined
        const enabled = raw?.enabled === true
        const thresholdPct = typeof raw?.thresholdPct === 'number' && Number.isFinite(raw.thresholdPct)
          ? Math.max(0, Math.min(100, Math.round(raw.thresholdPct)))
          : this.autoSwitchThresholdPct
        this.autoSwitch = enabled
        this.autoSwitchThresholdPct = thresholdPct
        if (enabled) this.startAutoSwitchCycle()
        else this.stopAutoSwitchCycle()
        // 吞掉 rejection：偏好落盘失败不应把请求变成失败（内存态已生效、
        // 本次会话可用），但也不能让它变成未处理拒绝——那会被 harness 的
        // fail-loud 捕获并终止进程，而 RPC 已经回过 ok 了。
        void saveAutoSwitchConfig({ enabled, thresholdPct }).catch((error: unknown) => {
          this.logger.warn('dsh-codebuddy: could not persist the auto-switch preference')
          this.logger.warn(error)
        })
        return ok({ enabled, thresholdPct })
      }
      case 'autoCheckin': {
        const raw = typeof payload === 'object' && payload !== null
          ? payload as { enabled?: unknown }
          : undefined
        const enabled = raw?.enabled === true
        this.autoCheckin = enabled
        if (enabled) this.startAutoCheckinCycle()
        else this.stopAutoCheckinCycle()
        void saveAutoCheckinConfig({ enabled }).catch((error: unknown) => {
          this.logger.warn('dsh-codebuddy: could not persist the auto-checkin preference')
          this.logger.warn(error)
        })
        return ok({ enabled })
      }
      case 'autoTravel': {
        const raw = typeof payload === 'object' && payload !== null
          ? payload as { enabled?: unknown }
          : undefined
        const enabled = raw?.enabled === true
        this.autoTravel = enabled
        if (enabled) this.startTravelCycle()
        else this.stopTravelCycle()
        void saveAutoTravelConfig({ enabled }).catch((error: unknown) => {
          this.logger.warn('dsh-codebuddy: could not persist the auto-travel preference')
          this.logger.warn(error)
        })
        return ok({ enabled })
      }
      case 'travelStatus': return ok(await this.travelStatusAll())
      case 'travelRun': return ok(await this.runTravelCycle())
      // 领取轮次单独暴露：面板的「立即领取」不该顺带派发新旅行。
      case 'travelClaim': return ok(await this.runTravelClaimCycle())
      case 'renameLabel': {
        const raw = typeof payload === 'object' && payload !== null
          ? payload as { id?: unknown, label?: unknown }
          : undefined
        const id = typeof raw?.id === 'string' ? raw.id : ''
        const label = typeof raw?.label === 'string' ? raw.label.trim().slice(0, 30) : undefined
        return ok(await this.renameLabel(id, label))
      }
      case 'switchAccount': {
        const id = typeof payload === 'object' && payload !== null && 'id' in payload
          ? String((payload as { id: unknown }).id)
          : ''
        return ok(await this.switchAccount(id))
      }
      default: return err('not-found', `unknown auth endpoint: ${endpoint}`)
    }
  }

  /** 把一个存储条目投影成其客户端视图。 */
  private projectEntry(storage: CodeBuddyStorage, index: number, activeId: string): CodeBuddyAccountView {
    const entry = storage.accounts[index]!
    const account = entry.account
    return {
      id: entry.id,
      nickname: account.nickname,
      ...account.label === undefined ? {} : { label: account.label },
      ...entry.environment === undefined ? {} : { environment: entry.environment },
      uid: account.uid,
      ...account.uin === undefined ? {} : { uin: account.uin },
      ...account.enterpriseId === undefined ? {} : { enterpriseId: account.enterpriseId },
      ...account.enterpriseName === undefined ? {} : { enterpriseName: account.enterpriseName },
      ...account.enterpriseUserName === undefined ? {} : { enterpriseUserName: account.enterpriseUserName },
      ...account.departmentFullName === undefined ? {} : { departmentFullName: account.departmentFullName },
      active: entry.id === activeId,
      expired: entry.auth.refreshExpiresAt <= Date.now(),
    }
  }

  /** 基于当前文档的账号投影。 */
  private async projectAccounts(): Promise<CodeBuddyAccountsResult> {
    const storage = await loadStorage()
    if (storage === undefined) return { loggedIn: false, accounts: [] }
    const activeId = storage.accounts.some(entry => entry.id === storage.activeId)
      ? storage.activeId
      : storage.accounts[0]!.id
    // 保持持久化的账号顺序，以获得稳定的账号展示顺序，
    // 以及一致的自动回退行为。
    const accounts = storage.accounts.map((_, index) => this.projectEntry(storage, index, activeId))
    const current = accounts.find(account => account.active) ?? accounts[0]
    return {
      loggedIn: true,
      accounts,
      ...(current === undefined ? {} : { current }),
    }
  }

  /**
   * 读取存储账号而不要求存在。
   * @returns 全部存储账号，当前账号在前。
   */
  async accounts(): Promise<CodeBuddyAccountsResult> {
    return this.projectAccounts()
  }

  /**
   * 按 id 移除一个存储账号。
   *
   * 移除当前账号时，会按存储顺序提升下一个条目，好让 harness
   * 继续保持以剩余账号登录的状态，而不会掉到未登录的状态。
   * 若把最后一个账号也给移除掉，则等于进入了未登录的最终状态。
   * 该操作完成后的返回值是移除之后的账号投影。
   * @param id - `accounts` 返回的本地账号 id。
   * @returns 移除后的账号投影。
   */
  async removeAccount(id: string): Promise<CodeBuddyAccountsChanged> {
    /**
     * 删除同样走 storage 事务。
     *
     * 这处尤其危险：若在锁外读到快照、删除后再整份回写，而期间另一个写入
     * （并发的 token 刷新、或另一次切换）刚保存过，就会把**已删除的账号复活**。
     * 锁内基于最新文档计算 `remaining` 才不会复活任何条目。
     */
    let emptied = false
    let activeChanged = false
    const outcome = await mutateStorage((storage) => {
      if (storage === undefined) return undefined
      const remaining = storage.accounts.filter(entry => entry.id !== id)
      if (remaining.length === storage.accounts.length) {
        // 未知 id：不做变更，原样返回账号列表。
        return undefined
      }
      if (remaining.length === 0) {
        emptied = true
        return undefined
      }
      const activeId = remaining.some(entry => entry.id === storage.activeId)
        ? storage.activeId
        : remaining[0]!.id
      activeChanged = activeId !== storage.activeId
      return { activeId, accounts: remaining }
    })
    // 全部删完：清空文档而不是写一个空 accounts（否则 loadStorage 视为损坏）。
    if (emptied) {
      await clearStorage()
      this.notifyModels()
      return { loggedIn: false, accounts: [] }
    }
    if (outcome === undefined) return this.projectAccounts()
    if (activeChanged) this.notifyModels()
    else this.session?.invalidate()
    return this.projectAccounts()
  }

  /**
   * 设置或清除一个账号的本地展示备注名。
   * @param id - `accounts` 返回的本地账号 id。
   * @param label - 新备注名（≤30 字符）；空串表示清除。
   * @returns 改名后的账号投影。
   */
  async renameLabel(id: string, label: string | undefined): Promise<CodeBuddyAccountsChanged> {
    const trimmed = label?.trim()
    /**
     * 本次是否真的改动了什么。
     *
     * 只有真改了才广播：备注名没变时（例如用户打开编辑框又原样确认）广播一次会让
     * 面板与用量指示器白跑一轮 `panelStatus`（含各账号的额度/签到/旅行探测），
     * 而结果是完全一样的。
     */
    let changed = false
    // 在锁内基于**最新**文档改动：锁外读到的快照可能已被并发写入替换，
    // 直接回写会整体覆盖那次改动（例如同时发生的账号切换）。
    await mutateStorage((storage) => {
      if (storage === undefined) return undefined
      const target = storage.accounts.find(entry => entry.id === id)
      if (target === undefined) return undefined
      // 清除（空串/无值）与目标已有 label 为空、或新值与现值相同：都无需写入。
      const next = trimmed === undefined || trimmed.length === 0 ? undefined : trimmed
      if (target.account.label === next) return undefined
      changed = true
      return {
        ...storage,
        accounts: storage.accounts.map(entry => {
          if (entry.id !== id) return entry
          const account = { ...entry.account }
          if (next === undefined) delete account.label
          else account.label = next
          return { ...entry, account }
        }),
      }
    })
    /**
     * 广播给**其它已挂载的视图**（改名后必须做）。
     *
     * 返回体只回到发起调用的那个组件：设置页改名后自己会用响应刷新，但管理面板
     * 是常驻不卸载的（`shell.overlay` 常驻，仅 `snapshot.active` 为 false 时
     * return null），它只认 `accountEpoch` 变化，否则会一直显示旧备注名。
     * 这条广播此前漏了，是设置页改名与面板不一致的根因。
     */
    if (changed) this.notifyModels()
    this.session?.invalidate()
    return this.projectAccounts()
  }

  /**
   * 把一个存储账号设为当前账号。
   * @param id - `accounts` 返回的本地账号 id。
   * @returns 切换后的账号投影。
   */
  async switchAccount(id: string): Promise<CodeBuddyAccountsChanged> {
    /**
     * 读-改-写走 storage 事务：与 session 的切换、改名、删除、登录互斥。
     *
     * 锁外先读一份快照再回写，会整体覆盖并发写入（例如「切换」与「改名」同时
     * 发生时，后写的把前一次的结果丢掉）。
     */
    let activeChanged = false
    const outcome = await mutateStorage((current) => {
      if (current === undefined) return undefined
      if (!current.accounts.some(entry => entry.id === id)) return undefined
      if (current.activeId === id) {
        // 已是当前账号：无需写入，仍失效一次以重读最新凭据（防文件被外部刷新）。
        return undefined
      }
      activeChanged = true
      return { ...current, activeId: id }
    })
    void outcome
    this.session?.invalidate()
    if (activeChanged) this.notifyModels()
    return this.projectAccounts()
  }

  /**
   * 读取当前账号的凭据而不要求存在。
   * @returns 当前鉴权状态；没有存储内容时 `loggedIn` 为 false。
   */
  async status(): Promise<CodeBuddyAuthStatus> {
    const stored = await loadStorage()
    if (stored === undefined) {
      return { loggedIn: false }
    }
    const active = activeEntry(stored)
    return {
      loggedIn: true,
      nickname: active.account.nickname,
      uid: active.account.uid,
      ...active.account.uin === undefined ? {} : { uin: active.account.uin },
      ...active.account.enterpriseId === undefined ? {} : { enterpriseId: active.account.enterpriseId },
      ...active.account.enterpriseName === undefined ? {} : { enterpriseName: active.account.enterpriseName },
      ...active.account.enterpriseUserName === undefined ? {} : { enterpriseUserName: active.account.enterpriseUserName },
      ...active.account.departmentFullName === undefined ? {} : { departmentFullName: active.account.departmentFullName },
    }
  }

  /**
   * 针对请求的环境发起一次浏览器登录握手。
   * @param options - `label`（本地显示名）、`environment`
   *   （`CODEBUDDY_INTERNET_ENVIRONMENT` 值）和 `endpoint`
   *   （cloudhosted/selfhosted 的显式服务根地址）。
   * @returns 用户需要打开的 URL。
   */
  async startLogin(options: {
    label?: string
    environment?: string
    endpoint?: string
    activate?: boolean
    client?: CodeBuddyClientId
  } = {}): Promise<CodeBuddyLoginStart> {
    const client = normalizeClientId(options.client)
    const environment = options.environment?.trim().toLowerCase()
    // cloudhosted/selfhosted 没有默认端点：必须显式给出，否则握手会
    // 打到错误的主机。
    const explicitEndpoint = options.endpoint?.trim().replace(/\/+$/, '')
    const defaultEndpoint = CODEBUDDY_ENVIRONMENT_ENDPOINTS[CODEBUDDY_DEFAULT_ENVIRONMENT as Exclude<CodeBuddyEnvironment, 'cloudhosted' | 'selfhosted'>]
    // 显式端点优先；WorkBuddy 客户端固定走自己的服务地址（与环境无关）。
    const endpoint = explicitEndpoint !== undefined && explicitEndpoint.length > 0
      ? explicitEndpoint
      : client !== 'cli'
        ? CODEBUDDY_CLIENT_ENDPOINTS[client]
        : environment !== undefined && environment in CODEBUDDY_ENVIRONMENT_ENDPOINTS
          ? CODEBUDDY_ENVIRONMENT_ENDPOINTS[environment as Exclude<CodeBuddyEnvironment, 'cloudhosted' | 'selfhosted'>]
          : defaultEndpoint
    const handshake = await requestAuthState(endpoint, client)
    const pending: PendingLogin = {
      state: handshake.state,
      authUrl: handshake.authUrl,
      promise: this.runLogin(endpoint, handshake.state, { ...options, client }),
    }
    this.pending.set(handshake.state, pending)
    // 握手无论成败、一旦落定就回收该条目，避免被用户放弃的登录
    // 让这张表无界增长。
    void pending.promise.finally(() => {
      if (this.pending.get(handshake.state) === pending) {
        this.pending.delete(handshake.state)
      }
    })
    return { authUrl: handshake.authUrl, state: handshake.state }
  }

  /**
   * 已发起握手的登录 URL——与 host 打开的是**同一个**链接。
   * 供复制按钮使用，让跨设备授权共享同一条链接。
   * @param state - `startLogin` 返回的握手 id。
   * @returns 该链接；握手未知/已过期时为 `undefined`。
   */
  async loginLink(state: string): Promise<string | undefined> {
    return this.pending.get(state)?.authUrl
  }

  /**
   * 检查已发起的握手是否已完成。
   * @param state - `startLogin` 返回的握手 id。
   * @returns 登录是否完成且凭据已持久化。
   */
  async pollLogin(state: string): Promise<CodeBuddyLoginPoll> {
    const pending = this.pending.get(state)
    if (pending === undefined) {
      // 未知/已被回收的 state：以未完成而非错误呈现，因为客户端的轮询
      // 循环可能比条目多活一拍。
      return { done: false }
    }
    const entry = await pending.promise
    if (entry !== undefined) return { done: true, nickname: entry.account.nickname }
    // 失败必须说出来：此前只回 { done: false }，与「用户还没点完登录」无法区分，
    // 前端会一直轮询到 10 分钟超时，用户既看不到原因也不知道该重试。
    return {
      done: false,
      ...pending.failure === undefined ? {} : { error: pending.failure },
    }
  }

  /** 移除全部存储账号。 */
  async logout(): Promise<void> {
    await clearStorage()
    this.notifyModels()
  }

  /**
   * 读取设置页所需的 CodeBuddy 用量快照。
   *
   * 委托给 session 处理：session 会在读取 meter 前先解析出一个
   * 刷新过的身份，并且在 meter 故障时绝不抛出。未登录的账号以
   * `loggedIn: false` 加空 windows 呈现，好让客户端隐藏该呈现，
   * 而不是渲染一条坏掉进度条。
   * @returns 用量投影；没有存储内容时返回未登录形状。
   */
  async usage(): Promise<CodeBuddyUsageResult> {
    const snapshot: UsageSnapshot | undefined = await this.session?.usage()
    if (snapshot === undefined) {
      return { loggedIn: false, windows: [] }
    }
    const windows = snapshot.windows.map(projectWindow)
    const primary = snapshot.primary !== undefined ? projectWindow(snapshot.primary) : undefined
    return { loggedIn: true, windows, ...primary === undefined ? {} : { primary } }
  }

  /**
   * 把一次握手驱动成一个已持久化的凭据。
   *
   * 使用 `buildAccountEntry`，确保落盘的形状与所有消费方读取
   * 到的完全一致。完成的登录会追加一个新条目，并将其设为当前
   * 账号；对已在库中的账号重新登录，会替换该账号的条目（按 uid
   * 去重），而不是复制一份。任何失败都会返回 `undefined`，让
   * 客户端的轮询 resolve 为 `done: false`，并允许从 `startLogin`
   * 重试。
   */
  private async runLogin(
    endpoint: string,
    state: string,
    options: {
      label?: string
      environment?: string
      endpoint?: string
      activate?: boolean
      client?: CodeBuddyClientId
    } = {},
  ): Promise<CodeBuddyAccountEntry | undefined> {
    try {
      const token = await pollAuthToken(endpoint, state)
      if (token === undefined) return undefined
      const account = await getLoginAccount(endpoint, state, token.accessToken, token.domain)
      const fresh = buildAccountEntry(token, account, options)
      /**
       * 本次登录是否**显式**指定了客户端。
       *
       * `options.client` 为 undefined 时 `buildAccountEntry` 会按 `cli` 落一个值，
       * 因此不能只看 `fresh.client` 是否为空。重新登录（设置页的「重新登录」）不会
       * 带客户端，若此时用 fresh 覆盖，会把 WorkBuddy 账号静默改成 CLI，
       * 之后请求发往错误的服务平面、凭据不被承认。
       */
      const clientSpecified = options.client !== undefined
      /**
       * 本次登录是否**显式**指定了备注名。
       *
       * 与 `clientSpecified` 同理：`buildAccountEntry` 会在未指定时把 label 回落成
       * 昵称，因此不能靠 `fresh.account.label` 是否为空来判断「用户有没有填」。
       * 重新登录不带 label，若按结果判断就会把用户设的备注名覆盖成昵称。
       */
      const labelSpecified = options.label !== undefined && options.label.trim().length > 0
      const stored = await loadStorage()
      // 同 uid 的已有条目（若存在）会保留其本地的 id 与位置；其凭据
      // 则会被新凭据给替换掉。全新的账号则会被追加进列表，并成为
      // 当前的账号。新的 label 会覆盖旧的；而空 label 则会保留原有
      // 的取值。
      const existing = stored?.accounts.find(entry => entry.account.uid === account.uid)
      // 本次登录会成为当前账号，除非调用方明确要求了保留当前账号
      // （对离线账号的重新登录来说，它是不能去抢走此前下线期间接管了
      // 流量的那个账号的）。
      const activate = options.activate !== false
      let next: CodeBuddyStorage
      if (stored === undefined) {
        // 首个账号必须成为当前账号（`nextActiveId` 在 current 为空时无视 activate），
        // 否则会留下「有账号却没有当前账号」的空悬状态。
        next = { activeId: nextActiveId(undefined, fresh.id, activate), accounts: [fresh] }
      } else if (existing !== undefined) {
        /**
         * 保留用户自定义的备注名。
         *
         * 判据必须是「**本次登录是否显式指定了 label**」，不能看
         * `fresh.account.label` 是否为空 —— `buildAccountEntry` 现在会在未指定时把
         * label 回落成昵称，于是它恒有值，「重新登录」会把用户设的备注名覆盖成昵称
         * （实测：`公司账号` 被 `m6440216j102` 覆盖）。
         *
         * 与下面的 `clientSpecified` 同一模式：用「调用方有没有给」判断，而不是用
         * 「结果里有没有」判断。
         *
         * 四种组合：本次给了 → 用新值（首次设定或用户改写）；
         * 本次没给 + 旧条目有 → 保留用户备注名；本次没给 + 旧条目也没有 → 沿用
         * `fresh` 里回落好的昵称。
         */
        const effectiveLabel = labelSpecified
          ? fresh.account.label
          : existing.account.label ?? fresh.account.label
        const replaced: CodeBuddyAccountEntry = {
          ...fresh,
          id: existing.id,
          account: {
            ...fresh.account,
            ...effectiveLabel === undefined ? {} : { label: effectiveLabel },
          },
          // 客户端标识：**仅当本次登录显式指定时**才以此为准（同一 uid 先用 CLI
          // 登录、后用 WorkBuddy 登录，端点与版本必须跟着换）；未指定时保留原值，
          // 否则「重新登录」会把 WorkBuddy 账号降级成 CLI。
          ...clientSpecified
            ? {
                ...fresh.client === undefined ? {} : { client: fresh.client },
                ...fresh.clientVersion === undefined ? {} : { clientVersion: fresh.clientVersion },
              }
            : {
                ...existing.client === undefined ? {} : { client: existing.client },
                ...existing.clientVersion === undefined ? {} : { clientVersion: existing.clientVersion },
              },
        }
        const wasActive = stored.activeId === existing.id
        next = {
          activeId: nextActiveId(stored.activeId, replaced.id, activate, wasActive),
          accounts: stored.accounts.map(entry => entry.id === existing.id ? replaced : entry),
        }
      } else {
        next = {
          activeId: nextActiveId(stored.activeId, fresh.id, activate),
          accounts: [...stored.accounts, fresh],
        }
      }
      await saveStorage(next)
      this.notifyModels()
      return fresh
    } catch (error) {
      // 传输或服务层面的失败都会终结本次握手；客户端可以从
      // `startLogin` 重试。但**必须把原因带回**：静默返回 undefined 会让
      // 前端一直轮询到超时，用户看不到失败原因（workbuddy 登录无反应即由此而来）。
      // 原因写在本次握手的 pending 条目上，而不是实例字段——并发登录时后者会串台。
      const pendingEntry = this.pending.get(state)
      if (pendingEntry !== undefined) {
        pendingEntry.failure = error instanceof Error ? error.message : String(error)
      }
      return undefined
    }
  }

  /**
   * 签到/积分面板共用：按账号探测。遍历每个存储账号，用其自身的
   * environment/endpoint 解析身份并调用 meter 平面；单账号失败不影响其他。
   *
   * 各账号之间没有依赖，因此并发探测：串行时每个账号 3 个请求首尾相接，
   * 4 个账号的面板刷新要 400ms 以上，而并发只需最慢那一个账号的时间。
   * 结果按账号存储顺序回填，卡片顺序不会随响应快慢抖动。
   */
  private async forEachAccount<T>(fn: (item: {
    id: string
    name: string
    environment: string | undefined
    endpoint: string
    identity: CodeBuddyIdentity
    expired: boolean
    enterprise: boolean
    client: CodeBuddyClientId
    clientVersion: string
    /**
     * 账户身份明细：面板的「账户信息」弹框据此展示完整资料。
     *
     * 这些字段此前只存在于设置页（它直接读 `accounts` RPC），面板的
     * `panelStatus` 没有带上，于是面板侧的弹框只能显示昵称——同一个账号在
     * 两个入口看到的信息量不一致。缺失一律为 `undefined`（而非空串），
     * 便于前端按「有无」决定是否渲染该行。
     */
    account: {
      uid: string
      nickname: string
      /** 本地备注名；仅当与昵称不同才有展示价值。 */
      label?: string
      uin?: string
      enterpriseId?: string
      enterpriseName?: string
      enterpriseUserName?: string
      departmentFullName?: string
    }
  }) => Promise<T>, signal?: AbortSignal): Promise<T[]> {
    const storage = await loadStorage()
    if (storage === undefined) return []
    const slots: Array<T | undefined> = Array.from<T | undefined>({ length: storage.accounts.length }).fill(undefined)
    // 每个账号的探测是 2–3 个并发请求，账号数较多时全量铺开会给 meter 平面
    // 造成瞬时压力；限制同时在跑的账号数即可兼顾延迟与礼貌。
    await mapWithConcurrency(storage.accounts, CONCURRENCY, async (entry, index) => {
      try {
        const identity = this.session?.identityFor(entry)
        if (identity === undefined) return
        slots[index] = await fn({
          id: entry.id,
          name: entry.account.label ?? entry.account.nickname,
          environment: entry.environment,
          endpoint: resolveEntryEndpoint(entry),
          identity,
          expired: entry.auth.refreshExpiresAt <= Date.now(),
          enterprise: identity.enterpriseId !== undefined,
          // 客户端身份与其固定版本：面板据此展示标识，用户可分辨账号来源。
          client: normalizeClientId(entry.client),
          clientVersion: entry.clientVersion ?? CODEBUDDY_CLIENT_VERSIONS[normalizeClientId(entry.client)],
          // 账户身份明细，供「账户信息」弹框展示。
          account: {
            uid: entry.account.uid,
            nickname: entry.account.nickname,
            ...entry.account.label === undefined ? {} : { label: entry.account.label },
            ...entry.account.uin === undefined ? {} : { uin: entry.account.uin },
            ...entry.account.enterpriseId === undefined ? {} : { enterpriseId: entry.account.enterpriseId },
            ...entry.account.enterpriseName === undefined ? {} : { enterpriseName: entry.account.enterpriseName },
            ...entry.account.enterpriseUserName === undefined
              ? {}
              : { enterpriseUserName: entry.account.enterpriseUserName },
            ...entry.account.departmentFullName === undefined
              ? {}
              : { departmentFullName: entry.account.departmentFullName },
          },
        })
      } catch {
        // 单账号失败跳过，不阻断其他账号；该位置保持 undefined 并被过滤。
      }
    })
    void signal
    return slots.filter((slot): slot is T => slot !== undefined)
  }

  /**
   * 面板聚合：一次返回全部账号的卡片数据（身份 + 剩余额度资源 + 今日签到）。
   * 每个账号独立探测自己的 endpoint/meter；单账号失败不影响其余账号，
   * 失败账号的字段以 null/空数组表达，前端可据此决定禁用/占位。
   */
  async panelStatus(signal?: AbortSignal): Promise<unknown> {
    const storage = await loadStorage()
    if (storage === undefined) return { accounts: [], currentId: undefined }
    const activeId = storage.activeId
    const rows = await this.forEachAccount(async item => {
      // 企业账号不支持签到，也不支持成长中心（旅行）：都不探测。
      // 额度走统一探测缓存（与切换策略共用同一份快照，且 30s 内的重复刷新不打远端）；
      // 签到与旅行是**状态查询**不是额度，仍各自直连。
      // session 缺席（无持久化/查询能力的 profile）时退回直连探测，保持可用。
      const usageResult: Promise<ProbeOutcome> = this.session === undefined
        ? fetchUsage(item.endpoint, item.identity, signal).then(
            (snapshot): ProbeOutcome => ({ snapshot, probedAt: Date.now(), fromCache: false }),
            (): ProbeOutcome => ({ snapshot: undefined, probedAt: Date.now(), fromCache: false, error: 'probe failed' }),
          )
        : this.session.usageProbes
          .probeAccount(item.id, item.endpoint, item.identity, signal === undefined ? {} : { signal })
      const outcome = await usageResult.catch(
        (): ProbeOutcome => ({ snapshot: undefined, probedAt: Date.now(), fromCache: false, error: 'probe failed' }),
      )
      const snapshot = outcome.snapshot
      const [checkin, travel] = item.enterprise
        ? [{ ok: false, todayCheckedIn: false }, undefined]
        : await Promise.all([
          getCheckinStatus(item.endpoint, item.identity, signal).catch(() => ({ ok: false, todayCheckedIn: false, error: 'probe failed' })),
          fetchTravelStatus(item.endpoint, item.identity, signal).catch(() => undefined),
        ])
      // 资源：合并为“剩余额度”“总量”“最近到期”语义（align wb 卡片）
      const resources = (snapshot?.windows ?? []).map(w => ({
        name: w.name,
        total: w.limit ?? null,
        remaining: w.limit !== undefined && w.used !== undefined ? w.limit - w.used : null,
        remainingPct: w.usedPercent === undefined ? null : Math.round(100 - w.usedPercent),
        used: w.used ?? null,
        resetsAt: w.resetsAt ?? null,
      }))
      const totalRemaining = resources.reduce((sum, r) => sum + (r.remaining ?? 0), 0)
      const totalCapacity = resources.reduce((sum, r) => sum + (r.total ?? 0), 0)
      const usable = !item.expired && resources.some(r => (r.remaining ?? 0) > 0)
      return {
        id: item.id,
        name: item.name,
        nickname: item.name,
        environment: item.environment,
        client: item.client,
        clientVersion: item.clientVersion,
        // 服务端点：企业账号常走自建/专享地址，排查「为何这个账号查不到额度」
        // 时需要确认请求实际发往哪里。
        endpoint: item.endpoint,
        // 账户身份明细（弹框展示完整信息用）
        account: item.account,
        active: item.id === activeId,
        expired: item.expired,
        enterprise: item.enterprise,
        // 额度面状态
        creditOk: snapshot !== undefined,
        totalRemaining,
        totalCapacity,
        resources,
        /**
         * 该额度数据的产出时刻（epoch ms）与是否来自缓存。
         *
         * 面板据此显示「数据时间」与「来自缓存」——统探测带 30s TTL，不显示的话
         * 用户无法分辨「刚刷新过」与「看到的是 20 秒前的数据」。
         */
        probedAt: outcome.probedAt,
        probedFromCache: outcome.fromCache,
        /**
         * 探测失败的原因。
         *
         * 与「额度为 0」严格区分：失败是「没查成」，0 是「查到了确实没有」。
         * 面板据此显示不同的空状态，而不是把两者都说成「无可用额度」。
         */
        probeError: snapshot === undefined ? (outcome.error ?? 'meter unreachable') : null,
        // 签到状态
        checkinOk: checkin.ok,
        todayCheckedIn: checkin.ok ? checkin.todayCheckedIn : null,
        checkinError: checkin.ok ? null : ('error' in checkin ? checkin.error ?? 'probe failed' : undefined),
        // 旅行状态（成长中心；企业账号与查询失败为 null）
        travel: travel === undefined || !travel.ok
          ? null
          : {
              state: travel.state ?? null,
              buddyId: travel.buddyId,
              locationName: travel.locationName ?? null,
              arriveAt: travel.arriveAt,
              serverNow: travel.serverNow,
              dailyLimitReached: travel.dailyLimitReached,
              rewardCredit: travel.rewardCredit,
            },
        // 前端据此禁用“设为当前/选择账号”：无余额或查询失败都不可接管
        usable,
      }
    }, signal)
    return { accounts: rows, currentId: activeId }
  }

  /** 面板：查询全部账号的今日签到状态（企业账号跳过）。 */
  async checkinStatus(_id: string | undefined, signal?: AbortSignal): Promise<unknown> {
    const rows = await this.forEachAccount(async item => {
      if (item.enterprise) return { id: item.id, name: item.name, environment: item.environment, ok: false, enterprise: true }
      const status = await getCheckinStatus(item.endpoint, item.identity, signal)
      return { id: item.id, name: item.name, environment: item.environment, ok: status.ok, todayCheckedIn: status.todayCheckedIn, error: status.error }
    }, signal)
    return { accounts: rows }
  }

  /** 面板：对所有账号签到（一键/单账号共用，id 缺省=全部；企业账号不支持签到）。 */
  async checkin(id: string | undefined, signal?: AbortSignal): Promise<unknown> {
    const rows = await this.forEachAccount(async item => {
      if (item.enterprise) {
        return { id: item.id, name: item.name, environment: item.environment, result: 'skipped', error: 'enterprise account does not support check-in' }
      }
      if (id !== undefined && item.id !== id) {
        return { id: item.id, name: item.name, environment: item.environment, skipped: true }
      }
      const status = await getCheckinStatus(item.endpoint, item.identity, signal)
      if (status.ok && status.todayCheckedIn) return { id: item.id, name: item.name, environment: item.environment, result: 'already' }
      if (!status.ok) return { id: item.id, name: item.name, environment: item.environment, result: 'error', error: status.error }
      const res = await performCheckin(item.endpoint, item.identity, signal)
      return res.ok
        ? { id: item.id, name: item.name, environment: item.environment, result: res.already === true ? 'already' : 'success' }
        : { id: item.id, name: item.name, environment: item.environment, result: 'error', error: res.error }
    }, signal)
    return { accounts: rows }
  }

  /** 面板：一键全部签到。 */
  async checkinAll(signal?: AbortSignal): Promise<unknown> {
    return this.checkin(undefined, signal)
  }

  /** 面板：读取全部账号的成长任务列表；单账号失败不阻断其他账号。 */
  async growthTasksAll(signal?: AbortSignal): Promise<unknown> {
    const rows = await this.forEachAccount(async item => {
      if (item.expired) {
        return { id: item.id, name: item.name, client: item.client, tasks: [], error: 'refresh token expired' }
      }
      try {
        const tasks = await listGrowthTasks(item.identity, signal)
        return { id: item.id, name: item.name, client: item.client, tasks }
      } catch (error) {
        return {
          id: item.id,
          name: item.name,
          client: item.client,
          tasks: [],
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }, signal)
    return { accounts: rows }
  }

  /**
   * 管理后台单条成长任务执行：只处理指定账号与任务，不触发其它账号。
   *
   * 运行状态落盘（`beginGrowthRun`/`finishGrowthRun`），刷新页面后客户端能
   * 从宿主恢复 loading，不会把正在跑的任务显示成可再次点击。
   */
  async growthRunOne(id: string, taskCode: string, signal?: AbortSignal): Promise<unknown> {
    const guard = this.growthTasksGuard.tryAcquire()
    if (guard === undefined) return { status: 'skipped', error: 'growth task run already in progress' }
    await beginGrowthRun('one', { accountId: id, taskCode })
    try {
      const rows = await this.forEachAccount(async item => {
        if (item.id !== id) return undefined
        if (item.expired) {
          await appendGrowthRunLog({ account: item.name, code: taskCode, status: 'error', message: 'refresh token expired' }).catch(() => {})
          return { id: item.id, name: item.name, client: item.client, status: 'error', items: [], error: 'refresh token expired' }
        }
        const tasks = await listGrowthTasks(item.identity, signal)
        const task = tasks.find(candidate => candidate.taskCode === taskCode)
        if (task === undefined) {
          await appendGrowthRunLog({ account: item.name, code: taskCode, status: 'error', message: '账号下没有该任务' }).catch(() => {})
          return { id: item.id, name: item.name, client: item.client, status: 'error', items: [], error: 'task not found' }
        }
        if (!isAutomatableGrowthTask(task)) {
          await appendGrowthRunLog({ account: item.name, code: task.taskCode, status: 'unsupported', message: task.automationReason ?? 'manual task' }).catch(() => {})
          return { id: item.id, name: item.name, client: item.client, status: 'ok', items: [{ code: task.taskCode, status: 'unsupported', current: task.current, target: task.target, error: task.automationReason ?? 'manual task' }] }
        }
        if (task.acceptStatus !== 'accepted' && task.acceptStatus !== 'completed') {
          await acceptGrowthTasks(item.identity, [task.taskCode], signal)
        }
        let latest = task
        if (!latest.claimable) {
          const action = await runGrowthTaskAction(item.identity, task.taskCode, task.current, task.target, signal)
          if (!action.supported) {
            await appendGrowthRunLog({ account: item.name, code: task.taskCode, status: 'unsupported', message: action.message }).catch(() => {})
            return { id: item.id, name: item.name, client: item.client, status: 'ok', items: [{ code: task.taskCode, status: 'unsupported', current: task.current, target: task.target, error: action.message }] }
          }
          for (let attempt = 0; attempt < GROWTH_POLL_ATTEMPTS; attempt += 1) {
            if (attempt > 0) await waitForGrowthPoll(signal)
            const refreshed = await listGrowthTasks(item.identity, signal)
            latest = refreshed.find(candidate => candidate.taskCode === task.taskCode) ?? latest
            if (latest.claimable || latest.claimed) break
          }
        }
        if (!latest.claimable) {
          await appendGrowthRunLog({ account: item.name, code: task.taskCode, status: 'pending', message: `进度 ${latest.current}/${latest.target}，未达标` }).catch(() => {})
          return { id: item.id, name: item.name, client: item.client, status: 'ok', items: [{ code: task.taskCode, status: 'pending', current: latest.current, target: latest.target }] }
        }
        const claim = await claimGrowthTask(item.identity, task.taskCode, signal)
        const status = claim.alreadyClaimed ? 'already' : 'claimed'
        await appendGrowthRunLog({
          account: item.name,
          code: task.taskCode,
          status,
          ...claim.alreadyClaimed
            ? { message: '奖励此前已领取' }
            : { message: `领奖 +${claim.credit} 积分 +${claim.energy} 能量` },
        }).catch(() => {})
        return { id: item.id, name: item.name, client: item.client, status: 'ok', items: [{ code: task.taskCode, status, credit: claim.credit, energy: claim.energy }] }
      }, signal)
      const account = rows.find(row => row !== undefined)
      const outcome = account === undefined ? { status: 'error', error: 'account not found' } : account
      await finishGrowthRun(`${taskCode}:${String((outcome as { status?: unknown }).status ?? 'unknown')}`)
      return outcome
    } catch (error) {
      await finishGrowthRun(`${taskCode}:error`).catch(() => {})
      return { status: 'error', error: error instanceof Error ? error.message : String(error) }
    } finally {
      guard.release()
    }
  }

  /** 管理后台读取当前成长任务执行状态（刷新页面后恢复 loading 用）。 */
  async growthRunStatus(): Promise<unknown> {
    const state = await loadGrowthRunState()
    if (state === undefined) return { running: false, inFlight: this.growthTasksGuard.isRunning }
    // 内存与磁盘取或：进程内正在跑但还没落盘的瞬间也不该显示成空闲。
    return { ...state, running: state.running || this.growthTasksGuard.isRunning }
  }

  /**
   * 管理后台「一键完成成长任务」：报名、执行已移植动作、轮询进度并领奖。
   * 未移植动作明确返回 unsupported，不会被误当成完成，也不会进入隐藏的副作用路径。
   */
  async growthRunAll(signal?: AbortSignal): Promise<unknown> {
    const guard = this.growthTasksGuard.tryAcquire()
    if (guard === undefined) return { status: 'skipped', accounts: [] }
    await beginGrowthRun('all')
    try {
      const rows = await this.forEachAccount(async item => {
        // 账号级日志：让抽屉里能看到「这个号被跳过/失败了」而不只是没有输出。
        if (item.expired) {
          await appendGrowthRunLog({ account: item.name, code: '-', status: 'error', message: 'refresh token expired' }).catch(() => {})
          return { id: item.id, name: item.name, client: item.client, status: 'error', items: [], error: 'refresh token expired' }
        }
        try {
          const tasks = await listGrowthTasks(item.identity, signal)
          // 按依赖序排列：领养（first_buddy）必须先执行，它产出的 Buddy 是旅行前提。
          const pending = sortGrowthTasksByOrder(tasks.filter(isAutomatableGrowthTask))
          const acceptCodes = pending
            .filter(task => task.acceptStatus !== 'accepted' && task.acceptStatus !== 'completed')
            .map(task => task.taskCode)
          let acceptError: string | undefined
          try {
            await acceptGrowthTasks(item.identity, acceptCodes, signal)
            if (acceptCodes.length > 0) {
              await appendGrowthRunLog({ account: item.name, code: '-', status: 'accepted', message: `报名 ${acceptCodes.length} 个任务` }).catch(() => {})
            }
          } catch (error) {
            acceptError = error instanceof Error ? error.message : String(error)
            await appendGrowthRunLog({ account: item.name, code: '-', status: 'error', message: `报名失败：${acceptError}` }).catch(() => {})
          }
          const items = [] as Array<Record<string, unknown>>
          for (const task of pending) {
            let latest = task
            if (!latest.claimable) {
              try {
                const action = await runGrowthTaskAction(item.identity, task.taskCode, task.current, task.target, signal)
                if (!action.supported) {
                  await appendGrowthRunLog({ account: item.name, code: task.taskCode, status: 'unsupported', message: action.message }).catch(() => {})
                  items.push({ code: task.taskCode, status: 'unsupported', current: task.current, target: task.target, error: action.message })
                  continue
                }
                for (let attempt = 0; attempt < GROWTH_POLL_ATTEMPTS; attempt += 1) {
                  if (attempt > 0) await waitForGrowthPoll(signal)
                  const refreshed = await listGrowthTasks(item.identity, signal)
                  latest = refreshed.find(candidate => candidate.taskCode === task.taskCode) ?? latest
                  if (latest.claimable || latest.claimed) break
                }
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                await appendGrowthRunLog({ account: item.name, code: task.taskCode, status: 'error', message }).catch(() => {})
                items.push({ code: task.taskCode, status: 'error', current: task.current, target: task.target, error: message })
                continue
              }
            }
            if (!latest.claimable) {
              await appendGrowthRunLog({ account: item.name, code: task.taskCode, status: 'pending', message: `进度 ${latest.current}/${latest.target}，未达标` }).catch(() => {})
              items.push({ code: task.taskCode, status: 'pending', current: latest.current, target: latest.target })
              continue
            }
            try {
              const claim = await claimGrowthTask(item.identity, task.taskCode, signal)
              const status = claim.alreadyClaimed ? 'already' : 'claimed'
              await appendGrowthRunLog({
                account: item.name,
                code: task.taskCode,
                status,
                ...claim.alreadyClaimed
                  ? { message: '奖励此前已领取' }
                  : { message: `领奖 +${claim.credit} 积分 +${claim.energy} 能量` },
              }).catch(() => {})
              items.push({
                code: task.taskCode,
                status,
                credit: claim.credit,
                energy: claim.energy,
              })
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              await appendGrowthRunLog({ account: item.name, code: task.taskCode, status: 'error', message: `领奖失败：${message}` }).catch(() => {})
              items.push({ code: task.taskCode, status: 'error', error: message })
            }
          }

          /**
           * 签到与旅行收尾。
           *
           * 放在成长任务**之后**：领养（first_buddy）已在上面的循环里执行完，
           * 它产出的 Buddy 正是旅行派发的前提。两者都复用与自动周期同源的
           * 单账号实现，因此在跑或已完成的会自然跳过（签到 `already`、
           * 旅行 `traveling` / `daily-limit`），不会重复执行。
           */
          const endpoint = item.endpoint
          const checkin = await this.checkinOneAccount(item.id, item.name, endpoint, item.identity)
          await appendGrowthRunLog({
            account: item.name,
            code: '签到',
            status: checkin.result,
            message: checkin.result === 'already'
              ? '今日已签到，跳过'
              : checkin.result === 'skipped'
                ? '企业账号不支持签到'
                : checkin.result === 'success' ? '签到成功' : checkin.error ?? '签到失败',
          }).catch(() => {})
          items.push({ code: '签到', status: checkin.result, ...checkin.error === undefined ? {} : { error: checkin.error } })

          const travel = await this.travelOneAccount(item.id, item.name, endpoint, item.identity)
          await appendGrowthRunLog({
            account: item.name,
            code: '旅行',
            status: travel.result,
            message: travel.result === 'traveling'
              ? '旅行中，跳过（不重复派发）'
              : travel.result === 'daily-limit'
                ? '今日已旅行，跳过'
                : travel.result === 'claimed'
                  ? `领取旅行奖励 +${travel.rewardCredit ?? 0} 积分`
                  : travel.result === 'departed'
                    ? '已派猫猫出门旅行'
                    : travel.result === 'no-buddy'
                      ? '暂无猫猫（需先完成领养任务）'
                      : travel.result === 'skipped' ? '企业账号无成长中心' : travel.error ?? '旅行失败',
          }).catch(() => {})
          items.push({ code: '旅行', status: travel.result, ...travel.error === undefined ? {} : { error: travel.error } })

          const itemFailed = items.some(result => result.status === 'error')
          return {
            id: item.id,
            name: item.name,
            client: item.client,
            status: acceptError === undefined && !itemFailed ? 'ok' : 'partial',
            items,
            ...acceptError === undefined ? {} : { acceptError },
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          await appendGrowthRunLog({ account: item.name, code: '-', status: 'error', message }).catch(() => {})
          return { id: item.id, name: item.name, client: item.client, status: 'error', items: [], error: message }
        }
      }, signal)
      await finishGrowthRun(`all:${rows.length} accounts`)
      return { status: 'ok', accounts: rows }
    } catch (error) {
      await finishGrowthRun('all:error').catch(() => {})
      throw error
    } finally {
      guard.release()
    }
  }

  /** 面板：全部账号的积分资源与到期（复用 meter 平面的 usage 快照）。 */
  async creditExpiryAll(signal?: AbortSignal): Promise<unknown> {
    const rows = await this.forEachAccount(async item => {
      // 与 panelStatus 共用同一份缓存快照：两个页面在同一 TTL 窗口内不打两次远端。
      const snapshot = this.session === undefined
        ? await fetchUsage(item.endpoint, item.identity, signal)
        : (await this.session.usageProbes.probeAccount(
            item.id,
            item.endpoint,
            item.identity,
            signal === undefined ? {} : { signal },
          )).snapshot
      return {
        id: item.id,
        name: item.name,
        environment: item.environment,
        ok: snapshot !== undefined,
        windows: snapshot?.windows.map(w => ({
          name: w.name,
          remaining: w.usedPercent === undefined ? undefined : Math.round(100 - w.usedPercent),
          total: w.limit,
          remainingAmount: w.limit === undefined || w.used === undefined ? undefined : w.limit - w.used,
          resetsAt: w.resetsAt,
        })),
      }
    }, signal)
    return { accounts: rows }
  }

  /** 面板：基于 DSH logical session/query/projection 的 CodeBuddy 专属 Token 统计。 */
  async tokenStats(request: CodeBuddyTokenStatsRequest, signal?: AbortSignal): Promise<unknown> {
    return collectCodeBuddyTokenStats(this.analytics?.sessionQuery, request, signal)
  }

}
