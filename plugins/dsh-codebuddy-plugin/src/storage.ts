/**
 * Durable OAuth token storage, owner-only on disk.
 *
 * The store lives in the harness home (`$DSH_HOME`, resolved via the same
 * `@deepseek-ai/dsh-home-paths` the harness uses) rather than in the plugin
 * package, so a reinstall does not sign the user out. Writes are atomic
 * (write-temp-then-rename): a torn file would strand the user with an
 * unreadable credential and no way to tell that from "never logged in".
 *
 * The document is multi-account: one entry per signed-in CodeBuddy account
 * plus which one is active. Every reader goes through {@link loadStorage},
 * which also migrates the legacy single-account shape in place, so callers
 * only ever see the current shape.
 *
 * @module dsh-codebuddy/storage
 */

import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { CODEBUDDY_ENDPOINT, CODEBUDDY_ENVIRONMENT_ENDPOINTS, type CodeBuddyEnvironment } from './constants.ts'
import type { Account, AuthToken } from './types.ts'

/** One stored account: credential facts plus the account facts they were issued for. */
export interface CodeBuddyAccountEntry {
  /** Stable local id for this entry, assigned at login and used for switching. */
  id: string
  auth: {
    accessToken: string
    /** Absolute expiry in epoch ms. */
    expiresAt: number
    refreshToken: string
    /** Absolute refresh-token expiry in epoch ms. */
    refreshExpiresAt: number
    domain: string
  }
  account: {
    uid: string
    nickname: string
    /** Local display label set at login; falls back to `nickname` when absent. */
    label?: string
    /** Tencent user identity number (e.g. QQ openid), when the account discloses one. */
    uin?: string
    enterpriseId?: string
    /** Enterprise display name, when the account is an enterprise tenant. */
    enterpriseName?: string
    /** Enterprise user name (the account's name within the tenant). */
    enterpriseUserName?: string
    departmentFullName?: string
  }
  /**
   * The network environment this credential was issued against
   * (`CODEBUDDY_INTERNET_ENVIRONMENT`). Absent on entries stored before
   * environments existed; {@link resolveEntryEndpoint} then treats the entry
   * as `internal` — the legacy hard-coded endpoint — for compatibility.
   */
  environment?: string
  /**
   * Explicit service root for `cloudhosted`/`selfhosted` accounts (the
   * enterprise's own address). Absent means "use the environment default".
   */
  endpoint?: string
}

/**
 * The persisted shape. `activeId` always points at an entry of `accounts`
 * after a successful save; a transient mismatch (a hand-edited file) reads as
 * "first entry active" rather than "no account".
 */
export interface CodeBuddyStorage {
  /** Id of the entry every request authenticates with. */
  activeId: string
  accounts: CodeBuddyAccountEntry[]
}

/**
 * @deprecated Legacy single-account shape, migrated by {@link loadStorage}.
 */
export interface LegacyCodeBuddyStorage {
  auth: CodeBuddyAccountEntry['auth']
  account: CodeBuddyAccountEntry['account']
}

/**
 * Build the durable credential from freshly issued tokens and the account
 * facts.
 *
 * Shared by every login path so they cannot drift on the storage shape: the
 * Web auth service writes exactly this object. The entry id is a fresh local
 * uuid; re-logging the same account adds a new entry and the login path
 * dedupes by uid afterwards.
 * @param token - tokens issued once the browser login completed.
 * @param account - the signed-in account the tokens were issued for.
 * @param options - optional login facts: `label` (local display label
 *   overriding `account.nickname`), `environment` (the network the login was
 *   made against) and `endpoint` (explicit service root for
 *   cloudhosted/selfhosted).
 * @returns the credential entry to persist.
 */
export function buildAccountEntry(
  token: AuthToken,
  account: Account,
  options: { label?: string, environment?: string, endpoint?: string } = {},
): CodeBuddyAccountEntry {
  const trimmed = options.label?.trim()
  const environment = options.environment?.trim()
  const endpoint = options.endpoint?.trim().replace(/\/+$/, '')
  return {
    id: randomUUID(),
    auth: {
      accessToken: token.accessToken,
      expiresAt: Date.now() + token.expiresIn * 1000,
      refreshToken: token.refreshToken,
      refreshExpiresAt: Date.now() + token.refreshExpiresIn * 1000,
      domain: token.domain,
    },
    account: {
      uid: account.uid,
      nickname: account.nickname,
      ...trimmed === undefined || trimmed.length === 0 ? {} : { label: trimmed },
      ...account.uin === undefined ? {} : { uin: account.uin },
      ...account.enterpriseId === undefined ? {} : { enterpriseId: account.enterpriseId },
      ...account.enterpriseName === undefined ? {} : { enterpriseName: account.enterpriseName },
      ...account.enterpriseUserName === undefined ? {} : { enterpriseUserName: account.enterpriseUserName },
      ...account.departmentFullName === undefined
        ? {}
        : { departmentFullName: account.departmentFullName },
    },
    ...environment === undefined || environment.length === 0 ? {} : { environment },
    ...endpoint === undefined || endpoint.length === 0 ? {} : { endpoint },
  }
}

