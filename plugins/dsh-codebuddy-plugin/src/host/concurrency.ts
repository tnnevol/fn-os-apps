/**
 * 周期任务与账号批量探测共用的并发原语。
 *
 * @module dsh-codebuddy/concurrency
 */

/**
 * 防重入标志，对照 workbuddy-switch 的 `RunFlagGuard`。
 *
 * 每个周期由定时器驱动，而一轮要串行访问 N 个账号的远端接口；只要一轮耗时
 * 超过定时器间隔（网络慢/账号多时很常见），下一轮就会叠加上来，同一账号被
 * 并发派发或重复领取。`tryAcquire()` 用一次「检查并置位」把这种叠加挡在门外：
 * 拿不到标志说明上一轮还在跑，本轮直接跳过。
 *
 * 与 Rust 版的差别：JS 没有 Drop，所以调用方必须用 try/finally 释放。
 */
export class RunGuard {
  private running = false
  /** 上一次被跳过（仍在运行）的原因，供 RPC/日志说明。 */
  private lastSkipReason: string | undefined

  constructor(private readonly label: string) {}

  get isRunning(): boolean {
    return this.running
  }

  /** 便于诊断：`[label]` 前缀。 */
  get name(): string {
    return this.label
  }

  /**
   * 尝试占用。成功返回一个只可释放一次的句柄；已被占用返回 `undefined`。
   * 调用方必须 `try { ... } finally { handle.release() }`。
   */
  tryAcquire(): RunHandle | undefined {
    if (this.running) {
      this.lastSkipReason = 'already_running'
      return undefined
    }
    this.running = true
    this.lastSkipReason = undefined
    let released = false
    return {
      release: (): void => {
        // 幂等：重复 release 不会误清掉后续占用者的标志。
        if (released) return
        released = true
        this.running = false
      },
    }
  }

  get skipReason(): string | undefined {
    return this.lastSkipReason
  }
}

export interface RunHandle {
  /** 幂等释放。 */
  release: () => void
}

/**
 * 连续全失败时的退避闸门：失败到阈值后**暂时**跳过后续轮次，冷却期满自动放行重试。
 *
 * 与「到阈值就永久 standby」的区别是关键：那种写法一旦计数器到了上限，后续
 * 调用会在重算计数器**之前**就返回，计数永远不再下降——周期从此再也不会执行，
 * 只能重启宿主。远端故障（网络、服务不可达）恰恰是会自行恢复的，后台任务必须
 * 在恢复后能自己接着跑。
 *
 * 退避期间仍会放行重试，所以恢复是自动的；同时把重试频率压到 `cooldownMs`
 * 一次，避免对着不可达的服务空转。
 */
export class BackoffGate {
  private failures = 0
  private nextAttemptAt = 0

  constructor(
    private readonly limit: number,
    private readonly cooldownMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** 是否处于退避期（应跳过本轮）。 */
  shouldSkip(): boolean {
    return this.failures >= this.limit && this.now() < this.nextAttemptAt
  }

  /** 当前连续失败轮数，供日志与 UI 说明。 */
  get consecutiveFailures(): number {
    return this.failures
  }

  /** 一轮成功：清零，下一轮立即可进入。 */
  succeed(): void {
    this.failures = 0
    this.nextAttemptAt = 0
  }

  /** 一轮全失败：累计，并按指数退避安排下一次真正执行的时间。 */
  fail(): void {
    this.failures += 1
    if (this.failures < this.limit) return
    // 阈值之后每次失败把冷却拉长一倍，上限 8 倍：长时间故障下不再固定频率
    // 空转，同时始终保留自愈能力。
    const factor = Math.min(2 ** (this.failures - this.limit), 8)
    this.nextAttemptAt = this.now() + this.cooldownMs * factor
  }
}

/**
 * 以受限并发遍历 `items`，并保证每一项的 `fn` 都已被 await 完成后再返回。
 *
 * 结果请由 `fn` 自行写入调用方持有的数组（按索引回填即可保住原顺序）；
 * 这里只负责调度，不收集返回值——这样调用方不必为了保序而再排序一次。
 * 单项抛错会冒泡终止整个批次，需要隔离就请在 `fn` 内自行 try/catch。
 */
export async function mapWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const size = Math.max(1, Math.min(Math.floor(limit) || 1, items.length))
  let cursor = 0
  // 固定启动 size 个 worker，各自取下一个索引，直到取完：天然限流且无需队列。
  const workers = Array.from({ length: size }, async () => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      await fn(items[index] as T, index)
    }
  })
  await Promise.all(workers)
}
