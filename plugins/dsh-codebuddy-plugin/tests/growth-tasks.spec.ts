import { afterEach, describe, expect, it, vi } from 'vitest'
import { acceptGrowthTasks, claimGrowthTask, listGrowthTasks } from '../src/host/growth-tasks.ts'

const identity = {
  accessToken: 'test-token',
  domain: 'copilot.tencent.com',
  uid: 'uid-1',
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => { vi.unstubAllGlobals() })

describe('CodeBuddy growth task upstream API', () => {
  it('parses task list progress and automation metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      code: 0,
      msg: 'OK',
      data: {
        tasks: [
          {
            task_code: 'chat_5',
            title: 'Chat five times',
            progress: { current: 5, target: 5 },
            reward_credit: 100,
            reward_energy: 0,
            accept_status: 'accepted',
          },
          {
            task_code: 'Expert_Philanthropy',
            title: 'Donate',
            current: 0,
            target: 1,
            accept_status: 'accepted',
          },
        ],
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const tasks = await listGrowthTasks(identity)

    expect(tasks).toHaveLength(2)
    expect(tasks[0]).toMatchObject({ taskCode: 'chat_5', current: 5, target: 5, claimable: true, automatable: true })
    expect(tasks[1]).toMatchObject({ taskCode: 'Expert_Philanthropy', automatable: false, automationReason: expect.any(String) })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://copilot.tencent.com/v2/activity/growth/tasks',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('accepts pending codes with the source request shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ code: 0, msg: 'OK', data: {} }))
    vi.stubGlobal('fetch', fetchMock)

    await acceptGrowthTasks(identity, ['chat_5', 'first_buddy'])

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://copilot.tencent.com/v2/activity/growth/tasks/accept')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ task_codes: ['chat_5', 'first_buddy'] }))
  })

  it('claims through the WorkBuddy web endpoint and treats already claimed as success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      code: 0,
      msg: 'OK',
      data: { already_claimed: true, credit: 0, energy: 0 },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await claimGrowthTask(identity, 'chat_5')

    expect(result).toEqual({ alreadyClaimed: true, credit: 0, energy: 0 })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://www.workbuddy.cn/activity/growth/tasks/chat_5/claim')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ 'x-client-platform': 'web' })
  })
})
