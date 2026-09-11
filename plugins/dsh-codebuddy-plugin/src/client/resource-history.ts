/**
 * 按账号保存的资源包历史。
 *
 * CodeBuddy 计量平面只返回 `Status` 为 active 的资源包：一个包的周期结束
 * （或被耗尽下线）后，平面会完全停止返回它——已对真实 API 验证，除 active
 * 之外的所有 `Status` 过滤值都返回零行。因此只展示实时应答的仪表盘
 * 永远无法解释上个月的额度去了哪里。
 *
 * 本模块记住探测见过的每一个资源包，按账号与包标识建立索引，使账号对话框
 * 能以三个生命周期分组呈现完整台账。它只承载展示状态：这里没有任何东西
 * 参与配额计算，陈旧条目也不可能抬高实时余额——对仍在返回的包，
 * 实时应答永远胜出。
 *
 * 台账用 `@nanostores/persistent` 的 JSON atom 承载，不再手写
 * `localStorage.getItem/setItem` + `JSON.parse`：解析失败、私密模式拒绝写入等
 * 情况都由库统一处理。但**载荷校验仍留在这里** —— 库只保证「是合法 JSON」，
 * 不保证形如 `Record<accountId, ResourceSnapshot[]>`；历史版本或人工改动过的
 * 数据仍可能含着类型不符的行，必须逐行过滤后再用。
 *
 * @module dsh-codebuddy/resource-history
 */

import { persistentJSON } from '@nanostores/persistent'

/** 保持台账精简：每个账号只留最近见过的资源包。 */
const MAX_PER_ACCOUNT = 60

/** 存储键：与迁移前一致，已有台账不会被读丢。 */
const STORAGE_KEY = 'dsh-codebuddy:resource-history'

/** 探测观测到的单个资源包。 */
export interface ResourceSnapshot {
  /** 稳定的包标识：名称 + 周期起点，因为名称会重复。 */
  key: string
  name: string
  total: number | null
  remaining: number | null
  /** 平面披露的重置/到期时间戳字符串。 */
  resetsAt: string | null
  /** 返回过该包的最近一次探测的 epoch 毫秒。 */
  lastSeenAt: number
}

type HistoryDocument = Record<string, ResourceSnapshot[]>

/**
 * 台账 atom。存储键与迁移前一致，值是可序列化的 `Record<accountId, 快照[]>`。
 *
 * 用 `.get()` 读、`.set()` 写：persistentJSON 负责 JSON 解析/序列化与私密模式
 * 容错。解析失败时它回落到 `{}`，因此调用方拿到的永远是对象（但仍可能是
 * 「对象里含着类型不符的行」，见 {@link sanitizeDocument}）。
 */
const $history = persistentJSON<HistoryDocument>(STORAGE_KEY, {})

/**
 * 逐行校验并归一化台账。
 *
 * 库只保证 JSON 合法，不保证形状正确：历史版本写入过别的结构、或数据被手工改动
 * 过时，直接使用会让渲染层拿到缺失字段的行。这里把每一个可疑值收敛成安全值，
 * 与迁移前的手写校验完全一致。
 */
