import { describe, expect, it, vi } from 'vitest'
import { BackoffGate, mapWithConcurrency, RunGuard } from '../src/host/concurrency.ts'

describe('RunGuard', () => {
  it('首次占用成功，占用期间再次占用被拒绝', () => {
    const guard = new RunGuard('test')
    const first = guard.tryAcquire()
    expect(first).toBeDefined()
    expect(guard.isRunning).toBe(true)

    const second = guard.tryAcquire()
    expect(second).toBeUndefined()
    expect(guard.skipReason).toBe('already_running')
  })

  it('释放后可以再次占用（定时器下一轮）', () => {
    const guard = new RunGuard('test')
    const first = guard.tryAcquire()
    first?.release()
    expect(guard.isRunning).toBe(false)
    expect(guard.skipReason).toBeUndefined()

    const second = guard.tryAcquire()
    expect(second).toBeDefined()
    expect(guard.isRunning).toBe(true)
    second?.release()
  })

  it('重复释放不会让后来者失去保护', () => {
    const guard = new RunGuard('test')
    const first = guard.tryAcquire()
    const second = guard.tryAcquire()
    expect(second).toBeUndefined()

    // 过期的句柄被重复释放：不能把当前占用者的标志清掉。
    first?.release()
    first?.release()
    expect(guard.isRunning).toBe(false)

    const third = guard.tryAcquire()
    expect(third).toBeDefined()
    third?.release()
  })

  it('异步周期在 await 期间保持占用——这正是重入发生的窗口', async () => {
    const guard = new RunGuard('test')
    let concurrentPeak = 0
    let active = 0

    const cycle = async (): Promise<string> => {
      const handle = guard.tryAcquire()
      if (handle === undefined) return 'skipped'
      try {
        active += 1
        concurrentPeak = Math.max(concurrentPeak, active)
        // 模拟远端探测：期间定时器又触发了一轮。
        await new Promise(resolve => setTimeout(resolve, 10))
        active -= 1
        return 'ran'
      } finally {
        handle.release()
      }
    }

    // 两轮几乎同时开始：第二轮必须被跳过，而不是叠加执行。
    const [a, b] = await Promise.all([cycle(), cycle()])
    expect([a, b].filter(r => r === 'ran')).toHaveLength(1)
    expect([a, b].filter(r => r === 'skipped')).toHaveLength(1)
    expect(concurrentPeak).toBe(1)
  })

  it('周期抛错时仍然释放标志，不会永久卡死', async () => {
    const guard = new RunGuard('test')
    await expect((async () => {
      const handle = guard.tryAcquire()
      try {
        throw new Error('remote failure')
      } finally {
        handle?.release()
      }
    })()).rejects.toThrow('remote failure')
    expect(guard.isRunning).toBe(false)
    expect(guard.tryAcquire()).toBeDefined()
  })
})

describe('mapWithConcurrency', () => {
  it('按索引回填可保持原始顺序，即使完成顺序相反', async () => {
    const slots: Array<string | undefined> = new Array(4).fill(undefined)
    await mapWithConcurrency([30, 20, 10, 1], 4, async (delay, index) => {
      await new Promise(resolve => setTimeout(resolve, delay))
      slots[index] = `item-${index}`
    })
    expect(slots).toEqual(['item-0', 'item-1', 'item-2', 'item-3'])
  })

  it('并发上限生效，不会一次铺开全部条目', async () => {
    let active = 0
    let peak = 0
    await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 3, async () => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, 5))
      active -= 1
    })
    expect(peak).toBeLessThanOrEqual(3)
    expect(peak).toBeGreaterThan(1)
  })

  it('全部条目都被处理一次', async () => {
    const seen: number[] = []
    await mapWithConcurrency([1, 2, 3, 4, 5], 2, async item => { seen.push(item) })
    expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
  })

  it('空数组直接返回', async () => {
    const fn = vi.fn()
    await mapWithConcurrency([], 4, fn)
    expect(fn).not.toHaveBeenCalled()
  })

  it('limit 非法时退化为串行而不是死锁', async () => {
    const order: string[] = []
    await mapWithConcurrency(['a', 'b'], 0, async item => { order.push(item) })
    expect(order).toEqual(['a', 'b'])
  })

  it('并发确实快于串行（4 个 20ms 任务）', async () => {
    const start = Date.now()
    await mapWithConcurrency([1, 2, 3, 4], 4, async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })
    const concurrent = Date.now() - start

    const serialStart = Date.now()
    for (const _ of [1, 2, 3, 4]) await new Promise(resolve => setTimeout(resolve, 20))
    const serial = Date.now() - serialStart

    // 计时断言天然受机器负载影响，裕度取到「并发应不到串行一半」这种量级，
    // 否则 CI 抖动会造成假失败。
    expect(concurrent).toBeLessThan(serial * 0.7)
  })
})

