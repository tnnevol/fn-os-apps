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
import { loadStorage, saveStorage } from './storage.ts'
import type { CodeBuddyStorage } from './storage.ts'
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
 * Owns the stored credential for one plugin instance.
 *
 * The credential is re-read from disk when absent from memory, which is what
 * lets a login completed in the Web UI reach a *running* harness without a
 * restart.
 */
export class CodeBuddySession {
  private storage: CodeBuddyStorage | undefined
  private refreshing: Promise<CodeBuddyIdentity> | undefined
  private catalog: { models: readonly CodeBuddyModel[], readAt: number } | undefined
  private catalogRead: Promise<readonly CodeBuddyModel[]> | undefined

  constructor(private readonly logger?: SessionLogger) {}

  /** Forget the in-memory credential and catalog, forcing a re-read from disk. */
  invalidate(): void {
    this.storage = undefined
    this.catalog = undefined
  }

  private identityOf(storage: CodeBuddyStorage): CodeBuddyIdentity {
    return {
      accessToken: storage.auth.accessToken,
      domain: storage.auth.domain,
      uid: storage.account.uid,
      ...storage.account.enterpriseId === undefined
        ? {}
        : { enterpriseId: storage.account.enterpriseId },
      ...storage.account.departmentFullName === undefined
        ? {}
        : { departmentFullName: storage.account.departmentFullName },
    }
  }

  /**
   * The stored credential, read from disk on first use and after invalidation.
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

  /** Whether a credential exists at all, without requiring one. */
  async isLoggedIn(): Promise<boolean> {
    this.storage ??= await loadStorage()
    return this.storage !== undefined
  }

  /** The signed-in nickname, when a credential exists. */
  async nickname(): Promise<string | undefined> {
    this.storage ??= await loadStorage()
    return this.storage?.account.nickname
  }

  /**
   * A usable identity, refreshing the access token when it is at or near
   * expiry. Concurrent callers share one refresh.
   * @returns the identity to authenticate a request with.
   * @throws NotLoggedInError when nothing is stored, or when the refresh token
   *   has itself expired and only a new browser login can recover.
   */
  async identity(): Promise<CodeBuddyIdentity> {
    const storage = await this.require()
    const now = Date.now()
    if (now < storage.auth.expiresAt - REFRESH_SKEW_MS) {
      return this.identityOf(storage)
    }
    if (now >= storage.auth.refreshExpiresAt) {
      throw new NotLoggedInError(
        'The CodeBuddy session has expired. Sign in again through Settings →'
        + ' CodeBuddy in the Web UI.',
      )
    }
    this.refreshing ??= this.refresh(storage).finally(() => {
      this.refreshing = undefined
    })
    return this.refreshing
  }

  private async refresh(storage: CodeBuddyStorage): Promise<CodeBuddyIdentity> {
    const refreshed = await refreshAccessToken(this.identityOf(storage), storage.auth.refreshToken)
    if (refreshed === undefined) {
      throw new NotLoggedInError(
        'Refreshing the CodeBuddy session failed. Sign in again through Settings →'
        + ' CodeBuddy in the Web UI.',
      )
    }
    const next: CodeBuddyStorage = {
      auth: {
        accessToken: refreshed.accessToken,
        expiresAt: Date.now() + refreshed.expiresIn * 1000,
        refreshToken: refreshed.refreshToken,
        refreshExpiresAt: Date.now() + refreshed.refreshExpiresIn * 1000,
        domain: refreshed.domain,
      },
      account: storage.account,
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
    return this.identityOf(next)
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
    const identity = await this.identity()
    const [config, enterpriseModels] = await Promise.all([
      getConfig(identity, signal),
      getEnterpriseModels(identity, signal),
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
    try {
      identity = await this.identity()
    } catch (error) {
      if (error instanceof NotLoggedInError) return undefined
      this.logger?.warn('dsh-codebuddy: could not resolve identity for usage read')
      this.logger?.warn(error)
      return undefined
    }
    return fetchUsage(identity, signal)
  }
}
