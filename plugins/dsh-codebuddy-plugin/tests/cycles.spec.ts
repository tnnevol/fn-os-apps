import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, chmodSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CodeBuddyAuthService } from '../src/auth-service.ts'
import { CodeBuddySession } from '../src/session.ts'
import { CODEBUDDY_ENDPOINT } from '../src/constants.ts'

// 构造器会异步读取偏好并据此启动后台周期（三项默认全开）。这些周期在测试里
// 只制造噪声：它们发出的请求会与断言用的 fetch 桩交叠，把「账号并发度」测成
// 假的（实测能把串行实现测出峰值 2）。这里把偏好固定为「关」，周期只在本测试
// 显式调用时才运行——偏好读取本身不是这组测试的对象。
vi.mock('../src/storage.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/storage.ts')>()
  return {
    ...actual,
    loadAutoSwitchConfig: async () => ({ enabled: false, thresholdPct: 10 }),
    loadAutoCheckinConfig: async () => ({ enabled: false }),
    loadAutoTravelConfig: async () => ({ enabled: false }),
  }
})

/**
 * 周期任务的重入保护与定时器归属——这两件事只能对着真实服务测：
 * 单测 RunGuard 本身不能证明 `runTravelCycle` 真的接上了它，
 * 也不能证明 `start*Cycle` 在卸载后不再留下定时器。
 */

let workdir: string | undefined

function makeCtx(): { logger: { warn: () => void, info: () => void }, effect: (fn: () => () => void, label?: string) => void, inject: () => void, effects: Array<() => void> } {
  const effects: Array<() => void> = []
  return {
    logger: { warn: () => {}, info: () => {} },
    effects,
    effect(fn: () => () => void): void { effects.push(fn()) },
    // 连接注入在单测里不需要：RPC 注册与周期任务无关。
    inject: () => {},
  }
}

function writeAccounts(count: number): void {
  workdir = mkdtempSync(join(tmpdir(), 'codebuddy-cycles-'))
  const path = join(workdir, 'codebuddy-auth.json')
  process.env.DSH_CODEBUDDY_AUTH_FILE = path
  const accounts = Array.from({ length: count }, (_, index) => ({
    id: `acc-${index}`,
    environment: 'internal',
    account: { uid: `u${index}`, nickname: `账号${index}`, enterpriseId: undefined },
    auth: { accessToken: `token-${index}`, refreshToken: 'r', expiresAt: Date.now() + 3_600_000, refreshExpiresAt: Date.now() + 86_400_000 },
  }))
  writeFileSync(path, JSON.stringify({ version: 2, activeId: 'acc-0', accounts }), 'utf-8')
  chmodSync(path, 0o600)
}

async function makeService(ctx = makeCtx()): Promise<CodeBuddyAuthService> {
  // 账号身份由 session 从存储解析；不传 session 时所有账号都会被跳过，
  // 那样测的就只是空转而不是真实周期。
  const service = new CodeBuddyAuthService(ctx as never, new CodeBuddySession())
  // 偏好已被 mock 成「关」，等构造器里那几个 then 回调落地即可：它们不会启动
  // 任何周期，因此不会污染本测试的 fetch 桩。
  await drainPrefs()
  return service
}

/** 让构造器内 load*Config 的 then 回调全部执行完。 */
async function drainPrefs(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve()
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  delete process.env.DSH_CODEBUDDY_AUTH_FILE
  if (workdir !== undefined) {
    rmSync(workdir, { recursive: true, force: true })
    workdir = undefined
  }
})

describe('周期任务重入保护', () => {
  it('旅行派发周期：上一轮未结束时，并发调用返回 skipped 而不是叠加执行', async () => {
    writeAccounts(1)
    const ctx = makeCtx()
    const service = await makeService(ctx)
    service.autoTravel = true

    // 让远端探测悬挂，从而把一轮「钉」在执行中。
    let releaseProbe: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { releaseProbe = resolve })
    let statusCalls = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      statusCalls += 1
      await gate
      return new Response(JSON.stringify({ code: 0, msg: 'OK', data: { state: 'traveling', arriveAt: 0 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }))

    const first = service.runTravelCycle()
    // 第二轮在首轮仍 await 远端时进入：必须被拒绝。
    const second = await service.runTravelCycle()
    expect(second.status).toBe('skipped')
    expect(second.accounts).toEqual([])

    releaseProbe?.()
    const firstResult = await first
    expect(firstResult.status).toBe('ok')
    // 只探测了一次：第二轮没有真的打请求。
    expect(statusCalls).toBe(1)
  })

  it('旅行领取周期同样受保护，且与派发周期各自独立', async () => {
    writeAccounts(1)
    const service = await makeService()
    service.autoTravel = true

    // 第一波请求（派发周期）挂住；领取周期在其后进入，用 its own 标志独立计时。
    let releaseProbe: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { releaseProbe = resolve })
    let claimReachedNetwork: (() => void) | undefined
    const claimStarted = new Promise<void>((resolve) => { claimReachedNetwork = resolve })

    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1
      // 第二次调用来自领取周期：说明它没被派发周期的标志挡住。
      if (calls === 2) claimReachedNetwork?.()
      await gate
      return new Response(JSON.stringify({ code: 0, msg: 'OK', data: { state: 'traveling', arriveAt: 0 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }))

    const dispatch = service.runTravelCycle()
    const claim = service.runTravelClaimCycle()
    // 等领取周期真的打到网络：证明两个标志互不阻塞。
    await claimStarted
    // 领取周期自己再进入一次：应被它自己的标志挡住。
    const secondClaim = await service.runTravelClaimCycle()
    expect(secondClaim.status).toBe('skipped')

    releaseProbe?.()
    expect((await claim).status).toBe('ok')
    await dispatch
  })

  it('自动签到周期：并发进入被 skipped 挡住', async () => {
    writeAccounts(1)
    const service = await makeService()
    service.autoCheckin = true

    let releaseProbe: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { releaseProbe = resolve })
    vi.stubGlobal('fetch', vi.fn(async () => {
      await gate
      return new Response(JSON.stringify({ code: 0, msg: 'OK', data: { todayCheckedIn: false } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }))

    const first = service.runAutoCheckinCycle()
    const second = await service.runAutoCheckinCycle()
    expect(second.status).toBe('skipped')
    releaseProbe?.()
    await first
  })

  it('标志在周期抛错后仍然释放（不会永久卡死）', async () => {
    writeAccounts(1)
    const service = await makeService()
    service.autoTravel = true
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))

    const first = await service.runTravelCycle()
    expect(first.status).toBe('ok')
    // 第二轮能正常进入（虽然同样失败），说明标志没有泄漏。
    const second = await service.runTravelCycle()
    expect(second.status).toBe('ok')
  })
})

