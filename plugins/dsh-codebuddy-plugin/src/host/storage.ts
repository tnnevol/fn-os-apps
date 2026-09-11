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
import { SerialQueue } from './concurrency.ts'
import {
  CODEBUDDY_CLIENT_ENDPOINTS,
  CODEBUDDY_CLIENT_VERSIONS,
  CODEBUDDY_ENDPOINT,
  CODEBUDDY_ENVIRONMENT_ENDPOINTS,
  normalizeClientId,
  type CodeBuddyClientId,
  type CodeBuddyEnvironment,
} from '../contracts/constants.ts'
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
  /**
   * 登录时声明的客户端身份（`cli` / `workbuddy`）。
   *
   * 决定登录页与用量平面：WorkBuddy 走 `www.workbuddy.cn`，CLI 走环境默认地址。
   * 缺省视为 `cli`——历史条目在建此字段之前全部由 CLI 登录产生。
   */
  client?: CodeBuddyClientId
  /**
   * 该客户端上报的固定版本号（CLI 2.145.0 / WorkBuddy 5.5.4）。
   *
   * 存下来是为了让面板展示与实际请求一致：版本是产品发布版本、不随时间变化，
   * 因此它是账号属性而不是运行时随机值。
   */
  clientVersion?: string
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
  options: { label?: string, environment?: string, endpoint?: string, client?: CodeBuddyClientId } = {},
): CodeBuddyAccountEntry {
  const trimmed = options.label?.trim()
  const environment = options.environment?.trim()
  const endpoint = options.endpoint?.trim().replace(/\/+$/, '')
  // 客户端身份与版本都是账号的稳定属性：版本取自固定映射，不随机生成。
  const client = normalizeClientId(options.client)
  // 时长字段可能缺失：缺省时按 0 处理（即「立即过期」），由后续的刷新流程接管；
  // 直接用 undefined 做乘法则会得到 NaN，NaN 比较恒为 false，会静默变成
  // 「永不过期」这种最危险的结果。
  const expiresIn = token.expiresIn ?? 0
  const refreshExpiresIn = token.refreshExpiresIn ?? 0
  return {
    id: randomUUID(),
    auth: {
      accessToken: token.accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
      // refreshToken 缺失时存空串：调用方用真值判断，空串等价于「没有可刷新凭据」，
      // 比存 undefined 更能被既有逻辑安全处理。
      refreshToken: token.refreshToken ?? '',
      refreshExpiresAt: Date.now() + refreshExpiresIn * 1000,
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
    client,
    clientVersion: CODEBUDDY_CLIENT_VERSIONS[client],
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
  // WorkBuddy 账号的登录与计费都在 workbuddy.cn，与环境无关：环境端点表里没有
  // 它，若按环境解析会把请求打到 CodeBuddy 的地址上（凭据不被承认）。
  const client = normalizeClientId(entry.client)
  if (client !== 'cli') return CODEBUDDY_CLIENT_ENDPOINTS[client]
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
  const client = normalizeClientId(entry.client)
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
    // **客户端身份必须原样保留**。它是决定请求发往哪个服务平面的字段
    // （见 resolveEntryEndpoint），而本函数是逐字段白名单重建——漏掉它会让
    // 每次读盘都把 WorkBuddy 账号降级成 CLI：
    //   client 丢失 → normalizeClientId 回落 'cli' → 端点变成 copilot.tencent.com，
    //   而凭据签发于 www.workbuddy.cn → 服务端不认，账号表现为「掉线」。
    // 且 loadStorage 的结果会被各写路径（切换/改名/删除/刷新）回写磁盘，
    // 因此不是内存态问题，而是**持久化擦除**。
    // 教训：白名单重建时新增的持久化字段必须同步加到这里。
    client,
    clientVersion: entry.clientVersion ?? CODEBUDDY_CLIENT_VERSIONS[client],
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
 * 凭据文档的写入串行队列。
 *
 * 文档是**单个 JSON**（全部账号共处一份），写入点分散在 session 与 auth-service
 * 两处（切换、改名、删除、登录、token 刷新）。并发写各读一次旧值再各自写回时，
 * 后写的那次会**整体覆盖**前一次的结果，表现为「刚切过去的账号又变回去」
 * 「刚删掉的账号复活」「刚改的备注名丢了」。同类竞态此前已在 token 刷新路径上
 * 真实发生过。
 *
 * 锁放在 storage 层而不是各调用方：只有包住「读-改-写」整个事务才能挡住跨模块
 * 的竞态；放在某个类里只能串行那个类自己的写入。
 */
const mutationQueue = new SerialQueue()

/**
 * 在锁内对凭据文档做一次「读 → 改 → 写」事务。
 *
 * `mutate` 收到**锁内最新**的文档（可能是别的写入刚改过的），返回的新文档会被
 * 立即持久化；返回 `undefined` 表示放弃本次写入（例如 CAS 失败或账号不存在），
 * 此时不落盘也不报错。整个事务期间持有锁，因此不会与其它写入交叉。
 *
 * @param mutate - 纯函数式改动；返回新文档则写入，返回 `undefined` 则放弃。
 * @returns `mutate` 的返回值（写入后的文档或 `undefined`）。
 */
export async function mutateStorage(
  mutate: (current: CodeBuddyStorage | undefined) => CodeBuddyStorage | undefined | Promise<CodeBuddyStorage | undefined>,
): Promise<CodeBuddyStorage | undefined> {
  return mutationQueue.runExclusive(async () => {
    const current = await loadStorage()
    const next = await mutate(current)
    if (next === undefined) return undefined
    await saveStorage(next)
    return next
  })
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
  /**
   * 磁盘上是否确实存在这份配置。
   *
   * 区分「读到了真实配置」与「文件不存在、返回了默认值」——调用方据此判断
   * 能否让客户端把已有的 localStorage 值迁移上来（老用户升级），还是必须
   * 一律以 Host 为准（否则就是用旧值覆盖新值）。
   */
  fromDisk: boolean
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
      fromDisk: true,
    }
  } catch {
    // 文件不存在或损坏：返回默认值，并标明它**不是**磁盘上的权威配置。
    return { enabled: true, thresholdPct: 10, fromDisk: false }
  }
}

/** Write the auto-switch preferences atomically. */
export async function saveAutoSwitchConfig(config: Omit<AutoSwitchConfig, 'fromDisk'>): Promise<void> {
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

/** Persisted auto-checkin preference: whether the plugin signs in all
 *  accounts every day without manual action. Defaults on, mirroring the
 *  official workbuddy-switch tray behaviour. */
export interface AutoCheckinConfig {
  enabled: boolean
}

function getAutoCheckinConfigPath(): string {
  return `${getStoragePath()}.auto-checkin.json`
}

/** Read the auto-checkin preference; defaults on. */
export async function loadAutoCheckinConfig(): Promise<AutoCheckinConfig> {
  try {
    const raw = await fs.readFile(getAutoCheckinConfigPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AutoCheckinConfig>
    return { enabled: parsed.enabled === true }
  } catch {
    return { enabled: true }
  }
}

/** Write the auto-checkin preference atomically. */
export async function saveAutoCheckinConfig(config: AutoCheckinConfig): Promise<void> {
  const path = getAutoCheckinConfigPath()
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

/** Persisted auto-travel preference: whether the plugin dispatches the
 *  growth-centre buddy travel (and claims its reward) without manual action.
 *  Defaults on, mirroring workbuddy-switch. */
export interface AutoTravelConfig {
  enabled: boolean
}

function getAutoTravelConfigPath(): string {
  return `${getStoragePath()}.auto-travel.json`
}

/** Read the auto-travel preference; defaults on. */
export async function loadAutoTravelConfig(): Promise<AutoTravelConfig> {
  try {
    const raw = await fs.readFile(getAutoTravelConfigPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AutoTravelConfig>
    return { enabled: parsed.enabled === true }
  } catch {
    return { enabled: true }
  }
}

/** Write the auto-travel preference atomically. */
export async function saveAutoTravelConfig(config: AutoTravelConfig): Promise<void> {
  const path = getAutoTravelConfigPath()
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
