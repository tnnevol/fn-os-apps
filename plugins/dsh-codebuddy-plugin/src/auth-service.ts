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
  CODEBUDDY_DEFAULT_ENVIRONMENT,
  CODEBUDDY_ENVIRONMENT_ENDPOINTS,
  type CodeBuddyEnvironment,
} from './constants.ts'

import { getCheckinStatus, performCheckin, fetchUsage } from './usage.ts'
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
} from './storage.ts'
import type { CodeBuddySession } from './session.ts'
import type { CodeBuddyAccountEntry, CodeBuddyStorage } from './storage.ts'
import type { UsageSnapshot, UsageWindow } from './usage.ts'
import { collectCodeBuddyTokenStats, type CodeBuddyTokenStatsRequest } from './token-stats.ts'

export interface SessionAnalyticsServices {
  sessionQuery?: Parameters<typeof collectCodeBuddyTokenStats>[0]
}

/** The RPC channel the client calls the auth service on. */
export const CODEBUDDY_AUTH_CHANNEL = '/codebuddy'

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

  constructor(
    ctx: Context,
    private readonly session?: CodeBuddySession,
    /** 当前账号（或其凭据）变化后回调：用于触发 llm/adapters-updated，让模型选择器与用量即时刷新。 */
    private readonly onActiveChanged?: () => void,
    /** DSH logical session query; absent only in profiles without persistence/query support. */
    private readonly analytics?: SessionAnalyticsServices,
  ) {
    this.logger = ctx.logger
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
  }

  /** Automatic daily sign-in flag (all accounts). Defaults on. */
  autoCheckin = true

  /**
   * Consecutive auto-checkin cycle rounds in which EVERY account failed.
   * After the limit the cycle stands down until the next successful round.
   */
  private autoCheckinAllFailures = 0
  private static readonly AUTO_CHECKIN_FAILURE_LIMIT = 3
  private autoCheckinTimer: ReturnType<typeof setInterval> | undefined

  /** 自动签到：逐账号查状态，未签到的提交；已签到的跳过。对照 workbuddy-switch
   *  `run_checkin_cycle`。返回逐账号结果供日志/UI 使用。 */
  async runAutoCheckinCycle(): Promise<{ status: string, accounts: Array<{ id: string, name: string, result: string, error?: string }> }> {
    if (!this.autoCheckin) return { status: 'disabled', accounts: [] }
    if (this.autoCheckinAllFailures >= CodeBuddyAuthService.AUTO_CHECKIN_FAILURE_LIMIT) return { status: 'standby', accounts: [] }
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
    this.autoCheckinAllFailures = failed === storage.accounts.length && storage.accounts.length > 0
      ? this.autoCheckinAllFailures + 1
      : 0
    return { status: 'ok', accounts: rows }
  }

  /** Start the periodic automatic sign-in (startup once, then every 30 min,
   *  matching workbuddy-switch's CHECKIN_RECOVERY_INTERVAL). */
  startAutoCheckinCycle(): void {
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
  private allProbeFailures = 0
  private static readonly ALL_PROBE_FAILURE_LIMIT = 3
  private autoSwitchTimer: ReturnType<typeof setInterval> | undefined

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
    if (this.allProbeFailures >= CodeBuddyAuthService.ALL_PROBE_FAILURE_LIMIT) return
    const before = await this.session?.activeAccountSummary()
    if (before === undefined) return
    let probed = false
    try {
      const result = await this.session?.failoverIfBelowThreshold(this.autoSwitchThresholdPct)
      probed = true
      if (result !== undefined) {
        this.allProbeFailures = 0
        // 主动阈值切换同样要刷新模型目录与消息框额度。
        this.notifyModels()
        this.logger?.info?.(`dsh-codebuddy: proactive switch "${result.from}" → "${result.to}" (${result.remaining}% remaining)`)
      } else {
        this.allProbeFailures = 0
      }
      void before
    } catch (error) {
      // A thrown cycle means even the active-account probe errored: count it
      // as a failed round when no probe succeeded.
      if (!probed) {
        this.allProbeFailures += 1
        this.logger?.warn?.(`dsh-codebuddy: auto-switch probe failed (${this.allProbeFailures}/${CodeBuddyAuthService.ALL_PROBE_FAILURE_LIMIT})`)
        this.logger?.warn?.(error)
      }
    }
  }

  /** Start the periodic proactive check (30s cadence, cheap meter probes). */
  startAutoSwitchCycle(): void {
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
          ? payload as { label?: unknown, environment?: unknown, endpoint?: unknown, activate?: unknown }
          : undefined
        const label = typeof raw?.label === 'string' ? raw.label : undefined
        const environment = typeof raw?.environment === 'string' ? raw.environment : undefined
        const endpoint = typeof raw?.endpoint === 'string' ? raw.endpoint : undefined
        const activate = raw?.activate === undefined ? true : raw.activate === true
        return ok(await this.startLogin({
          ...(label === undefined ? {} : { label }),
          ...(environment === undefined ? {} : { environment }),
          ...(endpoint === undefined ? {} : { endpoint }),
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
          ? payload as { days?: unknown, sessionIds?: unknown }
          : undefined
        const days = typeof raw?.days === 'number' ? raw.days : undefined
        const sessionIds = Array.isArray(raw?.sessionIds)
          ? raw.sessionIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
          : undefined
        return ok(await this.tokenStats({
          ...(days === undefined ? {} : { days }),
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
  async startLogin(options: { label?: string, environment?: string, endpoint?: string, activate?: boolean } = {}): Promise<CodeBuddyLoginStart> {
    const environment = options.environment?.trim().toLowerCase()
    // cloudhosted/selfhosted have no default endpoint: an explicit one is
    // required, otherwise the handshake would go to the wrong host.
    const explicitEndpoint = options.endpoint?.trim().replace(/\/+$/, '')
    const defaultEndpoint = CODEBUDDY_ENVIRONMENT_ENDPOINTS[CODEBUDDY_DEFAULT_ENVIRONMENT as Exclude<CodeBuddyEnvironment, 'cloudhosted' | 'selfhosted'>]
    const endpoint = explicitEndpoint !== undefined && explicitEndpoint.length > 0
      ? explicitEndpoint
      : environment !== undefined && environment in CODEBUDDY_ENVIRONMENT_ENDPOINTS
        ? CODEBUDDY_ENVIRONMENT_ENDPOINTS[environment as Exclude<CodeBuddyEnvironment, 'cloudhosted' | 'selfhosted'>]
        : defaultEndpoint
    const handshake = await requestAuthState(endpoint)
    const pending: PendingLogin = {
      state: handshake.state,
      authUrl: handshake.authUrl,
      promise: this.runLogin(endpoint, handshake.state, options),
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
    return {
      done: entry !== undefined,
      ...entry !== undefined ? { nickname: entry.account.nickname } : {},
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
    options: { label?: string, environment?: string, endpoint?: string, activate?: boolean } = {},
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
    } catch {
      // A transport or service failure ends the handshake; the client may
      // retry from `startLogin`.
      return undefined
    }
  }

  /**
   * 签到/积分面板共用：按账号探测。遍历每个存储账号，用其自身的
   * environment/endpoint 解析身份并调用 meter 平面；单账号失败不影响其他。
   */
  private async forEachAccount<T>(fn: (item: { id: string, name: string, environment: string | undefined, endpoint: string, identity: CodeBuddyIdentity, expired: boolean }) => Promise<T>, signal?: AbortSignal): Promise<T[]> {
    const storage = await loadStorage()
    if (storage === undefined) return []
    const results: T[] = []
    for (const entry of storage.accounts) {
      try {
        const identity = this.session?.identityFor(entry)
        if (identity === undefined) continue
        results.push(await fn({
          id: entry.id,
          name: entry.account.label ?? entry.account.nickname,
          environment: entry.environment,
          endpoint: resolveEntryEndpoint(entry),
          identity,
          expired: entry.auth.refreshExpiresAt <= Date.now(),
        }))
      } catch {
        // 单账号身份解析失败跳过，不阻断其他账号。
      }
    }
    void signal
    return results
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
      const [snapshot, checkin] = await Promise.all([
        fetchUsage(item.endpoint, item.identity, signal).catch(() => undefined),
        getCheckinStatus(item.endpoint, item.identity, signal).catch(() => ({ ok: false, todayCheckedIn: false, error: 'probe failed' })),
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
        active: item.id === activeId,
        expired: item.expired,
        // 额度面状态
        creditOk: snapshot !== undefined,
        totalRemaining,
        totalCapacity,
        resources,
        // 签到状态
        checkinOk: checkin.ok,
        todayCheckedIn: checkin.ok ? checkin.todayCheckedIn : null,
        checkinError: checkin.ok ? null : checkin.error ?? 'probe failed',
        // 前端据此禁用“设为当前/选择账号”：无余额或查询失败都不可接管
        usable,
      }
    }, signal)
    return { accounts: rows, currentId: activeId }
  }

  /** 面板：查询全部账号的今日签到状态。 */
  async checkinStatus(_id: string | undefined, signal?: AbortSignal): Promise<unknown> {
    const rows = await this.forEachAccount(async item => {
      const status = await getCheckinStatus(item.endpoint, item.identity, signal)
      return { id: item.id, name: item.name, environment: item.environment, ok: status.ok, todayCheckedIn: status.todayCheckedIn, error: status.error }
    }, signal)
    return { accounts: rows }
  }

  /** 面板：对所有账号签到（一键/单账号共用，id 缺省=全部）。 */
  async checkin(id: string | undefined, signal?: AbortSignal): Promise<unknown> {
    const rows = await this.forEachAccount(async item => {
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
