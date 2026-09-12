/**
 * CodeBuddy 配额/用量计量：抓取并解析剩余额度。
 *
 * CodeBuddy 的计费平面拆分方式与 gproxy 参考实现一致：企业租户由
 * `get-enterprise-user-usage` 应答（单一的 limit/credit 配对），个人账号
 * 则由 `get-user-resource` 应答（每个当前活动套餐一个窗口）。两种结构除
 * 每个请求都携带的认证头之外毫无共同点，因此传输与解析路径按已登录账号
 * 是否披露了 `enterpriseId` 一次性分叉。
 *
 * 传给 Web 客户端的每个值都是普通的 number/string，因此这里返回的
 * {@link UsageSnapshot} 是自有数据——没有任何活跃会话对象逃出本模块。
 *
 * @module dsh-codebuddy/usage
 */

import type { UsageWindow, UsageSnapshot, MeterErrorResponse } from '../types/host/usage'
export type { UsageWindow, UsageSnapshot } from '../types/host/usage'
import { join } from 'node:path'
import { CODEBUDDY_IDE_VERSION } from '../contracts/constants.ts'
import type { CodeBuddyIdentity } from './codebuddy.ts'

/**
 * 每个 CodeBuddy 计量请求都携带的认证头。
 *
 * 与 {@link CodeBuddySession.authHeaders} 保持一致，外加模型目录读取所添加
 * 的 IDE 版本那一对头，因为计量平面会像 `/v3/config` 一样拒绝缺少它们的
 * 请求。放在这里而不是从会话模块再导出，是为了让计量路径拥有自己的头
 * 集合，绝不与聊天适配器的耦合。
 * @param identity - 已登录的身份。
 * @returns 请求头。
 */
function meterHeaders(identity: CodeBuddyIdentity): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': `CodeBuddyIDE/${CODEBUDDY_IDE_VERSION} CodeBuddy/${CODEBUDDY_IDE_VERSION}`,
    'Authorization': `Bearer ${identity.accessToken}`,
    'X-Domain': identity.domain,
    'X-User-Id': identity.uid,
  }
  if (identity.enterpriseId !== undefined) {
    headers['X-Enterprise-Id'] = identity.enterpriseId
    // 计量平面要求租户 id 同时以两个名字回显；gproxy 参考实现在
    // `x-enterprise-id` 旁边把 `x-tenant-id` 设成同一个企业 id，且曾观察到
    // `/v2/billing/meter/*` 拒绝缺少它的请求。
    headers['X-Tenant-Id'] = identity.enterpriseId
  }
  if (identity.departmentFullName !== undefined) {
    headers['X-Department-Info'] = identity.departmentFullName
  }
  return headers
}

/** 读取可能以数字或数字字符串到达的数值字段。 */
function number(value: unknown, key: string): number | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const raw = (value as Record<string, unknown>)[key]
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined
  if (typeof raw === 'string') {
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

/** 读取非空字符串字段。 */
function string(value: unknown, key: string): string | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const raw = (value as Record<string, unknown>)[key]
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined
}

/** 已用占额度的百分比，钳制在 [0, 100]。 */
function percent(used: number, limit: number): number | undefined {
  return limit > 0 ? Math.min(Math.max((used / limit) * 100, 0), 100) : undefined
}

