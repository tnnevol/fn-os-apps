import { describe, expect, it, vi } from 'vitest'
import { UsageProbeCache, remainingOf, DEFAULT_USAGE_TTL_MS } from '../src/host/usage-probe.ts'
import type { UsageSnapshot } from '../src/host/usage.ts'
import type { CodeBuddyIdentity } from '../src/host/codebuddy.ts'

/**
 * 统一探测的价值全在「少打远端」与「同一份数据」两点上，因此这里主要断言
 * **探测次数**与**单飞行为**。
 */

const IDENTITY = { uid: 'u', accessToken: 't', domain: 'd' } as unknown as CodeBuddyIdentity
const ENDPOINT = 'https://example.test'

/** 造一个带指定剩余百分比的快照。 */
function snapshot(used: number, limit: number): UsageSnapshot {
  return { windows: [{ name: 'w', used, limit, usedPercent: (used / limit) * 100 }] }
}

/** 可控时钟。 */
function clock(start = 1_000_000): { now: () => number, advance: (ms: number) => void } {
  let value = start
  return { now: () => value, advance: (ms) => { value += ms } }
}

describe('UsageProbeCache：TTL 内复用', () => {
  it('同一账号连续两次探测只打一次远端', async () => {
    const probe = vi.fn(async () => snapshot(20, 100))
    const time = clock()
    const cache = new UsageProbeCache(probe, 30_000, time.now)

    const first = await cache.probeAccount('a', ENDPOINT, IDENTITY)
    const second = await cache.probeAccount('a', ENDPOINT, IDENTITY)
    console.log(`  探测次数: ${probe.mock.calls.length}`)
    expect(probe).toHaveBeenCalledTimes(1)
    expect(first.fromCache).toBe(false)
    expect(second.fromCache).toBe(true)
  })

  it('TTL 过期后重新探测', async () => {
    const probe = vi.fn(async () => snapshot(20, 100))
    const time = clock()
    const cache = new UsageProbeCache(probe, 30_000, time.now)

    await cache.probeAccount('a', ENDPOINT, IDENTITY)
    time.advance(DEFAULT_USAGE_TTL_MS - 1)
    await cache.probeAccount('a', ENDPOINT, IDENTITY)
    expect(probe).toHaveBeenCalledTimes(1)   // 仍在 TTL 内

    time.advance(2)                          // 越过 TTL
    await cache.probeAccount('a', ENDPOINT, IDENTITY)
    expect(probe).toHaveBeenCalledTimes(2)
  })

  it('force 跳过缓存', async () => {
    const probe = vi.fn(async () => snapshot(20, 100))
    const time = clock()
    const cache = new UsageProbeCache(probe, 30_000, time.now)
    await cache.probeAccount('a', ENDPOINT, IDENTITY)
    const forced = await cache.probeAccount('a', ENDPOINT, IDENTITY, { force: true })
    expect(probe).toHaveBeenCalledTimes(2)
    expect(forced.fromCache).toBe(false)
  })

  it('不同账号各自缓存', async () => {
    const probe = vi.fn(async () => snapshot(20, 100))
    const cache = new UsageProbeCache(probe, 30_000, clock().now)
    await cache.probeAccount('a', ENDPOINT, IDENTITY)
    await cache.probeAccount('b', ENDPOINT, IDENTITY)
    expect(probe).toHaveBeenCalledTimes(2)
  })

  it('同一账号不同端点视为不同目标', async () => {
    const probe = vi.fn(async () => snapshot(20, 100))
    const cache = new UsageProbeCache(probe, 30_000, clock().now)
    await cache.probeAccount('a', 'https://one.test', IDENTITY)
    await cache.probeAccount('a', 'https://two.test', IDENTITY)
    expect(probe).toHaveBeenCalledTimes(2)
  })
})

