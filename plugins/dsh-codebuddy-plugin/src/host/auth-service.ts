/**
 * Host-side OAuth service exposed to the Web client over a private RPC channel.
 *
 * The browser login is long-running (it waits for a human to finish signing
 * in), so it is split across two RPC endpoints: `startLogin` mints the
 * handshake and returns the URL the user must open, and `pollLogin` checks
 * whether that handshake has completed. `status` and `logout` are the
 * read/clear pair the settings page drives the rest of the time.
 *
 * @module dsh-codebuddy/auth-service
 */

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
import { getLoginAccount, pollAuthToken, requestAuthState } from './codebuddy.ts'
import {
  clearStorage,
  loadStorage,
  saveStorage,
  buildAccountEntry,
  activeEntry,
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

export interface SessionAnalyticsServices {
  sessionQuery?: Parameters<typeof collectCodeBuddyTokenStats>[0]
}

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

/** The shape `status` returns to the client. */
export interface CodeBuddyAuthStatus {
  /** Whether a usable credential is stored. */
  loggedIn: boolean
  /** Signed-in display name, when available. */
  nickname?: string
  /** Account uid, when available. */
  uid?: string
  /** Tencent user identity number (e.g. QQ openid), when the account discloses one. */
  uin?: string
  /** Enterprise/organization id, when the account is an enterprise tenant. */
  enterpriseId?: string
  /** Enterprise display name, when the account is an enterprise tenant. */
  enterpriseName?: string
  /** Enterprise user name (the account's name within the tenant). */
  enterpriseUserName?: string
  /** Department full name, when the enterprise account discloses one. */
  departmentFullName?: string
}

/** The shape `startLogin` returns to the client. */
export interface CodeBuddyLoginStart {
  /** URL the user must open to sign in. */
  authUrl: string
  /** Handshake id; the client passes it back to `pollLogin`. */
  state: string
}

/** The shape `pollLogin` returns to the client. */
export interface CodeBuddyLoginPoll {
  /** Whether the handshake has completed and the credential was persisted. */
  done: boolean
  /** Signed-in display name, when the login just completed. */
  nickname?: string
  /**
   * 失败原因（登录已确定失败时给出）。有值即表示不必再轮询：继续等待不会有结果，
   * 应把原因显示给用户。没有该字段时表示「仍在等待用户完成授权」。
   */
  error?: string
}

/**
 * One metering window shipped to the client, a plain-data projection of
 * {@link UsageWindow} with optional fields made safe to omit.
 */
export interface CodeBuddyUsageWindow {
  name: string
  used?: number
  limit?: number
  usedPercent?: number
  resetsAt?: string
}

/** The shape `usage` returns to the client. */
export interface CodeBuddyUsageResult {
  /** Whether a usable credential is stored; false means no usage to show. */
  loggedIn: boolean
  /** One entry per metering window; empty when the plane answered nothing usable. */
  windows: CodeBuddyUsageWindow[]
  /**
   * The first window, surfaced for a single-bar affordance; `undefined` when
   * the plane reported no windows.
   */
  primary?: CodeBuddyUsageWindow
}

/** One stored account projected to the client. */
export interface CodeBuddyAccountView {
  /** Stable local id; pass it to `switchAccount` / `removeAccount`. */
  id: string
  nickname: string
  /** Local display label; falls back to nickname when absent. */
  label?: string
  /** Network environment this credential was issued against, when known. */
  environment?: string
  uid: string
  uin?: string
  enterpriseId?: string
  enterpriseName?: string
  enterpriseUserName?: string
  departmentFullName?: string
  /** Whether this is the active account every request authenticates with. */
  active: boolean
  /** Whether the refresh token has expired — the account is offline and needs re-login. */
  expired: boolean
}

/** The shape `accounts` returns to the client. */
export interface CodeBuddyAccountsResult {
  /** Whether at least one usable credential is stored. */
  loggedIn: boolean
  /** The active account, when signed in. */
  current?: CodeBuddyAccountView
  /** One entry per stored account, active first then insertion order. */
  accounts: CodeBuddyAccountView[]
}

/** The shape `removeAccount` / `switchAccount` return to the client. */
export interface CodeBuddyAccountsChanged {
  loggedIn: boolean
  current?: CodeBuddyAccountView
  accounts: CodeBuddyAccountView[]
}

/** One in-flight browser-login handshake, keyed by its own state. */
interface PendingLogin {
  /** The exact URL handed to the browser; the copy button serves the same link. */
  authUrl?: string
  state: string
  /** Resolves to the persisted storage once `pollAuthToken` succeeds. */
  promise: Promise<CodeBuddyAccountEntry | undefined>
  /**
   * 失败原因。登录失败时由 {@link CodeBuddyAuthService.runLogin} 写入，
   * `pollLogin` 据此把「已失败」与「仍在等待」区分开——否则前端只能一直轮询到
   * 超时，用户看不到任何失败原因（这正是此前 workbuddy 登录无反应的成因）。
   */
  failure?: string
}

/** A successful RPC result. */
interface RpcOk<T> { ok: true, value: T }
/** A failed RPC result. */
interface RpcErr { ok: false, error: { code: string, message: string, details: Record<string, unknown> } }

function ok<T>(value: T): RpcOk<T> {
  return { ok: true, value }
}

function err(code: string, message: string): RpcErr {
  return { ok: false, error: { code, message, details: {} } }
}

/**
 * Project one owned-data {@link UsageWindow} into the RPC-safe shape the
 * client receives, widening optional fields only when present.
 * @param window - the metering window.
 * @returns the client-safe projection.
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
 * The CodeBuddy auth RPC service.
 *
 * A handshake is started by `startLogin`, polled to completion by `pollLogin`,
 * and its credential is picked up by the adapter's `CodeBuddySession` on its
 * next request — so a login completed through the UI reaches a running harness
 * without a restart. `logout` clears the file and invalidates the session cache.
 */
export class CodeBuddyAuthService {
  /** In-flight handshakes by state id. */
  private readonly pending = new Map<string, PendingLogin>()

  private readonly logger: { warn: (m: unknown) => void, info: (m: unknown) => void }

  /**
   * 插件已卸载。周期开关的初始配置是异步读取的，回调可能在卸载**之后**才
   * 落地；若此时再启动定时器，就绕过了 effect 的清理（effect 已执行过），
   * 留下真正的孤儿定时器。所有 start* 都先检查这个标志。
   */
  private disposed = false

  constructor(
    ctx: Context,
    private readonly session?: CodeBuddySession,
    /** 当前账号（或其凭据）变化后回调：用于触发 llm/adapters-updated，让模型选择器与用量即时刷新。 */
    private readonly onActiveChanged?: () => void,
    /** DSH logical session query; absent only in profiles without persistence/query support. */
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
    ctx.inject(['connection'], (connectionCtx) => {
      const connection = connectionCtx.get('connection') as {
        rpc: {
          handle: (
            channel: string,
            handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>,
          ) => () => Promise<void>
        }
      }
      connectionCtx.effect(() => {
        // dsh 0.1.2-rc.1 removed the per-channel `{ authority: 'loopback' }`
        // trust option: every registered channel now rides the connection's
        // own browser authentication and Host/Origin fence, which the web
        // settings page already satisfies.
        const dispose = connection.rpc.handle(
          CODEBUDDY_AUTH_CHANNEL,
          (endpoint, payload, signal) => this.dispatch(endpoint, payload, signal),
        )
        // The rc.1 channel disposer is asynchronous; hand the fiber a
        // synchronous one.
        return () => { void dispose() }
      }, 'dsh-codebuddy: auth RPC channel')
    })
    void loadAutoSwitchConfig().then((config) => {
      this.autoSwitch = config.enabled
      this.autoSwitchThresholdPct = config.thresholdPct
      if (config.enabled) this.startAutoSwitchCycle()
    }).catch(() => {
      // Loading prefs is advisory; the in-code defaults already stand.
    })
    void loadAutoCheckinConfig().then((config) => {
      this.autoCheckin = config.enabled
      if (config.enabled) this.startAutoCheckinCycle()
    }).catch(() => {
      // Loading prefs is advisory; the in-code defaults already stand.
    })
    void loadAutoTravelConfig().then((config) => {
      this.autoTravel = config.enabled
      if (config.enabled) this.startTravelCycle()
    }).catch(() => {
      // Loading prefs is advisory; the in-code defaults already stand.
    })
  }

  /** Automatic daily sign-in flag (all accounts). Defaults on. */
  autoCheckin = true

  /**
   * Consecutive auto-checkin cycle rounds in which EVERY account failed.
   * After the limit the cycle stands down until the next successful round.
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

  /** Start the periodic automatic sign-in (startup once, then every 30 min,
   *  matching workbuddy-switch's CHECKIN_RECOVERY_INTERVAL). */
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

  /** Automatic buddy-travel flag (personal accounts only). Defaults on. */
  autoTravel = true

  /**
   * Consecutive travel rounds in which EVERY eligible account failed. After the
   * limit the cycle stands down rather than hammering an unreachable plane.
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
   * - `idle` + `daily_limit_reached` → 今日已结束；
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
            // traveling / idle / 今日已结束都不属于领取轮次的职责。
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

  /** Start the travel cycles: dispatch on startup then every 30 min; claims on
   *  startup then every 15 min, matching workbuddy-switch's TRAVEL_RETRY_INTERVAL
   *  / TRAVEL_CLAIM_INTERVAL split. */
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

  /** 主动账号切换后广播：通知 harness 模型目录与客户端用量刷新（adapter replace → llm/adapters-updated）。 */
  private notifyModels(): void {
    // 先让 session 失效（调用方已做或这里再做一次无妨），再触发 harness 目录刷新。
    this.session?.invalidate()
    try { this.onActiveChanged?.() } catch { /* 广播失败不影响账号操作结果 */ }
  }

  /** Whether quota failures may switch the active account automatically. */
  autoSwitch = true
  /** Switch proactively once the active account's remaining allowance is under this percentage. */
  autoSwitchThresholdPct = 10
  /**
   * Consecutive auto-switch cycle rounds in which EVERY account probe failed
   * (meter unreachable for all). After this many rounds the cycle stands down
   * until the next successful probe — "all accounts errored" ends auto-switch
   * instead of hammering a dead meter plane forever.
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

  /** Push the persisted prefs to the host-side gate and cycle. */
  setAutoSwitchConfig(enabled: boolean, thresholdPct: number): void {
    this.autoSwitch = enabled
    this.autoSwitchThresholdPct = Math.max(0, Math.min(100, Math.round(thresholdPct)))
  }

  /**
   * One proactive auto-switch pass: below-threshold check on the active
   * account, probe the others, switch to the healthiest. Tracks consecutive
   * all-probe-failure rounds and stands down after the limit.
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
        // A thrown cycle means even the active-account probe errored: count it
        // as a failed round when no probe succeeded.
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

  /** Start the periodic proactive check (30s cadence, cheap meter probes). */
  startAutoSwitchCycle(): void {
    if (this.disposed) return
    if (this.autoSwitchTimer !== undefined) return
    this.autoSwitchTimer = setInterval(() => { void this.runAutoSwitchCycle() }, 30_000)
  }

  stopAutoSwitchCycle(): void {
    if (this.autoSwitchTimer !== undefined) {
      clearInterval(this.autoSwitchTimer)
      this.autoSwitchTimer = undefined
    }
  }

  /** Route one RPC endpoint to its handler. */
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
      case 'creditExpiry': return ok(await this.creditExpiryAll(signal))
      case 'tokenStats': {
        const raw = typeof payload === 'object' && payload !== null
          ? payload as { days?: unknown, allTime?: unknown, sessionIds?: unknown }
          : undefined
        const days = typeof raw?.days === 'number' ? raw.days : undefined
        // allTime 由客户端范围键 'all' 解析而来：统计全部历史、不做时间下界过滤。
        const allTime = raw?.allTime === true ? true : undefined
        const sessionIds = Array.isArray(raw?.sessionIds)
          ? raw.sessionIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
          : undefined
        return ok(await this.tokenStats({
          ...(days === undefined ? {} : { days }),
          ...(allTime === undefined ? {} : { allTime }),
          ...(sessionIds === undefined ? {} : { sessionIds }),
        }, signal))
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
        void saveAutoSwitchConfig({ enabled, thresholdPct })
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
        void saveAutoCheckinConfig({ enabled })
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
        void saveAutoTravelConfig({ enabled })
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

  /** Project one stored entry to its client view. */
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

  /** The accounts projection from the current document. */
  private async projectAccounts(): Promise<CodeBuddyAccountsResult> {
    const storage = await loadStorage()
    if (storage === undefined) return { loggedIn: false, accounts: [] }
    const activeId = storage.accounts.some(entry => entry.id === storage.activeId)
      ? storage.activeId
      : storage.accounts[0]!.id
    // Preserve the persisted account order for stable account presentation and
    // automatic fallback behavior.
    const accounts = storage.accounts.map((_, index) => this.projectEntry(storage, index, activeId))
    const current = accounts.find(account => account.active) ?? accounts[0]
    return {
      loggedIn: true,
      accounts,
      ...(current === undefined ? {} : { current }),
    }
  }

  /**
   * Read the stored accounts without requiring one.
   * @returns every stored account with the active one first.
   */
  async accounts(): Promise<CodeBuddyAccountsResult> {
    return this.projectAccounts()
  }

  /**
   * Remove one stored account by id.
   *
   * Removing the active account promotes the next stored entry (in insertion
   * order) so the harness stays signed in with the remaining account rather
   * than dropping to signed-out. Removing the last account is the signed-out
   * end state.
   * @param id - the local account id from `accounts`.
   * @returns the accounts projection after the removal.
   */
  async removeAccount(id: string): Promise<CodeBuddyAccountsChanged> {
    const storage = await loadStorage()
    if (storage === undefined) return { loggedIn: false, accounts: [] }
    const remaining = storage.accounts.filter(entry => entry.id !== id)
    if (remaining.length === storage.accounts.length) {
      // Unknown id: no mutation, report the unchanged roster.
      return this.projectAccounts()
    }
    if (remaining.length === 0) {
      await clearStorage()
      this.notifyModels()
      return { loggedIn: false, accounts: [] }
    }
    const next: CodeBuddyStorage = {
      // Keep the active entry when it survived; otherwise the first survivor
      // becomes active.
      activeId: remaining.some(entry => entry.id === storage.activeId)
        ? storage.activeId
        : remaining[0]!.id,
      accounts: remaining,
    }
    const activeChanged = next.activeId !== storage.activeId
    await saveStorage(next)
    if (activeChanged) this.notifyModels()
    else this.session?.invalidate()
    return this.projectAccounts()
  }

  /**
   * Set or clear one account's local display label.
   * @param id - the local account id from `accounts`.
   * @param label - the new label (≤30 chars); empty clears it.
   * @returns the accounts projection after the rename.
   */
  async renameLabel(id: string, label: string | undefined): Promise<CodeBuddyAccountsChanged> {
    const storage = await loadStorage()
    if (storage === undefined) return { loggedIn: false, accounts: [] }
    if (!storage.accounts.some(entry => entry.id === id)) {
      return this.projectAccounts()
    }
    const trimmed = label?.trim()
    await saveStorage({
      ...storage,
      accounts: storage.accounts.map(entry => {
        if (entry.id !== id) return entry
        const account = { ...entry.account }
        if (trimmed === undefined || trimmed.length === 0) delete account.label
        else account.label = trimmed
        return { ...entry, account }
      }),
    })
    this.session?.invalidate()
    return this.projectAccounts()
  }

  /**
   * Make one stored account active.
   * @param id - the local account id from `accounts`.
   * @returns the accounts projection after the switch.
   */
  async switchAccount(id: string): Promise<CodeBuddyAccountsChanged> {
    const storage = await loadStorage()
    if (storage === undefined) return { loggedIn: false, accounts: [] }
    if (!storage.accounts.some(entry => entry.id === id)) {
      return this.projectAccounts()
    }
    if (storage.activeId === id) {
      // 已是当前账号：无需切换，仍失效一次以重读最新凭据（防文件被外部刷新）。
      this.session?.invalidate()
      return this.projectAccounts()
    }
    await saveStorage({ ...storage, activeId: id })
    this.notifyModels()
    return this.projectAccounts()
  }

  /**
   * Read the active account's credential without requiring one.
   * @returns the current auth status; `loggedIn` is false when nothing is stored.
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
   * Start a browser-login handshake against the requested environment.
   * @param options - `label` (local display name), `environment`
   *   (`CODEBUDDY_INTERNET_ENVIRONMENT` value) and `endpoint` (explicit
   *   service root for cloudhosted/selfhosted).
   * @returns the URL the user must open.
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
    // cloudhosted/selfhosted have no default endpoint: an explicit one is
    // required, otherwise the handshake would go to the wrong host.
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
    // Reap the entry once the handshake settles either way, so the table does
    // not grow without bound for abandoned logins.
    void pending.promise.finally(() => {
      if (this.pending.get(handshake.state) === pending) {
        this.pending.delete(handshake.state)
      }
    })
    return { authUrl: handshake.authUrl, state: handshake.state }
  }

  /**
   * The sign-in URL of a started handshake — the SAME link the host opened.
   * Served for the copy button so cross-device authorization shares one link.
   * @param state - the handshake id from `startLogin`.
   * @returns the link, or `undefined` when the handshake is unknown/expired.
   */
  async loginLink(state: string): Promise<string | undefined> {
    return this.pending.get(state)?.authUrl
  }

  /**
   * Check whether a started handshake has completed.
   * @param state - the handshake id from `startLogin`.
   * @returns whether the login completed and the credential was persisted.
   */
  async pollLogin(state: string): Promise<CodeBuddyLoginPoll> {
    const pending = this.pending.get(state)
    if (pending === undefined) {
      // Unknown/already-reaped state: surface as not-done rather than an error,
      // because the client's poll loop may outlive the entry by one tick.
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

  /** Remove every stored account. */
  async logout(): Promise<void> {
    await clearStorage()
    this.notifyModels()
  }

  /**
   * Read the CodeBuddy usage snapshot for the settings surface.
   *
   * Delegates to the session, which resolves a refreshed identity before the
   * meter read and never throws on a meter outage. A signed-out account is
   * reported as `loggedIn: false` with empty windows so the client can hide
   * the affordance rather than render a broken bar.
   * @returns the usage projection, or a signed-out shape when nothing is stored.
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
   * Drive one handshake to a persisted credential.
   *
   * Uses `buildAccountEntry` so the on-disk shape is the one every consumer
   * reads. A completed login appends a new entry and makes it active; a
   * re-login of an account already in the store replaces that account's
   * entry (dedupe by uid) rather than duplicating it. Returns `undefined` on
   * any failure so the client's poll resolves `done: false` and may retry
   * from `startLogin`.
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
      const stored = await loadStorage()
      // The existing entry for the same uid (if any) keeps its local id and
      // position; its credential is replaced by the fresh one. A brand-new
      // account is appended and becomes active. A fresh label overrides an
      // existing one; an empty label keeps whatever was there before.
      const existing = stored?.accounts.find(entry => entry.account.uid === account.uid)
      // The login becomes the active account unless the caller asked to keep
      // the current one (a re-login of an offline account must not steal
      // traffic from whoever took over while it was down).
      const activate = options.activate !== false
      let next: CodeBuddyStorage
      if (stored === undefined) {
        next = { activeId: fresh.id, accounts: [fresh] }
      } else if (existing !== undefined) {
        const replaced: CodeBuddyAccountEntry = {
          ...fresh,
          id: existing.id,
          account: {
            ...fresh.account,
            ...(fresh.account.label === undefined && existing.account.label !== undefined
              ? { label: existing.account.label }
              : {}),
          },
          // 客户端标识以本次登录为准：同一 uid 先用 CLI 登录、后用 WorkBuddy
          // 登录时，端点与版本都必须跟着换，否则会用错平面发请求。
          ...fresh.client === undefined ? {} : { client: fresh.client },
          ...fresh.clientVersion === undefined ? {} : { clientVersion: fresh.clientVersion },
        }
        const wasActive = stored.activeId === existing.id
        next = {
          activeId: activate || wasActive ? replaced.id : stored.activeId,
          accounts: stored.accounts.map(entry => entry.id === existing.id ? replaced : entry),
        }
      } else {
        next = activate
          ? { activeId: fresh.id, accounts: [...stored.accounts, fresh] }
          : { activeId: stored.activeId, accounts: [...stored.accounts, fresh] }
      }
      await saveStorage(next)
      this.notifyModels()
      return fresh
    } catch (error) {
      // A transport or service failure ends the handshake; the client may
      // retry from `startLogin`. 但**必须把原因带回**：静默返回 undefined 会让
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
    const slots: Array<T | undefined> = new Array<T | undefined>(storage.accounts.length).fill(undefined)
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
      const [snapshot, checkin, travel] = item.enterprise
        ? await Promise.all([
          fetchUsage(item.endpoint, item.identity, signal).catch(() => undefined),
          Promise.resolve({ ok: false, todayCheckedIn: false }),
          Promise.resolve(undefined),
        ])
        : await Promise.all([
          fetchUsage(item.endpoint, item.identity, signal).catch(() => undefined),
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

  /** 面板：全部账号的积分资源与到期（复用 meter 平面的 usage 快照）。 */
  async creditExpiryAll(signal?: AbortSignal): Promise<unknown> {
    const rows = await this.forEachAccount(async item => {
      const snapshot = await fetchUsage(item.endpoint, item.identity, signal)
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
  async tokenStats(request: CodeBuddyTokenStatsRequest = {}, signal?: AbortSignal): Promise<unknown> {
    return collectCodeBuddyTokenStats(this.analytics?.sessionQuery, request, signal)
  }

}
