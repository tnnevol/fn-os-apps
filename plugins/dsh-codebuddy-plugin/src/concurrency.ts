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
