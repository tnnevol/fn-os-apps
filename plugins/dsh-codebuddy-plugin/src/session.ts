/**
 * The signed-in session: token freshness and the cached model catalog.
 *
 * One object owns both because they share a failure mode — an expired token
 * makes the catalog unreadable — and because both must be resolved before a
 * request can be built. Refresh is single-flighted: the adapter resolves the
 * identity once per stream call and the catalog once per listing, so without
 * coalescing a burst of concurrent calls would each spend the refresh token
 * and all but one would be racing to write the file.
 *
 * @module dsh-codebuddy/session
 */

import { getConfig, getEnterpriseModels, refreshAccessToken } from './codebuddy.ts'
import type { CodeBuddyIdentity } from './codebuddy.ts'
import { fetchUsage } from './usage.ts'
import type { UsageSnapshot } from './usage.ts'
import { loadStorage, saveStorage, activeEntry, resolveEntryEndpoint } from './storage.ts'
import type { CodeBuddyAccountEntry, CodeBuddyStorage } from './storage.ts'
import type { CodeBuddyModel } from './types.ts'

/** Refresh this long before the recorded expiry rather than exactly at it. */
const REFRESH_SKEW_MS = 60_000

/** How long a read catalog is reused before the service is asked again. */
const CATALOG_TTL_MS = 5 * 60 * 1000

/** Raised when nothing is signed in; carries the remedy in its message. */
export class NotLoggedInError extends Error {
  constructor(detail: string) {
    super(detail)
    this.name = 'NotLoggedInError'
  }
}

/** A logger surface compatible with cordis's, so the session can be used bare. */
export interface SessionLogger {
  warn: (message: unknown) => void
  error: (message: unknown) => void
}

/**
 * Owns the stored credentials for one plugin instance.
 *
 * The store is multi-account; every request authenticates with the active
 * entry. The document is re-read from disk when absent from memory, which is
 * what lets a login or a switch completed in the Web UI reach a *running*
 * harness without a restart.
 */
export class CodeBuddySession {
  private storage: CodeBuddyStorage | undefined
  private refreshing: Promise<CodeBuddyIdentity> | undefined
  private catalog: { models: readonly CodeBuddyModel[], readAt: number } | undefined
  private catalogRead: Promise<readonly CodeBuddyModel[]> | undefined

  constructor(private readonly logger?: SessionLogger) {}

  /** Forget the in-memory credentials and catalog, forcing a re-read from disk. */
  invalidate(): void {
    this.storage = undefined
    this.catalog = undefined
  }

  /** Public identity resolution for panel probes (per-entry, no refresh). */
  identityFor(entry: CodeBuddyAccountEntry): CodeBuddyIdentity {
    return this.identityOf(entry)
  }

  private identityOf(entry: CodeBuddyAccountEntry): CodeBuddyIdentity {
    return {
      accessToken: entry.auth.accessToken,
      domain: entry.auth.domain,
      uid: entry.account.uid,
      ...entry.account.enterpriseId === undefined
        ? {}
        : { enterpriseId: entry.account.enterpriseId },
      ...entry.account.departmentFullName === undefined
        ? {}
        : { departmentFullName: entry.account.departmentFullName },
    }
  }

  /**
   * The stored credential document, read from disk on first use and after
   * invalidation.
   * @throws NotLoggedInError when nothing is stored.
   */
  private async require(): Promise<CodeBuddyStorage> {
    this.storage ??= await loadStorage()
    if (this.storage === undefined) {
      throw new NotLoggedInError(
        'CodeBuddy is not signed in. Sign in through Settings → CodeBuddy in the'
        + ' Web UI (no API key is required).',
      )
    }
    return this.storage
  }

  /** Whether any account credential exists, without requiring one. */
  async isLoggedIn(): Promise<boolean> {
    this.storage ??= await loadStorage()
    return this.storage !== undefined
  }

  /** The active account's nickname, when a credential exists. */
  async nickname(): Promise<string | undefined> {
    this.storage ??= await loadStorage()
    return this.storage !== undefined ? activeEntry(this.storage).account.nickname : undefined
  }

