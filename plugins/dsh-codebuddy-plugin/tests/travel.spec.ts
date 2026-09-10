import { afterEach, describe, expect, it } from 'vitest'
import { claimTravel, departTravel, fetchTravelLocations, fetchTravelStatus } from '../src/host/travel.ts'
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
    expect(calls[0]!.headers['x-client-platform']).toBe('web')
    expect(calls[0]!.headers['origin']).toBe(ENDPOINT)
    expect(calls[0]!.headers['referer']).toBe(`${ENDPOINT}/profile/growth-center`)
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