describe('BackoffGate', () => {
  /**
   * 这组测试守的是一个真实事故：此前的实现是「连续失败到阈值就永久 standby」，
   * 而那个 return 发生在**重算计数器之前**，因此计数再无下降机会——周期从此
   * 再也不会执行，只能重启宿主。远端故障会自动恢复，后台任务必须能自愈。
   */
  function makeGate(limit = 3, cooldownMs = 1000): { gate: BackoffGate, advance: (ms: number) => void } {
    let now = 0
    return {
      gate: new BackoffGate(limit, cooldownMs, () => now),
      advance: (ms: number) => { now += ms },
    }
  }

  it('阈值之前不跳过', () => {
    const { gate } = makeGate()
    expect(gate.shouldSkip()).toBe(false)
    gate.fail()
    gate.fail()
    expect(gate.shouldSkip()).toBe(false)
    expect(gate.consecutiveFailures).toBe(2)
  })

  it('达到阈值后进入退避期', () => {
    const { gate } = makeGate()
    gate.fail()
    gate.fail()
    gate.fail()
    expect(gate.consecutiveFailures).toBe(3)
    expect(gate.shouldSkip()).toBe(true)
  })

  it('冷却期满自动放行——这是自愈的关键', () => {
    const { gate, advance } = makeGate(3, 1000)
    gate.fail(); gate.fail(); gate.fail()
    expect(gate.shouldSkip()).toBe(true)

    advance(999)
    expect(gate.shouldSkip()).toBe(true)
    advance(1)
    // 冷却到期：不再跳过，周期自己接着跑。
    expect(gate.shouldSkip()).toBe(false)
  })

  it('退避期间继续失败则冷却拉长，但有上限', () => {
    const { gate, advance } = makeGate(2, 1000)
    gate.fail(); gate.fail()
    // failures=2 → factor 2^0 = 1 → 1000ms
    advance(1000)
    expect(gate.shouldSkip()).toBe(false)

    gate.fail() // failures=3 → 2^1 = 2 → 2000ms
    advance(1000)
    expect(gate.shouldSkip()).toBe(true)
    advance(1000)
    expect(gate.shouldSkip()).toBe(false)

    // 持续失败，冷却倍数封顶在 8。
    for (let i = 0; i < 10; i += 1) gate.fail()
    advance(8000)
    expect(gate.shouldSkip()).toBe(false)
    gate.fail()
    advance(8000)
    expect(gate.shouldSkip()).toBe(false)
  })

  it('一轮成功立即恢复正常节奏', () => {
    const { gate, advance } = makeGate(3, 1000)
    gate.fail(); gate.fail(); gate.fail()
    expect(gate.shouldSkip()).toBe(true)

    gate.succeed()
    expect(gate.shouldSkip()).toBe(false)
    expect(gate.consecutiveFailures).toBe(0)
    // 成功也把下一次尝试时间清掉，不会残留旧的冷却。
    advance(0)
    expect(gate.shouldSkip()).toBe(false)
  })
})
