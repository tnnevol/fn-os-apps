/**
 * 持久化 OAuth token 存储，磁盘上仅属主可读。
 *
 * 存储放在 harness 主目录（`$DSH_HOME`，经与 harness 相同的
 * `@deepseek-ai/dsh-home-paths` 解析）而不是插件包里，因此重装不会把用户
 * 登出。写入是原子的（先写临时文件再改名）：一个损坏的文件会让用户陷入
 * 凭据不可读的困境，且无法与"从未登录"区分开。
 *
 * 文档是多账号的：每个已登录的 CodeBuddy 账号一条条目，外加哪一条是当前
 * 活动。所有读取都经过 {@link loadStorage}，它还会就地迁移旧的单账号
 * 结构，因此调用方只会看到当前结构。
 *
 * @module dsh-codebuddy/storage
 */

import type { CodeBuddyAccountEntry, CodeBuddyStorage, LegacyCodeBuddyStorage, AutoSwitchConfig, AutoCheckinConfig, AutoTravelConfig } from '../types/host/storage'
export type { CodeBuddyAccountEntry, CodeBuddyStorage, LegacyCodeBuddyStorage, AutoSwitchConfig, AutoCheckinConfig, AutoTravelConfig } from '../types/host/storage'
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

/**
 * 从新签发的 token 与账号事实构建持久化凭据。
 *
 * 所有登录路径共用它，避免它们在存储结构上各自漂移：Web 认证服务写出的
 * 正是这个对象。条目 id 是一个新鲜的本地 uuid；重新登录同一账号会新增一
 * 条条目，登录路径随后按 uid 去重。
 * @param token - 浏览器登录完成后签发的 token。
 * @param account - 这些 token 所签发给的已登录账号。
 * @param options - 可选的登录事实：`label`（覆盖 `account.nickname` 的
 *   本地展示备注名）、`environment`（登录所针对的网络）和 `endpoint`
 *   （cloudhosted/selfhosted 的显式服务根地址）。
 * @returns 待持久化的凭据条目。
 */
