/**
 * 额度探测的**统一入口**：一个账号一份快照，带 TTL 缓存与单飞（single-flight）。
 *
 * 在引入本模块之前，`fetchUsage` 有 5 个各自独立的调用点，分散在两个模块里：
 *
 *  - 管理面板 `panelStatus`（前端每次刷新都打一遍全部账号）
 *  - 管理面板 `creditExpiryAll`（积分/到期页再打一遍）
 *  - 主动切换周期（**每 30s** 打一遍全部账号）
 *  - 被动切换（请求被拒时再打一遍）
 *  - session 的 `remainingPercentOf`
 *
 * 后果有两类：
 *
 *  1. **重复请求**：同一轮里同一账号常被探 2–3 次（面板刷新的同时周期也在跑）。
 *     账号多时这是对 meter 平面的持续压力，也让面板变慢。
 *  2. **数据不一致**：面板显示的额度与策略决策用的额度来自**两次不同的探测**。
 *     两者之间只要有一次 meter 波动，就会出现「面板说还剩 60%，策略却判不足」
 *     这种自相矛盾的表现。
 *
 * 统一之后，同一次 TTL 窗口内所有消费者共享**同一份**快照，两个问题一起消失。
 *
 * 缓存的是**不可变快照**（纯数字/字符串），不含任何 DSH 运行时对象——跨 RPC 与
 * 跨异步边界传递是安全的。
 *
 * @module dsh-codebuddy/usage-probe
 */

import type { UsageProbeResult, ProbeOptions, CacheEntry } from '../types/host/usage-probe'
export type { UsageProbeResult, ProbeOptions } from '../types/host/usage-probe'
import { fetchUsage, type UsageSnapshot } from './usage.ts'
import type { CodeBuddyIdentity } from './codebuddy.ts'

/**
 * 默认缓存时长（毫秒）。
 *
 * 取值在「新鲜度」与「打远端次数」之间折中：主动切换周期是 30s 一次，取 30s
 * 意味着**相邻两轮周期可以共用一份数据**，而额度是分钟级变化的东西，30s 的
 * 陈旧度对判定阈值（默认 10%）没有实际影响。
 */
export const DEFAULT_USAGE_TTL_MS = 30_000

/** 账号标识 + 端点：同一账号换了端点应视为不同的探测目标。 */
function cacheKey(accountId: string, endpoint: string): string {
  return `${accountId}@${endpoint}`
}

/**
 * 额度探测缓存。
 *
 * 生命周期跟随插件实例：随 `CodeBuddyAuthService` 创建，插件卸载时整体丢弃
 * （缓存里只有远端数据的副本，没有需要显式释放的句柄）。
 */
export class UsageProbeCache {
  private readonly entries = new Map<string, CacheEntry>()