function sanitizeDocument(raw: unknown): HistoryDocument {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: HistoryDocument = {}
  for (const [accountId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue
    const rows: ResourceSnapshot[] = []
    for (const entry of value) {
      if (entry === null || typeof entry !== 'object') continue
      const row = entry as Partial<ResourceSnapshot>
      if (typeof row.key !== 'string' || typeof row.name !== 'string') continue
      rows.push({
        key: row.key,
        name: row.name,
        total: typeof row.total === 'number' ? row.total : null,
        remaining: typeof row.remaining === 'number' ? row.remaining : null,
        resetsAt: typeof row.resetsAt === 'string' ? row.resetsAt : null,
        lastSeenAt: typeof row.lastSeenAt === 'number' ? row.lastSeenAt : 0,
      })
    }
    out[accountId] = rows
  }
  return out
}

function readDocument(): HistoryDocument {
  return sanitizeDocument($history.get())
}

function writeDocument(doc: HistoryDocument): void {
  $history.set(doc)
}

/** 面板收到的单个资源行（来自 host）。 */
export interface LiveResource {
  name: string
  total: number | null
  remaining: number | null
  resetsAt: string | null
}

/** 为单个资源包构建台账键：名称加周期结束。 */
function resourceKey(resource: LiveResource): string {
  return `${resource.name}@${resource.resetsAt ?? ''}`
}

/**
 * 把一个账号的实时资源包合并进已记忆的台账。
 *
 * @param accountId - 资源包所属的本地账号 id。
 * @param live - 当前探测返回的资源包。
 * @returns 该账号更新后的台账，最新活动在前。
 */
export function recordResources(accountId: string, live: readonly LiveResource[]): ResourceSnapshot[] {
  const doc = readDocument()
  const existing = doc[accountId] ?? []
  const byKey = new Map(existing.map(row => [row.key, row]))
  const now = Date.now()
  for (const resource of live) {
    const key = resourceKey(resource)
    byKey.set(key, {
      key,
      name: resource.name,
      total: resource.total,
      remaining: resource.remaining,
      resetsAt: resource.resetsAt,
      lastSeenAt: now,
    })
  }
  const merged = [...byKey.values()]
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, MAX_PER_ACCOUNT)
  doc[accountId] = merged
  writeDocument(doc)
  return merged
}

/** 只读取一个账号的已记忆台账，不做任何记录。 */
export function readResources(accountId: string): ResourceSnapshot[] {
  return readDocument()[accountId] ?? []
}

/** 丢弃一个账号的台账（账号被移除）。 */
export function forgetResources(accountId: string): void {
  const doc = readDocument()
  if (doc[accountId] === undefined) return
  delete doc[accountId]
  writeDocument(doc)
}

/** 资源包所属的生命周期分组。 */
export type ResourceLifecycle = 'usable' | 'depleted' | 'expired'

/** 重置/到期字符串是否已过时。 */
function isPast(resetsAt: string | null, now: number): boolean {
  if (resetsAt === null || resetsAt.length === 0) return false
  const parsed = new Date(resetsAt.replace(' ', 'T')).getTime()
  return Number.isFinite(parsed) && parsed < now
}

/** 对话框渲染的单个分类后的资源包行。 */
export interface ClassifiedResource extends ResourceSnapshot {
  lifecycle: ResourceLifecycle
  /** 实时探测是否仍返回该包。 */
  live: boolean
}

/**
 * 把一个账号的资源包分类到三个生命周期分组。
 *
 * 实时包优先：探测仍返回的包，有剩余额度即为 usable，没有即为 depleted。
 * 探测不再返回的已记忆包——或周期已结束的包——归为 expired。
 *
 * @param ledger - 该账号已记忆的资源包。
 * @param live - 当前探测返回的资源包。
 * @returns 分类后的行，usable 在前，其次 depleted，最后 expired。
 */
export function classifyResources(
  ledger: readonly ResourceSnapshot[],
  live: readonly LiveResource[],
): ClassifiedResource[] {
  const now = Date.now()
  const liveByKey = new Map(live.map(resource => [resourceKey(resource), resource]))
  const seen = new Set<string>()
  const rows: ClassifiedResource[] = []

  for (const resource of live) {
    const key = resourceKey(resource)
    seen.add(key)
    const remembered = ledger.find(row => row.key === key)
    const remaining = resource.remaining
    rows.push({
      key,
      name: resource.name,
      total: resource.total,
      remaining,
      resetsAt: resource.resetsAt,
      lastSeenAt: now,
      live: true,
      lifecycle: remaining !== null && remaining > 0 ? 'usable' : 'depleted',
    })
    void remembered
  }

  for (const row of ledger) {
    if (seen.has(row.key)) continue
    // 平面已不再返回：周期结束或已被下线。
    rows.push({ ...row, live: false, lifecycle: 'expired' })
  }

  // 平面仍在列出、但周期结束已过期的包，无论其报告的剩余数字如何
  // 都算作 expired。
  for (const row of rows) {
    if (row.live && isPast(row.resetsAt, now)) row.lifecycle = 'expired'
  }

  const order: Record<ResourceLifecycle, number> = { usable: 0, depleted: 1, expired: 2 }
  return rows.sort((a, b) => order[a.lifecycle] - order[b.lifecycle] || b.lastSeenAt - a.lastSeenAt)
}
