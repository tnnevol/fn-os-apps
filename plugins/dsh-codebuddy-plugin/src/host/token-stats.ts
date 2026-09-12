/**
 * 基于 DSH 逻辑会话语料的 CodeBuddy 专属 token 统计。
 *
 * 刻意使用查询服务而不是遍历 JSONL 后端：这让面板与活动会话、已恢复会话、
 * 投影缓存以及未来的持久化实现保持兼容。
 *
 * @module dsh-codebuddy/token-stats
 */

import type { JsonRecord, SessionRecord, TokenUsageProjection, SessionEvent, SessionObservation, SessionQueryService, CodeBuddyTokenStatsRequest, CodeBuddyTokenBucket, CodeBuddyTokenDay, CodeBuddyTokenActivity, CodeBuddyTokenBreakdown, CodeBuddyTokenSession, CodeBuddyTokenStats } from '../types/host/token-stats'
export type { SessionQueryService, CodeBuddyTokenStatsRequest, CodeBuddyTokenBucket, CodeBuddyTokenDay, CodeBuddyTokenActivity, CodeBuddyTokenBreakdown, CodeBuddyTokenSession, CodeBuddyTokenStats } from '../types/host/token-stats'
import { CODEBUDDY_PROVIDER } from '../contracts/constants.ts'

const DAY_MS = 86_400_000
const MAX_RANGE_DAYS = 365
const ACTIVITY_RANGE_DAYS = 365

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : undefined
}

function nonNegative(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  return 0
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function localDay(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addBucket(target: CodeBuddyTokenBucket, usage: TokenUsageProjection): void {
  target.input += usage.uncachedInputTokens
  target.output += usage.outputTokens
  target.read += usage.cacheReadTokens
  // 合计 = 未命中缓存的输入 + 输出 + 缓存读（不含缓存写）。
  target.total += usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens
  target.records += 1
}

function emptyBucket(): CodeBuddyTokenBucket {
  return { total: 0, input: 0, output: 0, read: 0, records: 0 }
}

function usageFromEvent(event: SessionEvent): TokenUsageProjection | undefined {
  if (event.type !== 'assistant/message') return undefined
  const data = event.data
  const message = record(data.message)
  const source = record(message?.source)
  if (source?.kind !== 'model' || source.provider !== CODEBUDDY_PROVIDER) return undefined
  const usage = record(data.usage)
  if (usage === undefined) return undefined
  const input = nonNegative(usage.inputTokens)
  const output = nonNegative(usage.outputTokens)
  const read = nonNegative(usage.cacheReadTokens)
  // 缓存写不参与统计，因此判定条件也不再看它：一条只有缓存写的事件会被丢弃
  // （计入的话「记录数」会增加而总量不增，让「平均每次调用」偏小）。
  if (input === 0 && output === 0 && read === 0) return undefined
  return { uncachedInputTokens: input, outputTokens: output, cacheReadTokens: read }
}

function messageText(value: unknown): string | undefined {
  const message = record(value)
  const content = message?.content
  if (!Array.isArray(content)) return undefined
  for (const block of content) {
    const item = record(block)
    const value = text(item?.text)
    if (value !== undefined) return value.replace(/\s+/g, ' ').slice(0, 80)
  }
  return undefined
}

/**
 * DSH 会自动注入的内容，不构成会话标题：workspace 说明、运行时上下文快照、
 * 可用 skill 清单、任务看板提示等。它们总是排在真实用户输入之前，若当成标题
 * 会把整列表显示成同一种系统文本。
 */
function isInjectedContext(value: string): boolean {
  const head = value.trimStart().slice(0, 32)
  return head.startsWith('<system-reminder>')
    || head.startsWith('Current runtime context')
    || head.startsWith('The following workspace instructions')
    || head.startsWith('# AGENTS.md')
}

/**
 * 从会话事件里取标题：用**第一条真实用户输入**的文本。
 *
 * 事件结构注意：`user/message` 的正文在 `data.content`（不是 `data.message`
 * ——那是 `assistant/message` 的形状）。此前误读 `data.message`，取到的一直是
 * undefined，于是标题永远回退成会话 id，列表里显示的就是一串 uuid。
 *
 * 取不到时返回空串而不是会话 id：id 是无意义的 uuid，不该出现在界面上，
 * 由客户端用本地化占位文案呈现。
 */
function titleFromEvents(events: readonly SessionEvent[]): string {
  for (const event of events) {
    if (event.type !== 'user/message') continue
    const title = messageText(event.data)
    if (title !== undefined && !isInjectedContext(title)) return title
  }
  return ''
}

function breakdown(
  values: Map<string, { total: number, calls: number, path?: string }>,
  overall: number,
): CodeBuddyTokenBreakdown[] {
  return [...values.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, value]) => ({
      name,
      ...value.path === undefined ? {} : { path: value.path },
      total: Math.round(value.total),
      calls: value.calls,
      percent: overall > 0 ? Math.round((value.total / overall) * 1000) / 10 : 0,
    }))
}

