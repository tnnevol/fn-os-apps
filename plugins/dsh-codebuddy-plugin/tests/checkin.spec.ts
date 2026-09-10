import { afterEach, describe, expect, it } from 'vitest'
import { getCheckinStatus, performCheckin } from '../src/host/usage.ts'
import type { CodeBuddyIdentity } from '../src/host/codebuddy.ts'

const IDENTITY: CodeBuddyIdentity = {
  accessToken: 'token',
  domain: 'copilot.tencent.com',
  uid: 'u1',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function collectCalls(): { method: string, url: string }[] {
  const calls: { method: string, url: string }[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ method: String(init?.method ?? 'GET'), url: String(input) })
    return jsonResponse({ code: 0, msg: 'OK', data: { today_checked_in: false } })
  }) as typeof fetch
  afterEach(() => { globalThis.fetch = original })
  return calls
}

describe('CodeBuddy check-in transport', () => {
  it('queries check-in status with POST (a GET 404s on the meter plane)', async () => {
    const calls = collectCalls()
    const result = await getCheckinStatus('https://copilot.tencent.com', IDENTITY)
    expect(result.ok).toBe(true)
    expect(result.todayCheckedIn).toBe(false)
    expect(calls[0]).toEqual({
      method: 'POST',
      url: 'https://copilot.tencent.com/v2/billing/meter/checkin-activity-status',
    })
  })

  it('falls back to checkin-status when the activity endpoint rejects', async () => {
    const original = globalThis.fetch
    const calls: { method: string, url: string }[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ method: String(init?.method ?? 'GET'), url: String(input) })
      if (String(input).includes('checkin-activity-status')) {
        return jsonResponse({ code: 404 }, 404)
      }
      return jsonResponse({ code: 0, data: { today_checked_in: true } })
    }) as typeof fetch
    afterEach(() => { globalThis.fetch = original })
    const result = await getCheckinStatus('https://copilot.tencent.com', IDENTITY)
    expect(result.ok).toBe(true)
    expect(result.todayCheckedIn).toBe(true)
    expect(calls).toHaveLength(2)
    expect(calls[1]!.url).toContain('/checkin-status')
  })

  it('submits daily-check-in with a POST body', async () => {
    const original = globalThis.fetch
    const calls: Array<{ method: string, url: string, body?: string }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        method: String(init?.method ?? 'GET'),
        url: String(input),
        ...(typeof init?.body === 'string' ? { body: init.body } : {}),
      })
      return jsonResponse({ code: 0, data: { credit: 100 } })
    }) as typeof fetch
    afterEach(() => { globalThis.fetch = original })
    const result = await performCheckin('https://copilot.tencent.com', IDENTITY)
    expect(result.ok).toBe(true)
    expect(calls[0]!.method).toBe('POST')
    expect(calls[0]!.url).toContain('/daily-checkin')
    expect(calls[0]!.body).toBe('{}')
  })
})
