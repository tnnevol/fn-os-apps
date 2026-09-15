import { afterEach, describe, expect, it } from 'vitest'
import {
  adoptBuddy,
  claimTravel,
  departTravel,
  fetchTravelLocations,
  fetchTravelStatus,
  hasBuddy,
  isAdoptThresholdError,
} from '../src/host/travel.ts'
import type { CodeBuddyIdentity } from '../src/host/codebuddy.ts'

const IDENTITY: CodeBuddyIdentity = {
  accessToken: 'token',
  domain: 'copilot.tencent.com',
  uid: 'u1',
}

const ENDPOINT = 'https://copilot.tencent.com'

function envelope(data: unknown, code = 0): Response {
  return new Response(JSON.stringify({ code, msg: code === 0 ? 'OK' : 'err', data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function stub(handler: (url: string, init?: RequestInit) => Response): { calls: Array<{ url: string, method: string, body?: string, headers: Record<string, string> }> } {
  const calls: Array<{ url: string, method: string, body?: string, headers: Record<string, string> }> = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: String(init?.method ?? 'GET'),
      ...(typeof init?.body === 'string' ? { body: init.body } : {}),
      headers: (init?.headers ?? {}) as Record<string, string>,
    })
    return handler(String(input), init)
  }) as typeof fetch
  afterEach(() => { globalThis.fetch = original })
  return { calls }
}