function disposeObservation(observation: SessionObservation): void {
  observation[Symbol.dispose]?.()
}

/** 为所选逻辑会话集合聚合 CodeBuddy 用量。 */
export async function collectCodeBuddyTokenStats(
  query: SessionQueryService | undefined,
  request: CodeBuddyTokenStatsRequest,
  signal?: AbortSignal,
): Promise<CodeBuddyTokenStats> {
  if (!Number.isFinite(request.startTime) || !Number.isFinite(request.endTime)) {
    // 端点缺失或非法：抛错而不是猜默认值。
    // 旧版本里服务端会在 `startTime`/`endTime` 缺一时退化到「以请求时刻为终点
    // 向前推 30 天」——同一接口对不同请求会得到不同窗口，无法稳定。
    throw new TypeError('CodeBuddy tokenStats: startTime and endTime are required')
  }
  if (request.endTime < request.startTime) {
    // 端点顺序写反：抛错而不是把负窗口夹到 1 天。
    throw new Error('CodeBuddy tokenStats: endTime must be >= startTime')
  }
  const allTime = request.allTime === true
  const now = Date.now()
  /**
   * 客户端端点（毫秒）= 整个计算的输入。**任何天数推算都不在这层出现**——
   * 「按钮的固定时间范围从当前时间倒退」由客户端按请求时刻算出后再传进来；
   * 服务端把这个窗口当作不透明的时间区间处理，包括逐日行数与活动热力图。
   */
  const clientStart = request.startTime
  const clientEnd = request.endTime
  /**
   * 逐日行数 = 窗口跨过的本地日数（含两端），上限 `MAX_RANGE_DAYS`。
   *
   * **截断方向很关键：从 `clientEnd`（最新）往回铺，丢弃最早的天。**
   *
   * 曾经是「从 `clientStart` 往后铺 dayCount 行」，于是超长窗口被截掉的是
   * **尾部**——最靠近今天的那几十天没有对应日行，`dayRows.get(eventDay)` 返回
   * undefined，这些事件不进任何一天，而 `totals` 却照常累加（它用的是独立的
   * `rangeCompareStart`）。结果就是「总量对、逐日图少一截最新数据」，且因为
   * 两者都来自同一次请求，界面上看不出任何异常迹象。
   *
   * 现在逐日行的下界随 dayCount 收紧（`dayWindowStart`），totals 也用同一个
   * 下界，两个口径永远一致。
   *
   * 上限存在的意义只是「不让超长窗口撑爆响应」：客户端范围键最长 90d，正常
   * 路径不会触及；万一有人直接调 RPC 传一年以上，返回 365 行而不是数万行。
   *
   * 天数用 `floor(diff / DAY) + 1`（含两端）：端点由客户端按**本地 0 点**算出
   * （见 client/token-range.ts 的 resolveRange），差必然是整天，此时与之前的
   * `round` 写法结果完全一致；非整天端点（直接调 RPC 的调用方）下 `floor` 单调
   * 无跳变，不会出现「差 12 小时算 2 天、差 1 天也算 2 天」这类抖动。
   */
  const requestedDays = Math.floor((clientEnd - clientStart) / DAY_MS) + 1
  const dayCount = Math.max(1, Math.min(MAX_RANGE_DAYS, requestedDays))
  /** 逐日行覆盖的起点：以 `clientEnd` 为终点、向前 `dayCount` 天。 */
  const dayWindowStart = clientEnd - (dayCount - 1) * DAY_MS
  /**
   * 活动热力图窗口：[clientEnd - 364 天, clientEnd]。
   *
   * 不再使用任何服务器侧 `now`——「按钮的固定时间范围由当前时间计算倒退」
   * 这件事由客户端按请求时刻算出 `endTime` 后传进来；服务端只是把客户端给的
   * 终点当作「热力图的终点」使用，start 同样按端点等差向前推 364 天。
   */
  const heatmapEnd = clientEnd
  const heatmapStart = heatmapEnd - (ACTIVITY_RANGE_DAYS - 1) * DAY_MS
  /**
   * 比较用的下界：与**逐日行覆盖范围**对齐（不是原始 `clientStart`）。
   *
   * 对齐的理由：totals 与逐日行是同一份数据的两种呈现，读者会把「逐日图各天
   * 之和」与「总量」对照。截断发生时若 totals 仍按 `clientStart` 统计，两者
   * 就对不上——而且对不上的部分是「总量更大」，看起来像图表漏画了数据。
   *
   * allTime 时放宽到 -Infinity，让 3 年前的事件也能进 totals；逐日行的起点
   * 仍用真实时间戳（**不能**用 -Infinity 当起点 + i*DAY_MS，否则日期键会变成
   * 'NaN-NaN-NaN'，那是另一类历史缺陷）。
   */
  const rangeCompareStart = allTime ? Number.NEGATIVE_INFINITY : dayWindowStart
  const activityCompareStart = allTime ? Number.NEGATIVE_INFINITY : heatmapStart
  const dayRows = new Map<string, CodeBuddyTokenDay>()
  for (let index = 0; index < dayCount; index += 1) {
    const day = localDay(dayWindowStart + index * DAY_MS)
    dayRows.set(day, { day, ...emptyBucket(), activeSessions: 0 })
  }
  const activityRows = new Map<string, CodeBuddyTokenActivity>()
  for (let index = 0; index < ACTIVITY_RANGE_DAYS; index += 1) {
    const day = localDay(heatmapStart + index * DAY_MS)
    activityRows.set(day, { day, calls: 0, tokens: 0, activeSessions: 0 })
  }

  const totals: CodeBuddyTokenStats['totals'] = { ...emptyBucket(), sessions: 0 }
  const activitySessions = new Map<string, Set<string>>()
  const workspaces = new Map<string, { total: number, calls: number, path?: string }>()
  const models = new Map<string, { total: number, calls: number }>()
  const sessionRows = new Map<string, CodeBuddyTokenSession>()

  if (query === undefined) {
    return {
      provider: CODEBUDDY_PROVIDER,
      rangeDays: dayCount,
      generatedAt: now,
      totals,
      days: [...dayRows.values()],
      activity: [...activityRows.values()],
      workspaces: [],
      models: [],
      sessions: [],
    }
  }

  const records = await query.listSessions(signal)
  const selectedIds = request.sessionIds === undefined ? undefined : new Set(request.sessionIds)
  const selected = records.filter(item => selectedIds === undefined || selectedIds.has(item.header.id))
  // 请求全部投影，让内置 token 计量与事件快照合并在同一次读取里。它的
  // tokenUsage 视图按设计与提供方无关；因此下面对 CodeBuddy 的过滤直接使用
  // assistant 来源判定。
  const observeOptions = signal === undefined ? { projectionMode: 'all' as const } : { signal, projectionMode: 'all' as const }
  // 损坏或被中断的持久化日志不能拖垮整个面板：跳过损坏的那个会话，健康的
  // 会话照常计入。
  const observations = (await Promise.all(selected.map(async item => {
    try {
      return { item, observation: await query.observeSession(item.header.id, observeOptions) }
    } catch {
      // 之前「要么全成要么全败」的失败，曾因为单个会话日志无法重放，就把整个
      // 面板变成「用量暂时不可用」。
      return { item, observation: undefined }
    }
  }))).filter((entry): entry is { item: SessionRecord, observation: SessionObservation } => entry.observation !== undefined)

  try {
    await Promise.all(observations.map(async ({ item: sessionRecord, observation }) => {
      const sessionId = sessionRecord.header.id
      const workspacePath = observation.header.cwd ?? sessionRecord.header.cwd
      const workspaceName = workspacePath === undefined ? '未指定工作区' : workspacePath.split('/').filter(Boolean).pop() ?? workspacePath
      const session = {
        id: sessionId,
        title: titleFromEvents(observation.events),
        ...workspacePath === undefined ? {} : { workspace: workspacePath },
        total: 0,
        input: 0,
        output: 0,
        calls: 0,
        percent: 0,
        lastActiveAt: 0,
      }

      let hasUsage = false
      for (const event of observation.events) {
        if (!Number.isFinite(event.time) || event.time < activityCompareStart) continue
        const usage = usageFromEvent(event)
        if (usage === undefined) continue
        const eventDay = localDay(event.time)
        const activity = activityRows.get(eventDay)
        if (activity !== undefined) {
          activity.calls += 1
          activity.tokens += usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens
          const active = activitySessions.get(eventDay) ?? new Set<string>()
          active.add(sessionId)
          activitySessions.set(eventDay, active)
        }
        if (event.time < rangeCompareStart) continue
        hasUsage = true
        addBucket(totals, usage)
        const day = dayRows.get(eventDay)
        if (day !== undefined) addBucket(day, usage)
        const modelMessage = record(event.data.message)
        const source = record(modelMessage?.source)
        const modelName = text(source?.model) ?? '未知模型'
        const model = models.get(modelName) ?? { total: 0, calls: 0 }
        model.total += usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens
        model.calls += 1
        models.set(modelName, model)
        const workspace = workspaces.get(workspaceName) ?? { total: 0, calls: 0, ...workspacePath === undefined ? {} : { path: workspacePath } }
        workspace.total += usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens
        workspace.calls += 1
        workspaces.set(workspaceName, workspace)
        session.total += usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens
        // 会话行的「输入」沿既有口径含缓存读（与总量里的输入不同义，但这是原行为）。
        session.input += usage.uncachedInputTokens + usage.cacheReadTokens
        session.output += usage.outputTokens
        session.calls += 1
        session.lastActiveAt = Math.max(session.lastActiveAt, event.time)
      }
      if (!hasUsage) return
      totals.sessions += 1
      sessionRows.set(sessionId, session)
    }))
  } finally {
    for (const { observation } of observations) disposeObservation(observation)
  }

  for (const row of dayRows.values()) {
    row.activeSessions = activitySessions.get(row.day)?.size ?? 0
  }
  // 缓存命中率：缓存读 /（未命中输入 + 缓存读）。只与输入侧有关，
  // 因此不受「缓存写已移出统计」影响。
  const promptTokens = totals.input + totals.read
  if (promptTokens > 0) totals.cacheHitRate = totals.read / promptTokens

  for (const row of activityRows.values()) {
    row.activeSessions = activitySessions.get(row.day)?.size ?? 0
  }
  for (const session of sessionRows.values()) {
    session.percent = totals.total > 0 ? Math.round((session.total / totals.total) * 1000) / 10 : 0
  }

  return {
    provider: CODEBUDDY_PROVIDER,
    rangeDays: dayCount,
    generatedAt: now,
    totals,
    days: [...dayRows.values()],
    activity: [...activityRows.values()],
    workspaces: breakdown(workspaces, totals.total),
    models: breakdown(models, totals.total),
    sessions: [...sessionRows.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(session => ({ ...session, total: Math.round(session.total), input: Math.round(session.input), output: Math.round(session.output) })),
  }
}
