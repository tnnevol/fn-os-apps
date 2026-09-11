/**
 * Token 统计的按范围缓存。
 *
 * 背景：Token 页有多个面板，每个面板都要有**自己的**时间周期选择器。若每个
 * 面板各自裸调 RPC，同一范围会被重复请求，而服务端每次都要重放全部会话
 * （实测 200 会话约 50ms），面板一多就成了 N 倍开销。
 *
 * 因此这里按 `days` 缓存：范围相同的面板共享同一份结果与同一个在途请求
 * （in-flight 去重）。范围不同才真正多取一次——这是功能本身要求的，
 * 因为服务端对 workspaces/models/sessions 的累积带范围过滤，无法从大范围
 * 的响应里推导出小范围的结果。
 *
 * 做成不依赖 React 的普通类，便于单测；面板通过 `useSyncExternalStore` 订阅。
 *
 * @module dsh-codebuddy/token-stats-store
 */

import { CODEBUDDY_AUTH_CHANNEL } from '../../contracts/constants.ts'
import type { ConnectionRpc } from '../rpc.ts'
import { resolveRange, type TokenRangeKey } from '../token-range.ts'

/** 与 panel.tsx 的 TokenStats 同形；这里只要求可缓存即可。 */
export interface TokenStatsPayload {
  rangeDays: number
  [key: string]: unknown
}

export class TokenStatsStore {
  /**
   * 缓存以**范围键**（而非 days）为键。
   *
   * 用 days 会错：'本月' 在 30 号时 days 恰好也是 30，与 '30d' 撞键，但两者是
   * 不同的请求（前者随日期变化、后者固定窗口），共用缓存会互相污染。'总计' 更是
   * 没有 days 可言（走 allTime）。
   */
  private readonly cache = new Map<TokenRangeKey, TokenStatsPayload>()
  private readonly pending = new Map<TokenRangeKey, Promise<void>>()
  private readonly failures = new Map<TokenRangeKey, string>()
  /**
   * 这次加载由哪个面板发起，key 是范围键。
   *
   * 数据按范围共享是对的（同范围只该取一次），但**加载指示不能按范围共享**：
   * 面板默认可能停在同一个范围上，若 loading 只用范围做键，刷新总览会让其他
   * 同范围的面板一起转圈，看起来仍像全局刷新。因此记下发起者，只有它能观察到
   * 这次加载。
   */
  private readonly loader = new Map<TokenRangeKey, symbol>()
  private readonly listeners = new Set<() => void>()
  /** 任何变化都自增；`useSyncExternalStore` 的快照就用它，保证引用稳定。 */
  private version = 0

  constructor(private readonly rpc: ConnectionRpc) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** 快照：只作为「有变化」的信号，具体数据用 `get()` 取。 */
  getSnapshot = (): number => this.version

  get(key: TokenRangeKey): TokenStatsPayload | undefined {
    return this.cache.get(key)
  }

  /**
   * 是否处于加载中。
   *
   * @param key 范围键
   * @param owner 调用者的面板令牌。传入时仅发起者会看到 loading，用于「各面板
   *   只为自己发起的刷新显示遮罩」；不传则按范围判断（首次填充时用，此时还没有
   *   发起者，同范围的面板都该显示等待）。
   */
  isLoading(key: TokenRangeKey, owner?: symbol): boolean {
    if (!this.pending.has(key)) return false
    if (owner === undefined) return true
    const current = this.loader.get(key)
    return current === undefined || current === owner
  }

  errorOf(key: TokenRangeKey): string | undefined {
    return this.failures.get(key)
  }

  /** 确保该范围有数据在取；已有缓存或在途时直接复用。 */
  ensure(key: TokenRangeKey): void {
    if (this.cache.has(key) || this.pending.has(key)) return
    this.start(key)
  }

  /**
   * 强制重新拉取某一范围（该面板的刷新按钮）。
   *
   * **不清缓存**：清掉会让 `get(days)` 返回 undefined，面板据此认为「还没数据」
   * 而回到初次加载占位——这正是「刷新总览变全局刷新」的原因。保留上一份数据，
   * 仅在 isLoading 上体现刷新中，面板就能留着内容只叠遮罩。
   *
   * @param owner 发起刷新的面板令牌，用于只让该面板显示加载态。
   */
  reload(key: TokenRangeKey, owner?: symbol): void {
    // 已有在途请求就让它跑完，避免同一范围出现两个并发请求。
    if (this.pending.has(key)) return
    this.start(key, owner)
  }

  /** 重新拉取所有已知范围（页头刷新）。语义同 `reload`：保留旧数据。 */
  reloadAll(): void {
    const known = new Set([...this.cache.keys(), ...this.pending.keys()])
    for (const days of known) if (!this.pending.has(days)) this.start(days)
    this.bump()
  }

  private start(key: TokenRangeKey, owner?: symbol): void {
    if (owner !== undefined) this.loader.set(key, owner)
    // 请求参数由范围键解析：'总计' 走 allTime，'本月' 走 days=今天几号。
    const task = this.rpc.call<TokenStatsPayload>(CODEBUDDY_AUTH_CHANNEL, 'tokenStats', resolveRange(key))
      .then((result) => {
        if (result.ok) {
          this.cache.set(key, result.value)
          this.failures.delete(key)
        } else {
          this.failures.set(key, 'unavailable')
        }
      })
      .catch(() => { this.failures.set(key, 'unavailable') })
      .finally(() => {
        this.pending.delete(key)
        this.loader.delete(key)
        this.bump()
      })
    this.pending.set(key, task)
    this.bump()
  }

  private bump(): void {
    this.version += 1
    for (const listener of this.listeners) listener()
  }
}