/**
 * @deprecated Legacy single-account constructor, kept for callers that still
 * name {@link buildStorage}; delegates to {@link buildAccountEntry}.
 */
export function buildStorage(token: AuthToken, account: Account): CodeBuddyAccountEntry {
  return buildAccountEntry(token, account)
}

/**
 * The effective service root for one account entry.
 *
 * Resolution order: the entry's explicit `endpoint` (cloudhosted/selfhosted),
 * then the environment's default endpoint, then the legacy hard-coded
 * endpoint for entries stored before environments existed. Every request —
 * auth handshake, refresh, catalog, metering, chat — must go through this
 * function so a credential is never sent to a foreign host.
 * @param entry - the stored account entry.
 * @returns the service root without a trailing slash.
 */
export function resolveEntryEndpoint(entry: CodeBuddyAccountEntry): string {
  const explicit = entry.endpoint?.trim().replace(/\/+$/, '')
  if (explicit !== undefined && explicit.length > 0) return explicit
  const env = entry.environment?.trim().toLowerCase() as CodeBuddyEnvironment | undefined
  if (env !== undefined && env in CODEBUDDY_ENVIRONMENT_ENDPOINTS) {
    return CODEBUDDY_ENVIRONMENT_ENDPOINTS[env as Exclude<CodeBuddyEnvironment, 'cloudhosted' | 'selfhosted'>]
  }
  return CODEBUDDY_ENDPOINT
}

/**
 * Normalize one account entry: drop empty optional strings so every
 * consumer's `=== undefined` check holds.
 * @param entry - the raw entry.
 * @returns the entry with empty optional account fields removed.
 */
function normalizeEntry(entry: CodeBuddyAccountEntry): CodeBuddyAccountEntry {
  const a = entry.account
  const pick = (v: string | undefined): string | undefined =>
    v === undefined || v.length === 0 ? undefined : v
  const label = pick(a.label)?.trim()
  const environment = pick(entry.environment)?.toLowerCase()
  const endpoint = pick(entry.endpoint)?.replace(/\/+$/, '')
  return {
    id: entry.id,
    auth: entry.auth,
    account: {
      uid: a.uid,
      nickname: a.nickname,
      ...label === undefined || label.length === 0 ? {} : { label },
      ...pick(a.uin) === undefined ? {} : { uin: a.uin },
      ...pick(a.enterpriseId) === undefined ? {} : { enterpriseId: a.enterpriseId },
      ...pick(a.enterpriseName) === undefined ? {} : { enterpriseName: a.enterpriseName },
      ...pick(a.enterpriseUserName) === undefined ? {} : { enterpriseUserName: a.enterpriseUserName },
      ...pick(a.departmentFullName) === undefined ? {} : { departmentFullName: a.departmentFullName },
    },
    ...environment === undefined ? {} : { environment },
    ...endpoint === undefined ? {} : { endpoint },
  }
}

/** Whether a parsed value looks like the current multi-account document. */
function isMultiAccount(value: object): value is CodeBuddyStorage {
  return 'activeId' in value && 'accounts' in value && Array.isArray((value as CodeBuddyStorage).accounts)
}

/**
 * Accept the legacy `{auth, account}` document as the initial single entry.
 * @param legacy - the pre-multi-account credential.
 * @returns the migrated multi-account shape with the legacy account active.
 */
function migrateLegacy(legacy: LegacyCodeBuddyStorage): CodeBuddyStorage {
  const entry = normalizeEntry({ id: randomUUID(), auth: legacy.auth, account: legacy.account })
  return { activeId: entry.id, accounts: [entry] }
}

/**
 * Absolute path of the credential file.
 *
 * Resolved through `@deepseek-ai/dsh-home-paths` so it tracks the harness's
 * own home precedence (configured path > `$DSH_HOME` > `~/.dsh`) and never
 * diverges into a separately-computed home. `DSH_CODEBUDDY_AUTH_FILE`
 * remains as an explicit escape hatch for tests and relocations.
 */
export function getStoragePath(): string {
  const override = process.env.DSH_CODEBUDDY_AUTH_FILE
  if (override !== undefined && override.length > 0) return override
  return dshHomePath('codebuddy-auth.json')
}

/**
 * Whether a path is readable by its owner only.
 *
 * Mirrors the owner-only check `@deepseek-ai/dsh-credentials-local` makes
 * before loading its own credential document: any group or other read/write
 * bit set means the file is exposed, and the check fails. Windows has no
 * POSIX mode, so the check is skipped there — protection is whatever the
 * create and replace APIs expressed, as on dsh-credentials-local.
 * @param path - the credential file path.
 * @returns true when the file is absent (nothing to protect yet) or exists
 *   with owner-only permission; false when it exists and is exposed.
 */
