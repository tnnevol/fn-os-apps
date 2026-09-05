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
import { getLoginAccount, pollAuthToken, requestAuthState } from './codebuddy.ts'
import { clearStorage, loadStorage, saveStorage, buildStorage } from './storage.ts'
import type { CodeBuddySession } from './session.ts'
import type { CodeBuddyStorage } from './storage.ts'
import type { UsageSnapshot, UsageWindow } from './usage.ts'

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

/** One in-flight browser-login handshake, keyed by its own state. */
interface PendingLogin {
  state: string
  /** Resolves to the persisted storage once `pollAuthToken` succeeds. */
  promise: Promise<CodeBuddyStorage | undefined>
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

  constructor(ctx: Context, private readonly session?: CodeBuddySession) {
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
  }

  /** Route one RPC endpoint to its handler. */
  private async dispatch(endpoint: string, payload: unknown, signal: AbortSignal): Promise<RpcOk<unknown> | RpcErr> {
    switch (endpoint) {
      case 'status': return ok(await this.status())
      case 'startLogin': return ok(await this.startLogin())
      case 'pollLogin': {
        const state = typeof payload === 'object' && payload !== null && 'state' in payload
          ? String((payload as { state: unknown }).state)
          : ''
        return ok(await this.pollLogin(state))
      }
      case 'logout': return ok(await this.logout())
      case 'usage': return ok(await this.usage())
      default: return err('not-found', `unknown auth endpoint: ${endpoint}`)
    }
  }

  /**
   * Read the stored credential without requiring one.
   * @returns the current auth status; `loggedIn` is false when nothing is stored.
   */
  async status(): Promise<CodeBuddyAuthStatus> {
    const stored = await loadStorage()
    if (stored === undefined) {
      return { loggedIn: false }
    }
    return {
      loggedIn: true,
      nickname: stored.account.nickname,
      uid: stored.account.uid,
      ...stored.account.uin === undefined ? {} : { uin: stored.account.uin },
      ...stored.account.enterpriseId === undefined ? {} : { enterpriseId: stored.account.enterpriseId },
      ...stored.account.enterpriseName === undefined ? {} : { enterpriseName: stored.account.enterpriseName },
      ...stored.account.enterpriseUserName === undefined ? {} : { enterpriseUserName: stored.account.enterpriseUserName },
      ...stored.account.departmentFullName === undefined ? {} : { departmentFullName: stored.account.departmentFullName },
    }
  }

  /**
   * Start a browser-login handshake.
   * @returns the URL the user must open.
   */
  async startLogin(): Promise<CodeBuddyLoginStart> {
    const handshake = await requestAuthState()
    const pending: PendingLogin = {
      state: handshake.state,
      promise: this.runLogin(handshake.state),
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
    const storage = await pending.promise
    return {
      done: storage !== undefined,
      ...storage !== undefined ? { nickname: storage.account.nickname } : {},
    }
  }

  /** Remove the stored credential. */
  async logout(): Promise<void> {
    await clearStorage()
    // Drop the in-memory cache so the next request re-reads disk (finds
    // nothing) instead of serving the now-revoked token.
    this.session?.invalidate()
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
   * Uses `buildStorage` so the on-disk shape is the one every consumer reads.
   * Returns `undefined` on any failure so the client's poll resolves
   * `done: false` and may retry from `startLogin`.
   */
  private async runLogin(state: string): Promise<CodeBuddyStorage | undefined> {
    try {
      const token = await pollAuthToken(state)
      if (token === undefined) return undefined
      const account = await getLoginAccount(state, token.accessToken, token.domain)
      const storage = buildStorage(token, account)
      await saveStorage(storage)
      // Drop the in-memory cache so the next request picks up the freshly
      // written credential rather than the pre-login one.
      this.session?.invalidate()
      return storage
    } catch {
      // A transport or service failure ends the handshake; the client may
      // retry from `startLogin`.
      return undefined
    }
  }
}