  /**
   * A usable identity for the active account, refreshing the access token
   * when it is at or near expiry. Concurrent callers share one refresh.
   * @returns the identity to authenticate a request with.
   * @throws NotLoggedInError when nothing is stored, or when the refresh token
   *   has itself expired and only a new browser login can recover.
   */
  async identity(): Promise<CodeBuddyIdentity> {
    const storage = await this.require()
    const entry = activeEntry(storage)
    const now = Date.now()
    if (now < entry.auth.expiresAt - REFRESH_SKEW_MS) {
      return this.identityOf(entry)
    }
    if (now >= entry.auth.refreshExpiresAt) {
      throw new NotLoggedInError(
        'The CodeBuddy session has expired. Sign in again through Settings →'
        + ' CodeBuddy in the Web UI.',
      )
    }
    this.refreshing ??= this.refresh(storage, entry).finally(() => {
      this.refreshing = undefined
    })
    return this.refreshing
  }

  private async refresh(storage: CodeBuddyStorage, entry: CodeBuddyAccountEntry): Promise<CodeBuddyIdentity> {
    const endpoint = resolveEntryEndpoint(entry)
    const refreshed = await refreshAccessToken(endpoint, this.identityOf(entry), entry.auth.refreshToken)
    if (refreshed === undefined) {
      throw new NotLoggedInError(
        'Refreshing the CodeBuddy session failed. Sign in again through Settings →'
        + ' CodeBuddy in the Web UI.',
      )
    }
    const refreshedEntry: CodeBuddyAccountEntry = {
      ...entry,
      auth: {
        accessToken: refreshed.accessToken,
        expiresAt: Date.now() + refreshed.expiresIn * 1000,
        refreshToken: refreshed.refreshToken,
        refreshExpiresAt: Date.now() + refreshed.refreshExpiresIn * 1000,
        domain: refreshed.domain,
      },
    }
    const next: CodeBuddyStorage = {
      activeId: storage.activeId,
      accounts: storage.accounts.map(candidate => candidate.id === entry.id ? refreshedEntry : candidate),
    }
    this.storage = next
    // A catalog read under the old token is still valid, but the write below
    // may fail and leave the next process on a stale token; the catalog is
    // cheap to re-read, so it is dropped rather than reasoned about.
    this.catalog = undefined
    try {
      await saveStorage(next)
    } catch (error) {
      // The refreshed token works for this process even if it could not be
      // persisted; failing the request would turn a storage problem into an
      // outage.
      this.logger?.warn('dsh-codebuddy: refreshed the session but could not persist it')
      this.logger?.warn(error)
    }
    return this.identityOf(refreshedEntry)
  }