describe('CodeBuddy buddy travel', () => {
  it('sends the growth-centre browser context headers the plane requires', async () => {
    const { calls } = stub(() => envelope({ state: 'idle', buddy_id: 0, record_id: 0, daily_limit_reached: false }))
    await fetchTravelStatus(ENDPOINT, IDENTITY)
    // 用 `header(name)` 读取：被测对象是**头名到值的映射**，而非普通对象属性。
    // 写成 `headers.origin` 会把「这是 HTTP 头」读成「这是字段访问」，而且
    // `x-client-platform` 带连字符只能走索引——同一组断言两种写法很别扭。
    const headers = calls[0]!.headers
    const header = (name: string): string | undefined => headers[name]
    expect(header('x-client-platform')).toBe('web')
    expect(header('origin')).toBe(ENDPOINT)
    expect(header('referer')).toBe(`${ENDPOINT}/profile/growth-center`)
  })

  it('reads the travel state machine fields from a status reply', async () => {
    stub(() => envelope({
      state: 'traveling',
      buddy_id: 6965413,
      record_id: 4266678,
      location: { id: 1, code: 'coffee', name: '咖啡馆' },
      depart_at: 100,
      arrive_at: 200,
      server_now: 150,
      daily_limit_reached: true,
      duration_hours: 1,
      reward_credit: 10,
    }))
    const status = await fetchTravelStatus(ENDPOINT, IDENTITY)
    expect(status.ok).toBe(true)
    expect(status.state).toBe('traveling')
    expect(status.locationName).toBe('咖啡馆')
    expect(status.arriveAt).toBe(200)
    expect(status.dailyLimitReached).toBe(true)
    expect(status.rewardCredit).toBe(10)
  })

  it('marks the enterprise refusal as unsupported rather than a retryable error', async () => {
    stub(() => new Response(JSON.stringify({ code: 403, msg: 'growth system is only available for personal users' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    }))
    const status = await fetchTravelStatus(ENDPOINT, IDENTITY)
    expect(status.ok).toBe(false)
    expect(status.unsupported).toBe(true)
  })

  it('parses the location catalog', async () => {
    stub(() => envelope({
      locations: [
        { id: 1, code: 'coffee', name: '咖啡馆', duration_hours_min: 1, duration_hours_max: 4, reward_credit_min: 5, reward_credit_max: 10 },
        { id: 2, code: 'gym', name: '健身房' },
        { id: 0, code: 'broken', name: '' },
      ],
    }))
    const locations = await fetchTravelLocations(ENDPOINT, IDENTITY)
    expect(locations.map(l => l.name)).toEqual(['咖啡馆', '健身房'])
    expect(locations[0]!.rewardCreditMax).toBe(10)
  })

  it('treats "already traveling" as a state-machine branch, not a failure', async () => {
    stub(() => new Response(JSON.stringify({ code: 400, msg: 'already traveling' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }))
    const result = await departTravel(ENDPOINT, IDENTITY, 1)
    expect(result.ok).toBe(false)
    expect(result.already).toBe(true)
    expect(result.state).toBe('traveling')
  })

  it('posts the numeric location id when departing', async () => {
    const { calls } = stub(() => envelope({ state: 'traveling' }))
    const result = await departTravel(ENDPOINT, IDENTITY, 3)
    expect(result.ok).toBe(true)
    expect(calls[0]!.method).toBe('POST')
    expect(calls[0]!.body).toBe(JSON.stringify({ location_id: 3 }))
  })

  it('reports the claimed reward', async () => {
    stub(() => envelope({ reward_credit: 8 }))
    const result = await claimTravel(ENDPOINT, IDENTITY, 42)
    expect(result.ok).toBe(true)
    expect(result.rewardCredit).toBe(8)
  })

  it('surfaces "not arrived yet" so the caller retries on a later round', async () => {
    stub(() => new Response(JSON.stringify({ code: 400, msg: 'not arrived yet' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }))
    const result = await claimTravel(ENDPOINT, IDENTITY, 42)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not arrived yet')
  })
})

describe('猫猫档案与领养（旅行前置）', () => {
  it('buddy 为 null 表示确实没有猫猫', async () => {
    stub(() => envelope({ buddy: null, poll_interval_seconds: 3 }))
    expect(await hasBuddy(ENDPOINT, IDENTITY)).toBe(false)
  })

  it('buddy 有内容表示已有猫猫', async () => {
    stub(() => envelope({ buddy: { instance_id: 1, name: '像素喵' } }))
    expect(await hasBuddy(ENDPOINT, IDENTITY)).toBe(true)
  })

  it('缺 buddy 字段时返回 undefined，不触发领养', async () => {
    // 关键：把「字段缺失」当成无猫会让任何异常响应体都触发一整轮领养链
    // （上报 + 协议 + buddy/first），宁可这轮不领养也不要在形状不认识时乱动账号。
    stub(() => envelope({ poll_interval_seconds: 3 }))
    expect(await hasBuddy(ENDPOINT, IDENTITY)).toBeUndefined()
  })

  it('查询失败时返回 undefined（无法判定）', async () => {
    stub(() => new Response('nope', { status: 500 }))
    expect(await hasBuddy(ENDPOINT, IDENTITY)).toBeUndefined()
  })

  it('不能拿 travel/status 的 buddy_id 判断有无猫猫', async () => {
    // 未派发时服务端一律返回 buddy_id: 0；若用它判断，从未派发过的账号
    // 会被永久拦在派发之外（越是没派过就越被拦）。
    stub(() => envelope({ state: 'idle', buddy_id: 0, record_id: 0, daily_limit_reached: false }))
    const status = await fetchTravelStatus(ENDPOINT, IDENTITY)
    expect(status.ok).toBe(true)
    // 同时 buddy/info 说确实有猫 → 两者语义不同，不能互相替代。
    stub(() => envelope({ buddy: { instance_id: 7627132 } }))
    expect(await hasBuddy(ENDPOINT, IDENTITY)).toBe(true)
  })

  it('领养链路先同意协议再 buddy/first', async () => {
    const { calls } = stub(() => envelope({}))
    const result = await adoptBuddy(ENDPOINT, IDENTITY)
    expect(result.ok).toBe(true)
    expect(calls.map(call => call.url)).toEqual([
      `${ENDPOINT}/activity/growth/buddy/agreement`,
      `${ENDPOINT}/activity/growth/buddy/first`,
    ])
    expect(calls[0]!.method).toBe('POST')
    expect(JSON.parse(calls[0]!.body!)).toEqual({ agree: true })
  })

  it('「门槛未达标」标记为 threshold，供调用方记当日已试', async () => {
    stub(() => new Response(
      JSON.stringify({ code: 400, msg: 'first_buddy task not completed yet' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    ))
    const result = await adoptBuddy(ENDPOINT, IDENTITY)
    expect(result.ok).toBe(false)
    expect(result.threshold).toBe(true)
  })

  it('其它失败不算 threshold（下次仍应重试）', async () => {
    stub(() => new Response(
      JSON.stringify({ code: 500, msg: 'internal error' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    ))
    const result = await adoptBuddy(ENDPOINT, IDENTITY)
    expect(result.ok).toBe(false)
    expect(result.threshold).toBeUndefined()
  })

  it('isAdoptThresholdError 按文案识别门槛错误', () => {
    expect(isAdoptThresholdError(new Error('first_buddy task not completed yet'))).toBe(true)
    expect(isAdoptThresholdError(new Error('500 internal'))).toBe(false)
  })
})
