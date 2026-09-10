/**
 * CodeBuddy-only token analytics over DSH's logical session corpus.
 *
 * The query service is deliberately used instead of walking the JSONL backend:
 * this keeps the dashboard compatible with live sessions, restored sessions,
 * projection caches and future persistence implementations.
 */

import { CODEBUDDY_PROVIDER } from './constants.ts'

const DAY_MS = 86_400_000
const DEFAULT_RANGE_DAYS = 30
const MAX_RANGE_DAYS = 365
const ACTIVITY_RANGE_DAYS = 365

type JsonRecord = Record<string, unknown>

type SessionId = string

interface SessionHeader {
  id: SessionId
  cwd?: string
}

interface SessionRecord {
  header: SessionHeader
  live: boolean
  persisted: boolean
}

interface TokenUsageProjection {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

interface SessionEvent {
  type: string
  time: number
  data: JsonRecord
}

interface SessionObservation {
  header: SessionHeader
  events: readonly SessionEvent[]
  projections?: { values?: Record<string, unknown> }
  [Symbol.dispose]?: () => void
}

export interface SessionQueryService {
  listSessions(signal?: AbortSignal): Promise<SessionRecord[]>
  observeSession(
    sessionId: SessionId,
    options?: { signal?: AbortSignal, projectionMode?: 'all' | 'none' },
  ): Promise<SessionObservation>
  readTitle?(sessionId: SessionId, signal?: AbortSignal): Promise<{ title?: string } | undefined>
}

export interface CodeBuddyTokenStatsRequest {
  days?: number
  sessionIds?: string[]
}

export interface CodeBuddyTokenBucket {
  total: number
  input: number
  output: number
  read: number
  write: number
  records: number
}

export interface CodeBuddyTokenDay extends CodeBuddyTokenBucket {
  day: string
  activeSessions: number
}

export interface CodeBuddyTokenActivity {
  day: string
  calls: number
  tokens: number
  activeSessions: number
}

export interface CodeBuddyTokenBreakdown {
  name: string
  path?: string
  total: number
  calls: number
  percent: number
}

export interface CodeBuddyTokenSession {
  id: string
  title: string
  workspace?: string
  total: number
  input: number
  output: number
  calls: number
  percent: number
  lastActiveAt: number
}

export interface CodeBuddyTokenStats {
  provider: typeof CODEBUDDY_PROVIDER
  rangeDays: number
  generatedAt: number
  totals: CodeBuddyTokenBucket & { sessions: number, cacheHitRate?: number }
  days: CodeBuddyTokenDay[]
  activity: CodeBuddyTokenActivity[]
  workspaces: CodeBuddyTokenBreakdown[]
  models: CodeBuddyTokenBreakdown[]
  sessions: CodeBuddyTokenSession[]
}

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

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function addBucket(target: CodeBuddyTokenBucket, usage: TokenUsageProjection): void {
  target.input += usage.uncachedInputTokens
  target.output += usage.outputTokens
  target.read += usage.cacheReadTokens
  target.write += usage.cacheWriteTokens
  target.total += usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
  target.records += 1
}

function emptyBucket(): CodeBuddyTokenBucket {
  return { total: 0, input: 0, output: 0, read: 0, write: 0, records: 0 }
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
  const write = nonNegative(usage.cacheWriteTokens)
  if (input === 0 && output === 0 && read === 0 && write === 0) return undefined
  return { uncachedInputTokens: input, outputTokens: output, cacheReadTokens: read, cacheWriteTokens: write }
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

/** Aggregate CodeBuddy usage for a selected logical session set. */
export async function collectCodeBuddyTokenStats(
  query: SessionQueryService | undefined,
  request: CodeBuddyTokenStatsRequest = {},
  signal?: AbortSignal,
): Promise<CodeBuddyTokenStats> {
  const days = Math.max(1, Math.min(MAX_RANGE_DAYS, Math.round(request.days ?? DEFAULT_RANGE_DAYS)))
  const now = Date.now()
  const rangeStart = startOfLocalDay(now - (days - 1) * DAY_MS)
  const activityStart = startOfLocalDay(now - (ACTIVITY_RANGE_DAYS - 1) * DAY_MS)
  const dayRows = new Map<string, CodeBuddyTokenDay>()
  for (let index = 0; index < days; index += 1) {
    const day = localDay(rangeStart + index * DAY_MS)
    dayRows.set(day, { day, ...emptyBucket(), activeSessions: 0 })
  }
  const activityRows = new Map<string, CodeBuddyTokenActivity>()
  for (let index = 0; index < ACTIVITY_RANGE_DAYS; index += 1) {
    const day = localDay(activityStart + index * DAY_MS)
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
      rangeDays: days,
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
  // Request all projections so the built-in token-meter is folded alongside
  // the event snapshot. Its tokenUsage view is provider-agnostic by design;
  // the CodeBuddy filter below therefore uses assistant provenance directly.
  const observeOptions = signal === undefined ? { projectionMode: 'all' as const } : { signal, projectionMode: 'all' as const }
  // A corrupt or interrupted persistence log must not take down the whole
  // dashboard: one broken session is skipped, healthy sessions still count.
  const observations = (await Promise.all(selected.map(async item => {
    try {
      return { item, observation: await query.observeSession(item.header.id, observeOptions) }
    } catch (error) {
      // An all-or-nothing failure previously surfaced as "usage temporarily
      // unavailable" whenever a single session log could not be replayed.
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
        if (!Number.isFinite(event.time) || event.time < activityStart) continue
        const usage = usageFromEvent(event)
        if (usage === undefined) continue
        const eventDay = localDay(event.time)
        const activity = activityRows.get(eventDay)
        if (activity !== undefined) {
          activity.calls += 1
          activity.tokens += usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
          const active = activitySessions.get(eventDay) ?? new Set<string>()
          active.add(sessionId)
          activitySessions.set(eventDay, active)
        }
        if (event.time < rangeStart) continue
        hasUsage = true
        addBucket(totals, usage)
        const day = dayRows.get(eventDay)
        if (day !== undefined) addBucket(day, usage)
        const modelMessage = record(event.data.message)
        const source = record(modelMessage?.source)
        const modelName = text(source?.model) ?? '未知模型'
        const model = models.get(modelName) ?? { total: 0, calls: 0 }
        model.total += usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
        model.calls += 1
        models.set(modelName, model)
        const workspace = workspaces.get(workspaceName) ?? { total: 0, calls: 0, ...workspacePath === undefined ? {} : { path: workspacePath } }
        workspace.total += usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
        workspace.calls += 1
        workspaces.set(workspaceName, workspace)
        session.total += usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
        session.input += usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
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
  for (const row of activityRows.values()) {
    row.activeSessions = activitySessions.get(row.day)?.size ?? 0
  }
  const promptTokens = totals.input + totals.read
  if (promptTokens > 0) totals.cacheHitRate = totals.read / promptTokens
  for (const session of sessionRows.values()) {
    session.percent = totals.total > 0 ? Math.round((session.total / totals.total) * 1000) / 10 : 0
  }

  return {
    provider: CODEBUDDY_PROVIDER,
    rangeDays: days,
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