  /**
   * The headers every authenticated CodeBuddy request carries.
   * @returns the identity headers, with the session refreshed if needed.
   */
  async authHeaders(): Promise<Record<string, string>> {
    const identity = await this.identity()
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${identity.accessToken}`,
      'X-Domain': identity.domain,
      'X-User-Id': identity.uid,
    }
    if (identity.enterpriseId !== undefined) headers['X-Enterprise-Id'] = identity.enterpriseId
    return headers
  }

  /**
   * The OpenAI-compatible chat base for the ACTIVE account
   * (`<entry endpoint>/v2`), or `undefined` when nothing is stored — the
   * caller then falls back to its configured default.
   * @returns the chat base URL, or `undefined` when signed out.
   */
  chatBase(): string | undefined {
    return this.storage !== undefined ? `${resolveEntryEndpoint(activeEntry(this.storage))}/v2` : undefined
  }

  /**
   * Accounts that can take over traffic right now: a stored credential whose
   * refresh token has not expired. Order follows the stored roster, so the
   * caller's first candidate is the most recently added fallback.
   * @returns the candidate entries, or `undefined` when signed out.
   */
  async failoverCandidates(): Promise<readonly CodeBuddyAccountEntry[] | undefined> {
    const storage = await loadStorage()
    if (storage === undefined) return undefined
    const now = Date.now()
    return storage.accounts.filter(entry => entry.auth.refreshExpiresAt > now)
  }

  /**
   * The remaining-allowance percentage for one account, probed against its
   * own endpoint: 100 − usedPercent across the combined metering windows, or
   * `undefined` when the meter plane was unreachable or answered nothing
   * usable. A probe failure is NOT a quota verdict — the account stays a
   * candidate.
   * @param entry - the account to probe.
   * @param signal - optional cancellation.
   */
  private async remainingPercentOf(entry: CodeBuddyAccountEntry, signal?: AbortSignal): Promise<number | undefined> {
    const snapshot = await fetchUsage(resolveEntryEndpoint(entry), this.identityOf(entry), signal)
    if (snapshot === undefined) return undefined
    const { used, limit } = snapshot.windows.reduce(
      (acc, window) => ({
        used: acc.used + (window.used ?? 0),
        limit: acc.limit + (window.limit ?? 0),
      }),
      { used: 0, limit: 0 },
    )
    if (limit <= 0) return undefined
    return Math.max(0, Math.min(100, 100 - (used / limit) * 100))
  }

  /**
   * Proactive failover: called by the auto-switch cycle (settings toggle +
   * usage polling). Probes every non-active, non-expired account and switches
   * to the one with the most remaining allowance when the ACTIVE account's
   * remaining percentage has dropped below `thresholdPct`. Accounts that
   * fail their probe are skipped, not penalized; when no candidate beats the
   * threshold the active account stays — the reactive adapter failover on a
   * real quota rejection remains the last line of defense.
   * @param thresholdPct - switch once the active account's remaining
   *   allowance falls under this percentage (0–100).
   * @param signal - optional cancellation for the probes.
   * @returns the takeover names, or `undefined` when no switch was made
   *   (not yet below threshold, no candidate, or every probe failed).
   */
  async failoverIfBelowThreshold(
    thresholdPct: number,
    signal?: AbortSignal,
  ): Promise<{ from: string, to: string, remaining: number } | undefined> {
    const storage = await loadStorage()
    if (storage === undefined || storage.accounts.length < 2) return undefined
    const active = activeEntry(storage)
    if (active.auth.refreshExpiresAt <= Date.now()) return undefined

    const activeRemaining = await this.remainingPercentOf(active, signal)
    // Unknown remaining (meter outage) is not a reason to switch — the
    // reactive path still covers a hard quota rejection.
    if (activeRemaining === undefined || activeRemaining >= thresholdPct) return undefined

    // Probe the other live accounts; pick the one with the most remaining.
    let best: { entry: CodeBuddyAccountEntry, remaining: number } | undefined
    for (const entry of storage.accounts) {
      if (entry.id === active.id) continue
      if (entry.auth.refreshExpiresAt <= Date.now()) continue
      const remaining = await this.remainingPercentOf(entry, signal)
      if (remaining === undefined) continue
      if (best === undefined || remaining > best.remaining) {
        best = { entry, remaining }
      }
    }
    if (best === undefined) return undefined

    const applied = await this.switchTo(best.entry.id)
    if (!applied) return undefined
    return {
      from: active.account.nickname,
      to: best.entry.account.nickname,
      remaining: best.remaining,
    }
  }

  /**
   * Make one stored account active and persist the switch.
   * @param id - the local account id.
   * @returns whether the switch was applied.
   */
  async switchTo(id: string): Promise<boolean> {
    const storage = await loadStorage()
    if (storage === undefined) return false
    if (!storage.accounts.some(entry => entry.id === id)) return false
    if (storage.activeId === id) return true
    await saveStorage({ ...storage, activeId: id })
    // Drop the in-memory caches so the next request re-reads disk and picks up
    // the new credential, endpoint, and catalog.
    this.invalidate()
    return true
  }

  /** The active account's display facts, for takeover notices. */
  async activeAccountSummary(): Promise<{ id: string, nickname: string } | undefined> {
    const storage = await loadStorage()
    if (storage === undefined) return undefined
    const entry = activeEntry(storage)
    return { id: entry.id, nickname: entry.account.nickname }
  }

  /**
   * The CodeBuddy model catalog, cached briefly and shared between concurrent
   * readers.
   * @param signal - optional cancellation for the underlying read.
   * @returns the catalog models in service order.
   */
  async models(signal?: AbortSignal): Promise<readonly CodeBuddyModel[]> {
    const cached = this.catalog
    if (cached !== undefined && Date.now() - cached.readAt < CATALOG_TTL_MS) {
      return cached.models
    }
    this.catalogRead ??= this.readModels(signal).finally(() => {
      this.catalogRead = undefined
    })
    return this.catalogRead
  }

  private async readModels(signal?: AbortSignal): Promise<readonly CodeBuddyModel[]> {
    const storage = await this.require()
    const endpoint = resolveEntryEndpoint(activeEntry(storage))
    const identity = await this.identity()
    const [config, enterpriseModels] = await Promise.all([
      getConfig(endpoint, identity, signal),
      getEnterpriseModels(endpoint, identity, signal),
    ])
    const personal = config.models.filter(model => typeof model.id === 'string' && model.id.length > 0)
    // Enterprise custom models live on a separate console endpoint (the
    // personal catalog does not list them). Their capacity field is
    // `maxInputTokens`, so it is normalized onto the shared `maxAllowedSize`
    // spelling the listing and resolve paths already consume. A duplicate id
    // is dropped in favor of the personal entry, which carries the richer
    // capability/reasoning metadata.
    const seen = new Set<string>(personal.map(model => model.id))
    const custom: CodeBuddyModel[] = []
    for (const model of enterpriseModels) {
      if (typeof model.id !== 'string' || model.id.length === 0 || seen.has(model.id)) continue
      // `disabledMultiModel` marks a model the console does not offer in the
      // multi-model selector (e.g. a completion-only model); the official
      // client likewise keeps it out of the picker.
      if (model.disabledMultiModel === true) continue
      seen.add(model.id)
      custom.push({
        id: model.id,
        name: model.name || model.id,
        ...model.maxInputTokens !== undefined && model.maxInputTokens > 0
          ? { maxAllowedSize: model.maxInputTokens }
          : {},
        ...model.maxOutputTokens !== undefined && model.maxOutputTokens > 0
          ? { maxOutputTokens: model.maxOutputTokens }
          : {},
        ...model.supportsToolCall === undefined ? {} : { supportsToolCall: model.supportsToolCall },
        ...model.supportsImages === undefined ? {} : { supportsImages: model.supportsImages },
      })
    }
    const models = [...personal, ...custom]
    this.catalog = { models, readAt: Date.now() }
    return models
  }

  /**
   * The catalog, or an empty list when it cannot be read.
   *
   * Listing models is a browsing action on a settings page, so a failure must
   * degrade to "nothing to show" rather than break the page. The request path
   * uses {@link models} directly and keeps the real failure.
   * @param signal - optional cancellation.
   * @returns the catalog, or an empty list.
   */
  async modelsOrEmpty(signal?: AbortSignal): Promise<readonly CodeBuddyModel[]> {
    try {
      return await this.models(signal)
    } catch (error) {
      if (error instanceof NotLoggedInError) return []
      this.logger?.warn('dsh-codebuddy: could not read the model catalog')
      this.logger?.warn(error)
      return []
    }
  }

  /**
   * The CodeBuddy usage/quota snapshot, or `undefined` when it cannot be read.
   *
   * Usage is an advisory read on a settings surface, so a meter outage must
   * degrade to "nothing to show" rather than propagate: a {@link NotLoggedInError}
   * surfaces as a signed-out state, and every other failure (transport, parse,
   * expired refresh) resolves to `undefined` after a warning. The identity is
   * resolved through the same single-flight refresh as a chat request, so a
   * concurrent meter read never spends the refresh token twice.
   * @param signal - optional cancellation.
   * @returns the snapshot, or `undefined` when nothing is stored or the meter
   *   plane was unreachable.
   */
  async usage(signal?: AbortSignal): Promise<UsageSnapshot | undefined> {
    let identity: CodeBuddyIdentity
    let endpoint: string
    try {
      const storage = await this.require()
      endpoint = resolveEntryEndpoint(activeEntry(storage))
      identity = await this.identity()
    } catch (error) {
      if (error instanceof NotLoggedInError) return undefined
      this.logger?.warn('dsh-codebuddy: could not resolve identity for usage read')
      this.logger?.warn(error)
      return undefined
    }
    return fetchUsage(endpoint, identity, signal)
  }
}
