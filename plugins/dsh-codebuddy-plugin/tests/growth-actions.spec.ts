import { afterEach, describe, expect, it, vi } from 'vitest'
import { runGrowthTaskAction } from '../src/host/growth-actions.ts'

const identity = {
  accessToken: 'test-token',
  domain: 'copilot.tencent.com',
  uid: 'uid-1',
}

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => { vi.unstubAllGlobals() })

describe('growth task actions', () => {
  it('reports the remaining chat_5 activity count with the full event shape', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => response({ code: 0, msg: 'OK', data: {} }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await runGrowthTaskAction(identity, 'chat_5', 2, 5)

    expect(result).toEqual({ supported: true, message: 'reported 3 chat activity event(s)' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://www.codebuddy.cn/v2/report')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual([expect.objectContaining({
      eventCode: 'chat_request_send',
      userId: 'uid-1',
      requestModelId: 'deepseek-v4-flash',
    })])
  }, 10_000)

  it('reports desktop automation events with a stable WorkBuddy fingerprint', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => response({ code: 0, msg: 'OK', data: {} }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await runGrowthTaskAction(identity, 'automation_1', 0, 1)

    expect(result.supported).toBe(true)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://copilot.tencent.com/v2/report')
    expect(init.headers).toMatchObject({ 'User-Agent': 'WorkBuddy/5.5.6 WorkBuddy/5.5.6 CLI/2.137.1' })
    expect(JSON.parse(String(init.body))).toEqual([expect.objectContaining({
      eventCode: 'automated_task_create_suc',
      ideName: 'WorkBuddy',
      extName: 'workbuddy-desktop',
      userId: 'uid-1',
    })])
  })

  it('does not execute unknown actions', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await runGrowthTaskAction(identity, 'Expert_Philanthropy', 0, 1)

    expect(result.supported).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