  constructor(
    /** 探测函数，默认走真实的 `fetchUsage`；测试可注入。 */
    private readonly probe: (
      endpoint: string,
      identity: CodeBuddyIdentity,
      signal?: AbortSignal,
    ) => Promise<UsageSnapshot | undefined> = fetchUsage,
    private readonly defaultTtlMs: number = DEFAULT_USAGE_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * 取一个账号的额度快照，命中缓存则不发请求。
   *
   * **单飞**：同一账号在探测在途时，并发的第二次调用会复用同一个 promise 而不是
   * 再发一次请求。这正是「面板刷新与切换周期同时发生」的场景。
   *
   * @param accountId - 本地账号 id。
   * @param endpoint - 该账号的服务端点（参与缓存键）。
   * @param identity - 已解析的身份（含刷新后的 token）。
   * @param options - `force` 跳过缓存、`signal` 取消、`ttlMs` 覆盖 TTL。
   * @returns 探测结果；失败也返回结果对象（`snapshot` 为 `undefined`）。
   */
  async probeAccount(
    accountId: string,
    endpoint: string,
    identity: CodeBuddyIdentity,
    options: ProbeOptions = {},
  ): Promise<UsageProbeResult> {
    const key = cacheKey(accountId, endpoint)
    const ttl = options.ttlMs ?? this.defaultTtlMs
    const entry = this.entries.get(key)

    /**
     * 单飞优先于缓存判断。
     *
     * 顺序很关键：在途探测必须**先**被复用。若先判断缓存，一个过期条目会让并发
     * 调用各自发起一次探测——正是要避免的重复请求。
     */
    if (entry?.inFlight !== undefined) return entry.inFlight

    const cached = entry?.result
    if (options.force !== true && cached !== undefined) {
      const age = this.now() - cached.probedAt
      // 失败的快照也在 TTL 内复用：meter 抖动时不该被前端每次刷新都重打一遍。
      if (age >= 0 && age < ttl) {
        return { ...cached, fromCache: true }
      }
    }

    const inFlight = this.runProbe(key, endpoint, identity, options.signal)
    /**
     * 登记在途探测时**丢弃** `result`；探测完成时**丢弃** `inFlight`。
     *
     * 这构成一条不变量：**`result` 与 `inFlight` 永不同时存在**。它有两个作用：
     *
     *  1. 并发调用不会把「上一次的旧结果」当成有效命中。这是真实踩过的缺陷：
     *     曾用一个空结果占位，结果 5 个并发消费者里只有第 1 个拿到真实数据，
     *     其余全部拿到空对象。
     *  2. 上面对 `inFlight` 的判断因此天然优先——两种判断顺序在**全部可达状态**
     *     下等价（已穷举验证：12 个状态里唯一有差异的 `result+inFlight` 同存态
     *     因本不变量不可达）。
     *
     * 改动时留意：一旦有人为了「探测期间也能读到旧值」而保留 `result`，不变量即被
     * 打破，判断顺序立刻变得关键（过期的 result 会让并发调用各自重探）。
     * `tests/usage-probe.spec.ts` 用「过期条目 + 在途探测」的用例锁住这个行为。
     */
    this.entries.set(key, { inFlight })
    return inFlight
  }

  /** 执行一次真实探测并落缓存。 */
  private async runProbe(
    key: string,
    endpoint: string,
    identity: CodeBuddyIdentity,
    signal?: AbortSignal,
  ): Promise<UsageProbeResult> {
    const probedAt = this.now()
    let result: UsageProbeResult
    try {
      const snapshot = await this.probe(endpoint, identity, signal)
      result = {
        snapshot,
        probedAt,
        fromCache: false,
        ...snapshot === undefined ? { error: 'meter unreachable or unusable reply' } : {},
        ...remainingOf(snapshot) === undefined ? {} : { remainingPct: remainingOf(snapshot) as number },
      }
    } catch (error) {
      // 探测失败不是异常路径：调用方需要的是「这次没查成」这个事实。
      result = {
        snapshot: undefined,
        probedAt,
        fromCache: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
    // 丢掉 inFlight 但保留结果，后续调用在 TTL 内命中缓存。
    this.entries.set(key, { result })
    return result
  }

  /** 读缓存中已有的结果（不发请求）；没有则 `undefined`。 */
  peek(accountId: string, endpoint: string): UsageProbeResult | undefined {
    return this.entries.get(cacheKey(accountId, endpoint))?.result
  }

  /** 丢弃一个账号的缓存（账号被删除或凭据变化时调用）。 */
  invalidate(accountId: string, endpoint?: string): void {
    if (endpoint !== undefined) {
      this.entries.delete(cacheKey(accountId, endpoint))
      return
    }
    // 未给端点：删掉该账号的所有端点变体。
    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(`${accountId}@`)) this.entries.delete(key)
    }
  }

  /** 清空全部缓存（账号集合整体变化时调用）。 */
  clear(): void {
    this.entries.clear()
  }

  /** 当前缓存条目数，供诊断与测试。 */
  get size(): number {
    return this.entries.size
  }
}

/**
 * 从快照计算剩余额度百分比。
 *
 * 把所有窗口的 used/limit **分别求和**后再算比例，与 `session.remainingPercentOf`
 * 的口径一致——两处必须用同一算法，否则面板与策略会得出不同结论。
 * @param snapshot - 探测得到的快照。
 * @returns 0–100 的百分比，或 `undefined` 表示无法计算（无窗口/无上限）。
 */
export function remainingOf(snapshot: UsageSnapshot | undefined): number | undefined {
  if (snapshot === undefined) return undefined
  const { used, limit } = snapshot.windows.reduce(
    (acc, window) => ({
      used: acc.used + (window.used ?? 0),
      limit: acc.limit + (window.limit ?? 0),
    }),
    { used: 0, limit: 0 },
  )
  if (limit <= 0) return undefined
  return Math.max(0, Math.min(100, 100 - (used / limit) * 100))
}