/** 沿一串对象键逐层深入 JSON 值，返回叶节点或 undefined。 */
function pointer(value: unknown, path: readonly string[]): unknown {
  let current: unknown = value
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/**
 * 把 Unix 时间戳格式化为本地时区的 `YYYY-MM-DD HH:mm:ss`，即个人计量
 * 接口的 `SlicePeriod*` 边界所期望的形态。
 *
 * gproxy 参考实现按 UTC 格式化；CodeBuddy 服务端只要求两个边界约定一致，
 * 两种都可接受，而本地格式化与 IDE 客户端发送的内容一致，读取结果更
 * 不容易落在服务端自身预期之外。
 * @param timestamp - Unix 秒数。
 * @returns 格式化后的时间戳。
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const pad = (n: number): string => n < 10 ? `0${n}` : String(n)
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

/**
 * 规范化个人套餐的重置时间戳。
 *
 * CodeBuddy 把套餐的 `CycleEndTime` 报告为其最后一个活动日的收尾
 * （`23:59:59`）。这读起来像"午夜前一瞬重置"，但配额实际是在次日的
 * `00:00:00` 重置，因此当值以 `23:59:59` 结尾时，展示值会向后加一秒进入
 * 次日。其他值原样通过，无法解析的时间戳按原值返回而不是丢弃
 * （有数字总比没有好）。
 * @param raw - `CycleEndTime` 字符串，`YYYY-MM-DD HH:mm:ss`。
 * @returns 规范化后的时间戳字符串。
 */
function normalizeResetTime(raw: string): string {
  if (!raw.endsWith('23:59:59')) return raw
  // `YYYY-MM-DD HH:mm:ss` → ISO `YYYY-MM-DDTHH:mm:ss`，让 Date 能解析
  // （空格形式非标准，在严格的引擎里会得到 Invalid Date）。
  const date = new Date(raw.replace(' ', 'T'))
  // 意外形态导致的 `Invalid Date`：保持原值不动。
  if (Number.isNaN(date.getTime())) return raw
  date.setSeconds(date.getSeconds() + 1)
  const pad = (n: number): string => n < 10 ? `0${n}` : String(n)
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

/**
 * 套餐周期是否已经结束。
 *
 * 计量请求把范围限定在今天的切片，但一个过期周期（当天早些时候到期的
 * 套餐，或过滤器漏掉的状态值）仍可能出现在应答里。已过期套餐的剩余
 * 额度不再属于合并池，因此在构建窗口前将其剔除。
 * @param cycleEndTime - `CycleEndTime` 字符串，`YYYY-MM-DD HH:mm:ss`。
 * @returns 当周期在当前时刻之前结束时为 true。
 */
function isExpired(cycleEndTime: string | undefined): boolean {
  if (cycleEndTime === undefined) return false
  const date = new Date(cycleEndTime.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return false
  return date.getTime() < Date.now()
}

/**
 * 解析个人账号的 `get-user-resource` 应答。
 *
 * accounts 数组可能位于多个指针根路径之一，取决于请求经过的网关；按顺序
 * 逐一尝试，命中第一个找到的数组。每个账号贡献一个以其套餐命名的
 * {@link UsageWindow}（优先展示名，id 码作后备），`used` 按
 * `limit - remaining` 推导（因此剩余量超过上限时会被钳制为已用零而非
 * 负数）。周期已经结束的套餐被排除。
 * @param accounts - 定位到的 accounts 数组。
 * @returns 组装好的快照。
 */
function personalUsage(accounts: unknown[]): UsageSnapshot {
  const windows: UsageWindow[] = accounts.flatMap((resource, index): UsageWindow[] => {
    const rawReset = string(resource, 'CycleEndTime')
    // 已过期周期的配额已经没了；保留它会让不再可花的容量虚增合并池。
    if (isExpired(rawReset)) return []
    const limit = number(resource, 'CycleCapacitySizePrecise') ?? 0
    const left = number(resource, 'CycleCapacityRemainPrecise') ?? 0
    const used = Math.max(limit - left, 0)
    // 优先使用人类可读的套餐名（"CodeBuddy个人体验版"）；代码
    // （`TCACA_code_008_cfWoLwvjU4`）只是个 id，读起来像噪音。
    const name = string(resource, 'PackageName')
      ?? string(resource, 'PackageCode')
      ?? string(resource, 'ResourceId')
      ?? `resource_${index}`
    // 套餐的 `CycleEndTime` 落在其最后一个活动日的 `23:59:59`；
    // 把它推到次日的 `00:00:00`，那才是配额实际重置的时刻。
    const resetsAt = rawReset === undefined ? undefined : normalizeResetTime(rawReset)
    // 有上限的窗口一起报告 used/limit/percent；无上限的窗口只报告名称，
    // 这样单条额度条可以显示"无配额"，而不是毫无意义的零比零。
    if (limit <= 0) {
      return [{ name, ...resetsAt === undefined ? {} : { resetsAt } }]
    }
    const pct = percent(used, limit)
    return [{
      name,
      used,
      limit,
      ...pct === undefined ? {} : { usedPercent: pct },
      ...resetsAt === undefined ? {} : { resetsAt },
    }]
  })
  return { windows, ...windows.length > 0 ? { primary: windows[0] } : {} }
}

/**
 * 解析企业租户的 `get-enterprise-user-usage` 应答。
 *
 * 企业计量平面在 `data` 下报告一对单一的 `limitNum`/`credit`
 * （网关不包裹时直接在根上），因此只构建一个窗口。
 * @param data - 数字所在的数据对象。
 * @returns 组装好的快照；未披露额度时为 `undefined`。
 */
function enterpriseUsage(data: unknown): UsageSnapshot | undefined {
  const limit = number(data, 'limitNum')
  if (limit === undefined) return undefined
  const used = number(data, 'credit') ?? 0
  const reset = string(data, 'cycleResetTime')
  const pct = percent(used, limit)
  const window: UsageWindow = {
    name: 'enterprise',
    used,
    limit,
    ...pct === undefined ? {} : { usedPercent: pct },
    ...reset === undefined ? {} : { resetsAt: reset },
  }
  return { windows: [window], primary: window }
}

/**
 * 把一份计量应答解析成快照。
 *
 * gproxy 参考实现会在它被观察到的每个指针根路径下尝试个人 `Accounts`
 * 数组，只有没有任何数组命中时才回退到企业单窗口解析——不论实际发送
 * 的是哪条请求路径。镜像这一顺序，可以让恰好携带 `enterpriseId` 的个人
 * 账号（或反之）按其真正应答的结构解析，而不是按其凭证所暗示的结构。
 * @param raw - 解析后的应答体。
 * @returns 组装好的快照；应答体没有任何可解析内容时为 `undefined`。
 */
export function parseUsage(raw: unknown): UsageSnapshot | undefined {
  // 尝试个人计量平面被观察到使用过的每个指针根路径。
  const accountsRoots: readonly (readonly string[])[] = [
    ['data', 'Response', 'Data', 'Accounts'],
    ['data', 'data', 'Response', 'Data', 'Accounts'],
    ['Response', 'Data', 'Accounts'],
  ]
  for (const path of accountsRoots) {
    const candidate = pointer(raw, path)
    if (Array.isArray(candidate)) {
      return personalUsage(candidate)
    }
    if (candidate === null) {
      return { windows: [] }
    }
  }
  const data = pointer(raw, ['data', 'data']) ?? pointer(raw, ['data']) ?? raw
  return enterpriseUsage(data)
}

/**
 * 个人计量的切片周期边界，取今天的本地一天。
 *
 * 计量平面的 `SlicePeriod*` 过滤器把每个套餐的用量限定在与该区间重叠的
 * 切片上，因此一个当天 `00:00:00`–`23:59:59` 的窗口会返回当前活动计费
 * 周期的数字（即满足 `CycleStartTime` ≤ 今天 ≤ `CycleEndTime` 的套餐）。
 * 早先的 `PackageEndTimeRange*` 过滤器改为按结束时间匹配套餐，会漏掉
 * 周期在本月晚些时候才结束的活动套餐。
 * @returns `{ begin, end }` 配对，为 `YYYY-MM-DD HH:mm:ss` 字符串。
 */
function todayRange(): { begin: string, end: string } {
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(midnight)
  endOfDay.setHours(23, 59, 59, 0)
  return { begin: formatTime(midnight.getTime() / 1000), end: formatTime(endOfDay.getTime() / 1000) }
}

/**
 * POST 到计量端点并解析应答，所有失败模式一律退化为 `undefined` 而
 * 不是抛出。
 *
 * 用量只是设置界面上的咨询性读取，因此传输故障、非 2xx 状态、无法解析
 * 的应答体或非零的服务端 `code` 都只意味着"不展示用量"——绝不能让侧边
 * 栏底部的额度条损坏。
 * @param identity - 已登录的身份，由会话负责刷新。
 * @param endpoint - 账号所在环境的服务根地址。
 * @param path - 端点下的计量路径。
 * @param body - JSON 请求体。
 * @param signal - 可选的取消信号。
 * @returns 解析后的快照；计量平面不可达或应答体不可用时为 `undefined`。
 */
async function postMeter(
  endpoint: string,
  identity: CodeBuddyIdentity,
  path: string,
  body: string,
  signal?: AbortSignal,
): Promise<UsageSnapshot | undefined> {
  let response: Response
  try {
    response = await fetch(`${endpoint}${path}`, {
      method: 'POST',
      headers: meterHeaders(identity),
      body,
      ...signal === undefined ? {} : { signal },
    })
  } catch {
    return undefined
  }
  if (!response.ok) return undefined
  let raw: unknown
  try {
    raw = await response.json()
  } catch {
    return undefined
  }
  // 计量平面把错误包成 `{code, msg}` 信封；非零 code 是被拒绝的读取，
  // 不是用量快照。
  const envelope = raw as MeterErrorResponse | undefined
  if (envelope !== null && typeof envelope === 'object'
    && envelope.code !== undefined && envelope.code !== 0) {
    return undefined
  }
  return parseUsage(raw)
}

/**
 * 抓取个人账号的用量：每个活动套餐一个窗口。
 *
 * 请求携带切片周期边界（今天的本地一天）以及 gproxy 参考实现所使用的
 * 产品/状态过滤器。
 * @param identity - 已登录的身份，由会话负责刷新。
 * @param signal - 可选的取消信号。
 * @returns 解析后的快照；计量平面不可达时为 `undefined`。
 */
export async function fetchPersonalUsage(
  endpoint: string,
  identity: CodeBuddyIdentity,
  signal?: AbortSignal,
): Promise<UsageSnapshot | undefined> {
  const { begin, end } = todayRange()
  const body = JSON.stringify({
    PageNumber: 1,
    PageSize: 200,
    ProductCode: 'p_tcaca',
    Status: [0, 3],
    SlicePeriodStartTime: begin,
    SlicePeriodEndTime: end,
  })
  return postMeter(endpoint, identity, '/v2/billing/meter/get-user-resource', body, signal)
}

/**
 * 抓取企业租户的用量：一对单一的 `limitNum`/`credit`。
 *
 * 企业计量平面接受空请求体并在 `data` 下应答，因此请求就是一个带认证
 * 的 POST。
 * @param identity - 已登录的身份，由会话负责刷新。
 * @param signal - 可选的取消信号。
 * @returns 解析后的快照；计量平面不可达时为 `undefined`。
 */
export async function fetchEnterpriseUsage(
  endpoint: string,
  identity: CodeBuddyIdentity,
  signal?: AbortSignal,
): Promise<UsageSnapshot | undefined> {
  return postMeter(endpoint, identity, '/v2/billing/meter/get-enterprise-user-usage', '{}', signal)
}

/**
 * 抓取并解析 CodeBuddy 用量快照，按账号类型分叉。
 *
 * 根据已登录身份是否披露了 `enterpriseId`，委托给
 * {@link fetchPersonalUsage} 或 {@link fetchEnterpriseUsage}。所有失败模式
 * 都解析为 `undefined` 而不是抛出；是否重试由调用方决定。
 * @param identity - 已登录的身份，由会话负责刷新。
 * @param signal - 可选的取消信号。
 * @returns 解析后的快照；计量平面不可达或应答体不可用时为 `undefined`。
 */
export async function fetchUsage(
  endpoint: string,
  identity: CodeBuddyIdentity,
  signal?: AbortSignal,
): Promise<UsageSnapshot | undefined> {
  return identity.enterpriseId !== undefined
    ? fetchEnterpriseUsage(endpoint, identity, signal)
    : fetchPersonalUsage(endpoint, identity, signal)
}

/* ==========================================================================
 * 签到与积分到期：与 workbuddy-switch 同一 meter 平面（/v2/billing/meter/*）。
 * 状态查询优先 checkin-activity-status，失败回退 checkin-status；提交走
 * daily-checkin，服务端回「已签到」按成功处理。
 * ========================================================================== */

const CHECKIN_API_PREFIX = '/v2/billing/meter'

/** GET/POST 一个 meter 接口并把 {code,msg,data} 信封展平。 */
async function meterJson(
  endpoint: string,
  path: string,
  identity: CodeBuddyIdentity,
  method: 'GET' | 'POST',
  body: string,
  signal?: AbortSignal,
): Promise<{ code: number, message: string, data: unknown, ok: boolean }> {
  try {
    const response = await fetch(`${endpoint}${path}`, {
      method,
      headers: meterHeaders(identity),
      ...(body.length === 0 ? {} : { body }),
      ...(signal === undefined ? {} : { signal }),
    })
    if (!response.ok) return { code: response.status, message: `HTTP ${response.status}`, data: undefined, ok: false }
    const raw = await response.json() as Record<string, unknown>
    const code = typeof raw.code === 'number' ? raw.code : -1
    const message = typeof raw.msg === 'string' ? raw.msg : typeof raw.message === 'string' ? raw.message : `${code}`
    return { code, message, data: raw.data, ok: code === 0 || code === 200 }
  } catch (error) {
    return { code: -1, message: error instanceof Error ? error.message : String(error), data: undefined, ok: false }
  }
}

/** 今日是否已签到；新接口 checkin-activity-status 失败回退 checkin-status。
 *  两个状态接口都是 POST-only（GET 会返回 HTTP 404），故一律以空对象 POST。 */
export async function getCheckinStatus(
  endpoint: string,
  identity: CodeBuddyIdentity,
  signal?: AbortSignal,
): Promise<{ ok: boolean, todayCheckedIn: boolean, error?: string }> {
  let resp = await meterJson(endpoint, `${CHECKIN_API_PREFIX}/checkin-activity-status`, identity, 'POST', '{}', signal)
  if (!resp.ok) {
    resp = await meterJson(endpoint, `${CHECKIN_API_PREFIX}/checkin-status`, identity, 'POST', '{}', signal)
  }
  if (resp.ok) {
    const data = (resp.data ?? {}) as Record<string, unknown>
    const flag = data.today_checked_in ?? data.todayCheckedIn
    return { ok: true, todayCheckedIn: flag === true }
  }
  return { ok: false, todayCheckedIn: false, error: resp.message }
}

/** 提交签到（daily-checkin）；「已签到」/"repeat" 文案按成功处理。 */
export async function performCheckin(
  endpoint: string,
  identity: CodeBuddyIdentity,
  signal?: AbortSignal,
): Promise<{ ok: boolean, already?: boolean, error?: string }> {
  const resp = await meterJson(endpoint, `${CHECKIN_API_PREFIX}/daily-checkin`, identity, 'POST', '{}', signal)
  if (resp.ok) return { ok: true }
  const message = resp.message
  if (message.includes('已签到') || message.toLowerCase().includes('repeat')) return { ok: true, already: true, error: message }
  return { ok: false, error: message }
}

/**
 * 为仍在使用旧辅助函数的调用方保留的旧版 JSONL 根路径。Token 仪表盘
 * 现在改为通过 `sessionQuery` 读取 DSH 会话，不再直接打开这些后端路径。
 * @returns 历史候选根路径。
 */
export function tokenStatsRoots(home: string): string[] {
  return [join(home, 'sessions'), join(home, '..', '.codebuddy', 'projects')]
}