export function buildAccountEntry(
  token: AuthToken,
  account: Account,
  options: { label?: string, environment?: string, endpoint?: string, client?: CodeBuddyClientId } = {},
): CodeBuddyAccountEntry {
  /**
   * 备注名缺省时**回落到昵称**，而不是留空。
   *
   * 过去只在展示层做 `label ?? nickname` 回落，存储里始终没有 label。后果是
   * 「备注名」这一项在导出的凭据文件、日志、以及任何直接读文档的消费者眼里都是
   * **缺失**的——想知道这个账号叫什么只能自己去拼回落逻辑，而回落规则一旦分散就
   * 会各写各的。
   *
   * 落盘为昵称之后，「备注名」成为一份**自解释**的数据：读文档就能看到每个账号
   * 叫什么；用户之后通过重命名覆盖它即可。
   *
   * 注意 trim 后为空串也按缺省处理：表单清空或不填都会得到昵称。
   */
  const nickname = account.nickname.trim()
  const trimmed = options.label?.trim()
  const label = trimmed === undefined || trimmed.length === 0 ? nickname : trimmed
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
      // 始终写入：缺省时上面已回落为昵称（理由见函数开头）。
      // 昵称也为空（服务端未返回）时省略，让「没有名字」这一事实保持可见，
      // 而不是落一个空串进文档。
      ...label.length === 0 ? {} : { label },
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
 * @deprecated 旧的单账号构造函数，为仍在引用 {@link buildStorage} 的调用方
 * 保留；委托给 {@link buildAccountEntry}。
 */
export function buildStorage(token: AuthToken, account: Account): CodeBuddyAccountEntry {
  return buildAccountEntry(token, account)
}

/**
 * 一个账号条目的有效服务根地址。
 *
 * 解析顺序：条目的显式 `endpoint`（cloudhosted/selfhosted），其次环境的
 * 默认端点，最后是环境概念出现之前存储条目所用的旧版硬编码端点。每个
 * 请求——认证握手、刷新、模型目录、计量、聊天——都必须经过这个函数，
 * 这样凭据才绝不会被发给陌生主机。
 * @param entry - 已存储的账号条目。
 * @returns 不带末尾斜杠的服务根地址。
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
 * 规范化一个账号条目：剔除空的可选字符串，让所有消费方的
 * `=== undefined` 判断都成立。
 * @param entry - 原始条目。
 * @returns 移除了空的可选账号字段后的条目。
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

/** 判断解析出的值看起来是否是当前的多账号文档。 */
function isMultiAccount(value: object): value is CodeBuddyStorage {
  return 'activeId' in value && 'accounts' in value && Array.isArray((value as CodeBuddyStorage).accounts)
}

/**
 * 接受旧版 `{auth, account}` 文档，作为初始的唯一条目。
 * @param legacy - 多账号出现之前的凭据。
 * @returns 迁移后的多账号结构，旧账号为活动账号。
 */
function migrateLegacy(legacy: LegacyCodeBuddyStorage): CodeBuddyStorage {
  const entry = normalizeEntry({ id: randomUUID(), auth: legacy.auth, account: legacy.account })
  return { activeId: entry.id, accounts: [entry] }
}

/**
 * 凭据文件的绝对路径。
 *
 * 经 `@deepseek-ai/dsh-home-paths` 解析，因此遵循 harness 自身的主目录
 * 优先级（配置路径 > `$DSH_HOME` > `~/.dsh`），绝不会分叉到另一个单独
 * 计算的主目录。`DSH_CODEBUDDY_AUTH_FILE` 保留为测试与搬迁用的显式逃生口。
 */
export function getStoragePath(): string {
  const override = process.env.DSH_CODEBUDDY_AUTH_FILE
  if (override !== undefined && override.length > 0) return override
  return dshHomePath('codebuddy-auth.json')
}

/**
 * 路径是否仅属主可读。
 *
 * 与 `@deepseek-ai/dsh-credentials-local` 在加载自己的凭据文档前所做的
 * 仅属主检查一致：任何 group 或 other 的读/写位被置位即视为文件已暴露，
 * 检查失败。Windows 没有 POSIX mode，因此在那里跳过检查——保护程度
 * 取决于创建与替换 API 所表达的内容，与 dsh-credentials-local 相同。
 * @param path - 凭据文件路径。
 * @returns 文件不存在（尚无可保护之物）或以仅属主权限存在时为 true；
 *   文件存在且已暴露时为 false。
 */
async function isOwnerOnly(path: string): Promise<boolean> {
  if (process.platform === 'win32') return true
  let mode: number
  try {
    mode = (await fs.stat(path)).mode
  } catch {
    // 不存在不算暴露；调用方把它当作"没有凭据"。
    return true
  }
  // 0o077 = group + other 的读/写/执行位。
  return (mode & 0o077) === 0
}

/**
 * 读取已存储的凭据文档，遇到旧的单账号结构时予以迁移。
 *
 * 在读取任何字节之前，先检查文件的 mode：一个宿主机上其他用户可读的
 * 凭据按不存在对待而不被使用，因此丢失了仅属主 mode 的文件（一次错误
 * 的手工 chmod、从别处拷贝而来）绝不会被加载。按不存在对待还能自愈——
 * 下一次登录会以 `0o600` 重写该文件。
 *
 * 旧版 `{auth, account}` 文档透明迁移：变成一条条目为活动的多账号存储，
 * 且只存在于内存中——下一次保存会重写为新结构。`activeId` 不匹配任何
 * 条目的文档保留其条目但把第一条解析为活动，因此手工编辑过的文件退化为
 * "另一个账号是活动"而不是"已登出"。
 * @returns 凭据文档；不存在或不可用时为 `undefined`。文件缺失、损坏与
 *   权限不安全这三种情况刻意是同一个答案：都意味着"这里没有可安全用于
 *   认证的东西"，而登录流程对每一种都是修复手段。
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
 * 当前活动账号条目。
 * @param storage - 凭据文档。
 * @returns `activeId` 指向的条目，或第一条。
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
 * 以仅属主权限原子地写入凭据文档。
 * @param storage - 待持久化的凭据文档。
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
      // 写入本身已经失败；临时文件缺失提供不了额外信息。
    })
    throw error
  }
  await fs.chmod(path, 0o600).catch(() => {
    // 没有 POSIX mode 的文件系统（Windows、部分网络挂载）无法收窄权限；
    // 凭据仍会被写入。
  })
}

function getAutoSwitchConfigPath(): string {
  return `${getStoragePath()}.auto-switch.json`
}

/** 读取自动切号偏好；默认开启，阈值为 10%。 */
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

/** 原子地写入自动切号偏好。 */
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

function getAutoCheckinConfigPath(): string {
  return `${getStoragePath()}.auto-checkin.json`
}

/** 读取自动签到偏好；默认开启。 */
export async function loadAutoCheckinConfig(): Promise<AutoCheckinConfig> {
  try {
    const raw = await fs.readFile(getAutoCheckinConfigPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AutoCheckinConfig>
    return { enabled: parsed.enabled === true }
  } catch {
    return { enabled: true }
  }
}

/** 原子地写入自动签到偏好。 */
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

function getAutoTravelConfigPath(): string {
  return `${getStoragePath()}.auto-travel.json`
}

/** 读取自动出游偏好；默认开启。 */
export async function loadAutoTravelConfig(): Promise<AutoTravelConfig> {
  try {
    const raw = await fs.readFile(getAutoTravelConfigPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AutoTravelConfig>
    return { enabled: parsed.enabled === true }
  } catch {
    return { enabled: true }
  }
}

/** 原子地写入自动出游偏好。 */
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

/** 删除已存储的凭据文档（若存在）。 */
export async function clearStorage(): Promise<void> {
  await fs.unlink(getStoragePath()).catch(() => {
    // 本就不存在即是期望的终态。
  })
}
