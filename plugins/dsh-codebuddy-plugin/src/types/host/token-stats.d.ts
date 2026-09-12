
/** CodeBuddy 类型声明；由原模块抽取，运行时实现保留在 src 下。 */
import type { CODEBUDDY_PROVIDER } from '../../contracts/constants.ts'

export type JsonRecord = Record<string, unknown>
export type SessionId = string
export interface SessionHeader {
  id: SessionId
  cwd?: string
}
export interface SessionRecord {
  header: SessionHeader
  live: boolean
  persisted: boolean
}
/**
 * 一次模型调用的用量投影。
 *
 * **不含缓存写**：实测本环境下 7309 条 CodeBuddy 用量事件中 `cacheWriteTokens`
 * 出现 0 次（服务端不上报该字段），计入它只会让口径与展示多出一个恒为 0 的项。
 * 缓存读保留——它占总量 98.7%，是真实发生的用量。
 *
 * 注意 `translate.ts` 的 `mapUsage` 仍会向宿主上报两个缓存字段，DSH 自身的轨迹
 * 视图依赖它们；这里收窄的只是**统计口径**。
 */
export interface TokenUsageProjection {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
}
export interface SessionEvent {
  type: string
  time: number
  data: JsonRecord
}
export interface SessionObservation {
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
  /**
   * 窗口下界（毫秒时间戳，含）。事件 `time < startTime` 不计入 totals/days/
   * workspaces/models/sessions；仅在 `allTime !== true` 时生效。
   *
   * 入参从「天数」改为「端点」：天数隐含了「以请求时刻为终点」的语义，
   * 「按钮的固定时间范围应该从当前时间计算倒退」也由客户端在传端点前完成，
   * 服务端不持有「现在」概念——所有计算都基于这两个端点。
   *
   * **必填**：缺一会被服务端拒收（不能让服务端猜一个会随请求时刻漂移的窗口）。
   */
  startTime: number
  /**
   * 窗口上界（毫秒时间戳，含）。通常为今天 00:00（即客户端按下当前时间
   * 倒退 0 天），固定档/自定义档都要求客户端用「请求时刻所在本地零点」
   * ——把「起点」「终点」的切日责任放在客户端，服务端按端点过滤，不重新
   * 切日。
   *
   * **必填**：理由同上。
   */
  endTime: number
  /**
   * 不做时间下界过滤：统计全部历史。
   *
   * 「总计」不能用超大 `endTime - startTime` 近似——`days` 概念已淘汰；
   * `allTime: true` 时 `startTime`/`endTime` **仍要传**（用于面板的活动
   * 热力图范围），但 `event.time < startTime` 不再被过滤。
   */
  allTime?: boolean
  sessionIds?: string[]
}
/**
 * 一个统计窗口内的用量合计。
 *
 * 含输入、输出与缓存读；不含缓存写（理由见 {@link TokenUsageProjection}）。
 */
export interface CodeBuddyTokenBucket {
  total: number
  input: number
  output: number
  /** 缓存读：命中缓存的输入，占总量的绝大多数。 */
  read: number
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
