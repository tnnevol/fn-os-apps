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

import { CODEBUDDY_AUTH_CHANNEL } from './constants.ts'
import type { ConnectionRpc } from './rpc.ts'

/** 与 panel.tsx 的 TokenStats 同形；这里只要求可缓存即可。 */
export interface TokenStatsPayload {
  rangeDays: number
  [key: string]: unknown
}

export class TokenStatsStore {
  private readonly cache = new Map<number, TokenStatsPayload>()
  private readonly pending = new Map<number, Promise<void>>()
  private readonly failures = new Map<number, string>()
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

  get(days: number): TokenStatsPayload | undefined {
    return this.cache.get(days)
  }

  isLoading(days: number): boolean {
    return this.pending.has(days)
  }

  errorOf(days: number): string | undefined {
    return this.failures.get(days)
  }

  /** 确保该范围有数据在取；已有缓存或在途时直接复用。 */
  ensure(days: number): void {
    if (this.cache.has(days) || this.pending.has(days)) return
    this.start(days)
  }

  /** 强制重新拉取某一范围（该面板的刷新按钮）。 */
  reload(days: number): void {
    this.cache.delete(days)
    // 已有在途请求就让它跑完，避免同一范围出现两个并发请求。
    if (this.pending.has(days)) return
    this.start(days)
  }

  /** 重新拉取所有已知范围（页头刷新）。 */
  reloadAll(): void {
    const known = new Set([...this.cache.keys(), ...this.pending.keys()])
    this.cache.clear()
    for (const days of known) if (!this.pending.has(days)) this.start(days)
    this.bump()
  }

  private start(days: number): void {
    const task = this.rpc.call<TokenStatsPayload>(CODEBUDDY_AUTH_CHANNEL, 'tokenStats', { days })
      .then((result) => {
        if (result.ok) {
          this.cache.set(days, result.value)
          this.failures.delete(days)
        } else {
          this.failures.set(days, 'unavailable')
        }
      })
      .catch(() => { this.failures.set(days, 'unavailable') })
      .finally(() => {
        this.pending.delete(days)
        this.bump()
      })
    this.pending.set(days, task)
    this.bump()
  }

  private bump(): void {
    this.version += 1
    for (const listener of this.listeners) listener()
  }
}