describe('UsageProbeCache：单飞', () => {
  it('并发的探测只发一次请求（面板刷新与切换周期同时发生的场景）', async () => {
    let resolve!: (value: UsageSnapshot | undefined) => void
    const probe = vi.fn(() => new Promise<UsageSnapshot | undefined>((r) => { resolve = r }))
    const cache = new UsageProbeCache(probe, 30_000, clock().now)

    // 五个并发消费者（面板 + 周期 + 被动切换…）
    const all = Promise.all(Array.from({ length: 5 }, () => cache.probeAccount('a', ENDPOINT, IDENTITY)))
    resolve(snapshot(20, 100))
    const results = await all
    console.log(`  五个并发消费者的实际探测次数: ${probe.mock.calls.length}`)
    expect(probe).toHaveBeenCalledTimes(1)
    // 五个消费者拿到同一个结果
    for (const r of results) expect(r.remainingPct).toBe(80)
  })

  it('force 与在途探测并存时也只发一次（force 不并发重复请求）', async () => {
    let resolve!: (value: UsageSnapshot | undefined) => void
    const probe = vi.fn(() => new Promise<UsageSnapshot | undefined>((r) => { resolve = r }))
    const cache = new UsageProbeCache(probe, 30_000, clock().now)
    const first = cache.probeAccount('a', ENDPOINT, IDENTITY)
    const forced = cache.probeAccount('a', ENDPOINT, IDENTITY, { force: true })
    resolve(snapshot(20, 100))
    await Promise.all([first, forced])
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('探测结束后 inFlight 被清掉，后续在 TTL 内走缓存', async () => {
    const probe = vi.fn(async () => snapshot(20, 100))
    const cache = new UsageProbeCache(probe, 30_000, clock().now)
    await cache.probeAccount('a', ENDPOINT, IDENTITY)
    const after = await cache.probeAccount('a', ENDPOINT, IDENTITY)
    expect(after.fromCache).toBe(true)
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('**过期条目 + 在途探测** 并存时仍只发一次请求', async () => {
    // 这条覆盖单飞的顺序：若先判缓存再判在途，一个过期条目会让并发调用各自发起
    // 探测。场景很常见——30s 周期重探一个刚过期的账号时，面板也在刷新。
    // 曾经漏测这一种，「先判缓存」的变异逃过了所有用例。
    let resolveSecond!: (value: UsageSnapshot | undefined) => void
    let calls = 0
    const probe = vi.fn(() => {
      calls += 1
      if (calls === 1) return Promise.resolve(snapshot(20, 100))
      return new Promise<UsageSnapshot | undefined>((r) => { resolveSecond = r })
    })
    const time = clock()
    const cache = new UsageProbeCache(probe, 30_000, time.now)

    // 第一次：建立缓存
    await cache.probeAccount('a', ENDPOINT, IDENTITY)
    // 让条目过期
    time.advance(30_001)

    // 并发三个：第一个发起新探测（在途），另两个必须复用它
    const all = Promise.all([
      cache.probeAccount('a', ENDPOINT, IDENTITY),
      cache.probeAccount('a', ENDPOINT, IDENTITY),
      cache.probeAccount('a', ENDPOINT, IDENTITY),
    ])
    resolveSecond(snapshot(40, 100))
    const results = await all

    console.log(`  过期后三个并发消费者的探测次数: ${probe.mock.calls.length}`)
    expect(probe).toHaveBeenCalledTimes(2)   // 首次 + 过期后一次，而不是 1+3
    for (const r of results) expect(r.remainingPct).toBe(60)
  })

  it('不变量：result 与 inFlight 从不同时存在', async () => {
    /**
     * 这条锁住缓存条目的不变量，它是「并发消费者都拿到真实数据」的原因，
     * 也是「判断顺序两种写法都安全」的原因。
     *
     * 一旦有人为了「探测期间也能读到旧值」而保留 result，不变量即被打破，
     * 判断顺序立刻变得关键（过期的 result 会让并发调用各自重探）。
     * 背景：曾用一个空结果占位，导致 5 个并发消费者里只有第 1 个拿到真实数据。
     */
    let release!: (v: UsageSnapshot | undefined) => void
    let calls = 0
    const probe = vi.fn(() => {
      calls += 1
      if (calls === 1) return Promise.resolve(snapshot(20, 100))
      return new Promise<UsageSnapshot | undefined>((r) => { release = r })
    })
    const time = clock()
    const cache = new UsageProbeCache(probe, 30_000, time.now)
    const entries = (cache as unknown as { entries: Map<string, { result?: unknown, inFlight?: unknown }> }).entries

    const bothPresent = (): boolean => {
      for (const [, entry] of entries) {
        if (entry.result !== undefined && entry.inFlight !== undefined) return true
      }
      return false
    }

    await cache.probeAccount('a', ENDPOINT, IDENTITY)
    expect(bothPresent()).toBe(false)

    time.advance(30_001)
    const all = Promise.all([
      cache.probeAccount('a', ENDPOINT, IDENTITY),
      cache.probeAccount('a', ENDPOINT, IDENTITY),
    ])
    // 在途期间：只有 inFlight，没有 result
    expect(bothPresent()).toBe(false)
    release(snapshot(40, 100))
    await all
    // 完成后：只有 result，没有 inFlight
    expect(bothPresent()).toBe(false)
  })
})

describe('UsageProbeCache：失败处理', () => {
  it('探测失败返回 error 且 snapshot 为 undefined，不抛异常', async () => {
    const cache = new UsageProbeCache(async () => undefined, 30_000, clock().now)
    const result = await cache.probeAccount('a', ENDPOINT, IDENTITY)
    expect(result.snapshot).toBeUndefined()
    expect(result.error).toBeTruthy()
    expect(result.fromCache).toBe(false)
  })

  it('抛出的异常被收敛成结果对象', async () => {
    const cache = new UsageProbeCache(async () => { throw new Error('boom') }, 30_000, clock().now)
    const result = await cache.probeAccount('a', ENDPOINT, IDENTITY)
    expect(result.snapshot).toBeUndefined()
    expect(result.error).toContain('boom')
  })

  it('失败结果也在 TTL 内复用（meter 抖动时不被每次刷新重打）', async () => {
    const probe = vi.fn(async () => undefined)
    const cache = new UsageProbeCache(probe, 30_000, clock().now)
    await cache.probeAccount('a', ENDPOINT, IDENTITY)
    await cache.probeAccount('a', ENDPOINT, IDENTITY)
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('失败与「额度为 0」可区分', async () => {
    // 探测失败：error 有值、remainingPct 无值
    const failed = await new UsageProbeCache(async () => undefined, 1000, clock().now)
      .probeAccount('a', ENDPOINT, IDENTITY)
    // 额度耗尽：快照存在、remainingPct 为 0、无 error
    const empty = await new UsageProbeCache(async () => snapshot(100, 100), 1000, clock().now)
      .probeAccount('a', ENDPOINT, IDENTITY)
    expect(failed.error).toBeTruthy()
    expect(failed.remainingPct).toBeUndefined()
    expect(empty.error).toBeUndefined()
    expect(empty.remainingPct).toBe(0)
  })
})

describe('UsageProbeCache：失效与清理', () => {
  it('invalidate 指定端点只删该条', async () => {
    const probe = vi.fn(async () => snapshot(20, 100))
    const cache = new UsageProbeCache(probe, 30_000, clock().now)
    await cache.probeAccount('a', 'https://one.test', IDENTITY)
    await cache.probeAccount('a', 'https://two.test', IDENTITY)
    cache.invalidate('a', 'https://one.test')
    expect(cache.size).toBe(1)
    await cache.probeAccount('a', 'https://one.test', IDENTITY)
    expect(probe).toHaveBeenCalledTimes(3)
  })

  it('invalidate 不带端点删掉该账号全部端点变体', async () => {
    const cache = new UsageProbeCache(async () => snapshot(20, 100), 30_000, clock().now)
    await cache.probeAccount('a', 'https://one.test', IDENTITY)
    await cache.probeAccount('a', 'https://two.test', IDENTITY)
    await cache.probeAccount('b', 'https://one.test', IDENTITY)
    cache.invalidate('a')
    expect(cache.size).toBe(1)
  })

  it('clear 清空', async () => {
    const cache = new UsageProbeCache(async () => snapshot(20, 100), 30_000, clock().now)
    await cache.probeAccount('a', ENDPOINT, IDENTITY)
    cache.clear()
    expect(cache.size).toBe(0)
  })

  it('peek 不发请求', async () => {
    const probe = vi.fn(async () => snapshot(20, 100))
    const cache = new UsageProbeCache(probe, 30_000, clock().now)
    expect(cache.peek('a', ENDPOINT)).toBeUndefined()
    await cache.probeAccount('a', ENDPOINT, IDENTITY)
    expect(cache.peek('a', ENDPOINT)?.remainingPct).toBe(80)
    expect(probe).toHaveBeenCalledTimes(1)
  })
})

describe('remainingOf：与 session 口径一致', () => {
  it('多窗口分别求和后再算比例', () => {
    const snap: UsageSnapshot = {
      windows: [
        { name: 'a', used: 10, limit: 100 },
        { name: 'b', used: 40, limit: 100 },
      ],
    }
    // 合计 used 50 / limit 200 → 剩余 75%
    expect(remainingOf(snap)).toBe(75)
  })

  it('无窗口或上限为 0 时返回 undefined（无法计算，不等于 0）', () => {
    expect(remainingOf(undefined)).toBeUndefined()
    expect(remainingOf({ windows: [] })).toBeUndefined()
    expect(remainingOf({ windows: [{ name: 'a', used: 0, limit: 0 }] })).toBeUndefined()
  })

  it('超额使用夹到 0，不超过 100', () => {
    expect(remainingOf(snapshot(150, 100))).toBe(0)
    expect(remainingOf(snapshot(-10, 100))).toBe(100)
  })

  it('仅有一个窗口时与 usedPercent 互补', () => {
    const snap = snapshot(30, 100)
    expect(remainingOf(snap)).toBe(70)
  })
})