describe('定时器归属', () => {
  it('卸载时清掉全部周期定时器', async () => {
    writeAccounts(1)
    const ctx = makeCtx()
    const service = await makeService(ctx)

    service.startAutoSwitchCycle()
    service.startAutoCheckinCycle()
    service.startTravelCycle()
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    // 执行 effect 的 disposer：卸载插件。
    for (const dispose of ctx.effects) dispose()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('卸载后不再启动新的定时器（异步配置回调晚到也不会留下孤儿）', async () => {
    writeAccounts(1)
    const ctx = makeCtx()
    const service = await makeService(ctx)
    for (const dispose of ctx.effects) dispose()

    service.startAutoSwitchCycle()
    service.startAutoCheckinCycle()
    service.startTravelCycle()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('重复 start 不会叠加定时器', async () => {
    writeAccounts(1)
    const service = await makeService()
    service.startTravelCycle()
    const afterFirst = vi.getTimerCount()
    service.startTravelCycle()
    expect(vi.getTimerCount()).toBe(afterFirst)

    service.stopTravelCycle()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('账号批量探测并发', () => {
  // 这一组要真实等待远端响应来观察并发度，假定时器会让 setTimeout 永不触发。
  beforeEach(() => { vi.useRealTimers() })

  /**
   * 账号 id 走 `X-User-Id` 请求头（不在 URL 里）。
   *
   * 并发度按「同时在跑的账号数」量，不能只数请求：单账号内部就并发打 2–3 个
   * 请求，串行实现也会测出请求峰值 > 1。用计数而非 Set 也不可省——同一账号的
   * 请求先后返回，先返回的那个会把账号从 Set 里删掉，让计数虚高。
   */
  function accountIdOf(init?: RequestInit): string {
    const headers = init?.headers as Record<string, string> | undefined
    return headers?.['X-User-Id'] ?? 'unknown'
  }

  function stubMeter(handler?: (uid: string) => Promise<void> | void): { peakAccounts: () => number } {
    const inFlight = new Map<string, number>()
    let peak = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const uid = accountIdOf(init)
      inFlight.set(uid, (inFlight.get(uid) ?? 0) + 1)
      let live = 0
      for (const count of inFlight.values()) if (count > 0) live += 1
      peak = Math.max(peak, live)
      try {
        await handler?.(uid)
        const body = String(url).includes('checkin')
          ? { todayCheckedIn: false }
          : { state: 'idle', dailyLimitReached: false }
        return new Response(JSON.stringify({ code: 0, msg: 'OK', data: body }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      } finally {
        inFlight.set(uid, (inFlight.get(uid) ?? 1) - 1)
      }
    }))
    return { peakAccounts: () => peak }
  }

  it('panelStatus 同时探测多个账号，而不是一个账号接一个账号', async () => {
    writeAccounts(4)
    const service = await makeService()
    const meter = stubMeter(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })

    await service.panelStatus()
    // 串行实现下账号区间不交叠，peak 恒为 1。
    expect(meter.peakAccounts()).toBeGreaterThan(1)
  })

  it('并发有上限，不会一次把所有账号都铺开', async () => {
    writeAccounts(12)
    const service = await makeService()
    const meter = stubMeter(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    await service.panelStatus()
    expect(meter.peakAccounts()).toBeLessThanOrEqual(4)
  })

  it('并发探测后仍按账号存储顺序返回，卡片顺序不抖动', async () => {
    writeAccounts(4)
    const service = await makeService()

    // 让靠前的账号最慢：若实现按完成顺序收集，顺序就会被打乱。
    const delayByUid: Record<string, number> = { u0: 40, u1: 30, u2: 20, u3: 1 }
    stubMeter(async (uid) => {
      await new Promise(resolve => setTimeout(resolve, delayByUid[uid] ?? 1))
    })

    const result = await service.panelStatus() as { accounts: Array<{ id: string }> }
    expect(result.accounts.map(row => row.id)).toEqual(['acc-0', 'acc-1', 'acc-2', 'acc-3'])
  })
})

describe('端点常量', () => {
  it('测试使用的默认端点存在（防止 storage 读取失败被误当成并发问题）', () => {
    expect(CODEBUDDY_ENDPOINT).toBeTruthy()
  })
})