async function isOwnerOnly(path: string): Promise<boolean> {
  if (process.platform === 'win32') return true
  let mode: number
  try {
    mode = (await fs.stat(path)).mode
  } catch {
    // Absent is not an exposure; the caller treats it as "no credential".
    return true
  }
  // 0o077 = group + other read/write/execute bits.
  return (mode & 0o077) === 0
}

/**
 * Read the stored credential document, migrating the legacy single-account
 * shape when encountered.
 *
 * Before any byte is read, the file's mode is checked: a credential that
 * other users on the host could read is treated as absent rather than used,
 * so a file that lost its owner-only mode (a bad manual chmod, a copy from
 * elsewhere) is never loaded. Treating it as absent also self-heals — the
 * next login rewrites the file with `0o600`.
 *
 * The legacy `{auth, account}` document migrates transparently: it becomes a
 * one-entry multi-account store with that entry active, and stays in memory
 * only — the next save rewrites the new shape. A document whose `activeId`
 * does not match any entry keeps its entries but resolves the first one as
 * active, so a hand-edited file degrades to "another account active" rather
 * than "signed out".
 * @returns the credential document, or `undefined` when absent or unusable.
 *   A missing file, a corrupt one, and an insecurely-permissioned one are
 *   deliberately the same answer: all mean "there is nothing safe here to
 *   authenticate with", and the login flow is the fix for each.
 */
export async function loadStorage(): Promise<CodeBuddyStorage | undefined> {
  const path = getStoragePath()
  try {
    if (!(await isOwnerOnly(path))) return undefined
    const raw = await fs.readFile(path, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (parsed === null || typeof parsed !== 'object') return undefined
    if (isMultiAccount(parsed)) {
      const accounts = parsed.accounts
        .filter(entry => entry !== null && typeof entry === 'object'
          && typeof entry.id === 'string' && entry.id.length > 0
          && entry.auth?.accessToken !== undefined
          && entry.account?.uid !== undefined)
        .map(normalizeEntry)
      if (accounts.length === 0) return undefined
      const activeId = accounts.some(entry => entry.id === parsed.activeId)
        ? parsed.activeId
        : accounts[0]!.id
      return { activeId, accounts }
    }
    const legacy = parsed as LegacyCodeBuddyStorage
    if (legacy.auth?.accessToken === undefined || legacy.account?.uid === undefined) return undefined
    return migrateLegacy(legacy)
  } catch {
    return undefined
  }
}

/**
 * The active account entry.
 * @param storage - the credential document.
 * @returns the entry `activeId` points at, or the first entry.
 */
export function activeEntry(storage: CodeBuddyStorage): CodeBuddyAccountEntry {
  const active = storage.accounts.find(entry => entry.id === storage.activeId)
  return active ?? storage.accounts[0]!
}

/**
 * Write the credential document atomically with owner-only permissions.
 * @param storage - the credential document to persist.
 */
export async function saveStorage(storage: CodeBuddyStorage): Promise<void> {
  const path = getStoragePath()
  await fs.mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await fs.writeFile(temp, JSON.stringify(storage, null, 2), { encoding: 'utf-8', mode: 0o600 })
    await fs.rename(temp, path)
  } catch (error) {
    await fs.unlink(temp).catch(() => {
      // The write already failed; a missing temp file adds no information.
    })
    throw error
  }
  await fs.chmod(path, 0o600).catch(() => {
    // Filesystems without POSIX modes (Windows, some network mounts) cannot
    // narrow permissions; the credential is still written.
  })
}

/** Persisted auto-switch preferences, kept beside the credential file. */
export interface AutoSwitchConfig {
  enabled: boolean
  thresholdPct: number
}

function getAutoSwitchConfigPath(): string {
  return `${getStoragePath()}.auto-switch.json`
}

/** Read the auto-switch preferences; defaults on with a 10% threshold. */
export async function loadAutoSwitchConfig(): Promise<AutoSwitchConfig> {
  try {
    const raw = await fs.readFile(getAutoSwitchConfigPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AutoSwitchConfig>
    return {
      enabled: parsed.enabled === true,
      thresholdPct: typeof parsed.thresholdPct === 'number' && Number.isFinite(parsed.thresholdPct)
        ? Math.max(0, Math.min(100, Math.round(parsed.thresholdPct)))
        : 10,
    }
  } catch {
    return { enabled: true, thresholdPct: 10 }
  }
}

/** Write the auto-switch preferences atomically. */
export async function saveAutoSwitchConfig(config: AutoSwitchConfig): Promise<void> {
  const path = getAutoSwitchConfigPath()
  await fs.mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await fs.writeFile(temp, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 })
    await fs.rename(temp, path)
  } catch (error) {
    await fs.unlink(temp).catch(() => {})
    throw error
  }
}

/** Remove the stored credential document, if any. */
export async function clearStorage(): Promise<void> {
  await fs.unlink(getStoragePath()).catch(() => {
    // Already absent is the desired end state.
  })
}
