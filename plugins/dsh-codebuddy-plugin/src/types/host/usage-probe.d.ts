
/** CodeBuddy 类型声明；由原模块抽取，运行时实现保留在 src 下。 */
import type { UsageSnapshot } from '../../host/usage.ts'

/** 一个账号的探测结果。 */
export interface UsageProbeResult {
  /** 解析出的快照；`undefined` 表示本次探测失败。 */
  snapshot: UsageSnapshot | undefined
  /** 该结果的产出时刻（epoch ms）。 */
  probedAt: number
  /** 是否来自缓存（未真正发出请求）。 */
  fromCache: boolean
  /**
   * 失败原因（仅探测失败时有值）。
   *
   * 与「额度为 0」严格区分：失败是「没查成」，0 是「查到了确实没有」。
   * 展示层据此区分「探测失败」与「额度耗尽」两种空状态。
   */
  error?: string
  /** 该账号的额度百分比（0–100）；无法计算时为 `undefined`。 */
  remainingPct?: number
}
/** 探测选项。 */
export interface ProbeOptions {
  /** 忽略缓存强制重新探测（用户主动点刷新时使用）。 */
  force?: boolean
  /** 取消信号。 */
  signal?: AbortSignal
  /** 本次覆盖 TTL；不传用默认值。 */
  ttlMs?: number
}
export interface CacheEntry {
  /**
   * 已完成的探测结果。
   *
   * 可选——**探测在途时这里没有值**。曾经用一个「空结果」占位，那会让并发的
   * 第二个调用把占位符当成有效缓存命中，立刻返回空数据而不是等待在途探测
   * （实测：5 个并发消费者里只有第 1 个拿到真实数据）。
   */
  result?: UsageProbeResult
  /** 在途的探测，用于单飞。 */
  inFlight?: Promise<UsageProbeResult>
}
