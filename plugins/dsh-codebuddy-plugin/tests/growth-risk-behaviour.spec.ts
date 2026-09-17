import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountLocks } from '../src/host/concurrency.ts'
import { accountRiskHeaders, stableDeviceId } from '../src/host/risk-headers.ts'
import { runGrowthTaskAction } from '../src/host/growth-actions.ts'
import { disableGrowthThrottleForTests } from '../src/host/risk-headers.ts'

/**
 * 风控头与账号锁的**行为**用例（与 growth-risk-control.spec.ts 的源码断言互补）。
 *
 * 源码断言能挡住「删掉了某行」，但挡不住「写错了值」；这里直接跑实现、看真实
 * 出站请求与锁行为。
 */

const identity = {
  accessToken: 'test-token',
  domain: 'copilot.tencent.com',
  uid: 'uid-1',
}

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

// 节流置 0：这些用例的对象是「发了什么请求、带了什么头」，而不是等待时长；
// 生产默认值由 growth-risk-control.spec.ts 直接断言。
beforeEach(() => { disableGrowthThrottleForTests() })

afterEach(() => { vi.unstubAllGlobals() })

describe('稳定设备标识', () => {
  it('同一账号同一用途恒同值（跨调用/跨重启恒定）', () => {
    expect(stableDeviceId(identity, 'machine')).toBe(stableDeviceId(identity, 'machine'))
    expect(stableDeviceId({ uid: 'uid-1' }, 'machine')).toBe(stableDeviceId({ uid: 'uid-1' }, 'machine'))
  })

  it('账号之间互异，用途之间也互异', () => {
    expect(stableDeviceId(identity, 'machine')).not.toBe(stableDeviceId({ uid: 'uid-2' }, 'machine'))
    // machine 与 session 必须是两个不同的值（同值会让两个头族失去意义）。
    expect(stableDeviceId(identity, 'machine')).not.toBe(stableDeviceId(identity, 'session'))
  })

  it('形状为 36 位 hex', () => {
    expect(stableDeviceId(identity, 'machine')).toMatch(/^[0-9a-f]{36}$/)
  })
})

describe('账号级头集合', () => {
  it('包含风控闸门头与稳定的设备/会话头', () => {
    const headers = accountRiskHeaders(identity)
    expect(headers['X-CodeBuddy-Request']).toBe('1')
    expect(headers['X-Machine-ID']).toBe(stableDeviceId(identity, 'machine'))
    expect(headers['X-Session-ID']).toBe(stableDeviceId(identity, 'session'))
  })

  it('企业账号额外带租户双头，个人账号不带', () => {
    const enterprise = accountRiskHeaders({ uid: 'u', enterpriseId: 'ent-1' })
    expect(enterprise['X-Enterprise-Id']).toBe('ent-1')
    expect(enterprise['X-Tenant-Id']).toBe('ent-1')
    const personal = accountRiskHeaders({ uid: 'u' })
    expect(personal['X-Enterprise-Id']).toBeUndefined()
    expect(personal['X-Tenant-Id']).toBeUndefined()
  })
})

describe('行为上报的真实出站请求', () => {
  it('chat_5 逐条上报，每条都带账号级风控头', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => response({ code: 0, msg: 'OK', data: {} }))
    vi.stubGlobal('fetch', fetchMock)

    // current=4 / target=5 → 只补 1 条，避免测试里等待 1.05s 的间隔。
    const result = await runGrowthTaskAction(identity, 'chat_5', 4, 5)

    expect(result.supported).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://www.codebuddy.cn/v2/report')
    const headers = init.headers as Record<string, string>
    expect(headers['X-CodeBuddy-Request']).toBe('1')
    expect(headers['X-Machine-ID']).toBe(stableDeviceId(identity, 'machine'))
    expect(headers['X-Session-ID']).toBe(stableDeviceId(identity, 'session'))
    // 事件必须带 userId（缺失时上游 200 但静默丢弃）。
    expect(JSON.parse(String(init.body))).toEqual([expect.objectContaining({
      eventCode: 'chat_request_send',
      userId: 'uid-1',
    })])
  }, 10_000)

  it('桌面链上报到 copilot 域并带桌面指纹与完整字段集', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => response({ code: 0, msg: 'OK', data: {} }))
    vi.stubGlobal('fetch', fetchMock)

    await runGrowthTaskAction(identity, 'automation_1', 0, 1)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://copilot.tencent.com/v2/report')
    const headers = init.headers as Record<string, string>
    expect(headers['User-Agent']).toBe('WorkBuddy/5.5.6 WorkBuddy/5.5.6 CLI/2.137.1')
    expect(headers['X-Product']).toBe('SaaS')
    const events = JSON.parse(String(init.body)) as Array<Record<string, unknown>>
    expect(events[0]).toMatchObject({
      eventCode: 'automated_task_create_suc',
      extName: 'workbuddy-desktop',
      os: 'win32',
      userId: 'uid-1',
    })
  })

  it('template_5 发五组独立上报，每组都带模板判据事件', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => response({ code: 0, msg: 'OK', data: {} }))
    vi.stubGlobal('fetch', fetchMock)

    await runGrowthTaskAction(identity, 'template_5', 0, 5)

    // 五组各自一次上报：一次性打成一大包不会被数成 5/5。
    expect(fetchMock).toHaveBeenCalledTimes(5)
    const codes = new Set<string>()
    for (const [, init] of fetchMock.mock.calls as Array<[string, RequestInit]>) {
      const events = JSON.parse(String(init.body)) as Array<Record<string, unknown>>
      expect(events.some(event => event.eventCode === 'agent_task_created_with_template')).toBe(true)
      expect(events.some(event => event.eventCode === 'template_used')).toBe(true)
      const created = events.find(event => event.eventCode === 'agent_task_created_with_template')
      codes.add(String(created?.id))
    }
    expect(codes.size).toBe(5)
  }, 15_000)

  it('Library_read 走 web 域并按页面元素上报', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => response({ code: 0, msg: 'OK', data: {} }))
    vi.stubGlobal('fetch', fetchMock)

    await runGrowthTaskAction(identity, 'Library_read', 0, 1)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://www.workbuddy.cn/v2/report')
    const headers = init.headers as Record<string, string>
    expect(headers['x-client-platform']).toBe('web')
    expect(headers['User-Agent']).toContain('Mozilla/5.0')
    const events = JSON.parse(String(init.body)) as Array<Record<string, unknown>>
    expect(events[0]).toMatchObject({
      eventCode: 'web_element_click',
      elementId: 'library_doc_intro_click',
      userId: 'uid-1',
    })
  })

  it('未移植动作不发任何请求', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await runGrowthTaskAction(identity, 'Expert_Philanthropy', 0, 1)

    expect(result.supported).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('专家链的真实 requestId 判据', () => {
  it('SSE 里没有服务端 id 时抛错，而不是自造一个', async () => {
    const fetchMock = vi.fn()
      // 1) 专家市场列表：返回一个真实条目。
      .mockResolvedValueOnce(response({ code: 0, msg: 'OK', data: { experts: [{ expert_id: 'ex-1', expert_type: 'agent', display_name_zh: '专家甲', profession_zh: '测试', version: '1.0.0', categories: ['expert-all'] }] } }))
      // 2) 召唤链上报：成功。
      .mockResolvedValueOnce(response({ code: 0, msg: 'OK', data: {} }))
      // 3) 真实对话：SSE 里不带合规的服务端 id。
      .mockResolvedValueOnce(new Response('data: {"id":"not-a-server-id","choices":[]}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    // 拿不到真实 id 必须计入失败（这里只有一个专家，因此整批抛错）。
    await expect(runGrowthTaskAction(identity, 'Expert_lighthouse', 0, 1)).rejects.toThrow(/server request id/)
  }, 15_000)

  it('有真实 requestId 时用它 JOIN 使用事件', async () => {
    const serverId = 'a'.repeat(32)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ code: 0, msg: 'OK', data: { experts: [{ expert_id: 'ex-2cvvUZQhDyeJ', expert_type: 'agent', display_name_zh: '腾讯轻量云专家', profession_zh: '腾讯轻量云专家', version: '1.0.2', categories: ['expert-all'] }] } }))
      .mockResolvedValueOnce(response({ code: 0, msg: 'OK', data: {} }))
      .mockResolvedValueOnce(new Response(`data: {"id":"cmb-${serverId}"}\n\n`, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }))
      .mockResolvedValueOnce(response({ code: 0, msg: 'OK', data: {} }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await runGrowthTaskAction(identity, 'Expert_lighthouse', 0, 1)
    expect(result.supported).toBe(true)

    // 最后一次上报必须带真实 requestId，且是 LOCAL 判据形态。
    const [, init] = fetchMock.mock.calls[3] as [string, RequestInit]
    const events = JSON.parse(String(init.body)) as Array<Record<string, unknown>>
    const use = events.find(event => event.eventCode === 'expert_actual_use')
    expect(use).toMatchObject({ requestId: `cmb-${serverId}`, mode: 'LOCAL', type: '', cost: 0 })
    // 对话链里**携带追踪 id 的**每条事件都必须 JOIN 同一个服务端 id
    // （`agent_task_created` 按真实样本只有 conversationId/messageId，不带追踪 id）。
    const tracked = events.filter(event => typeof event.rootRequestId === 'string')
    expect(tracked.length).toBeGreaterThan(3)
    for (const event of tracked) {
      expect(event.rootRequestId).toBe(`cmb-${serverId}`)
    }
  }, 15_000)
})

describe('账号级互斥锁', () => {
  it('同账号第二次获取失败（这是「同账号串行」的依据）', () => {
    const locks = new AccountLocks('test')
    const first = locks.tryAcquire('acct-1')
    expect(first).toBeDefined()
    expect(locks.tryAcquire('acct-1')).toBeUndefined()
    first?.release()
    // 释放后可以重新获取。
    expect(locks.tryAcquire('acct-1')).toBeDefined()
  })

  it('不同账号可以同时持有（这是「其他账号不禁用」能真实生效的前提）', () => {
    const locks = new AccountLocks('test')
    const a = locks.tryAcquire('acct-1')
    const b = locks.tryAcquire('acct-2')
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    // 两个账号同时都在跑。
    expect(locks.ids().sort()).toEqual(['acct-1', 'acct-2'])
    expect(locks.running).toBe(true)
    // 释放其中一个不影响另一个。
    a?.release()
    expect(locks.has('acct-1')).toBe(false)
    expect(locks.has('acct-2')).toBe(true)
    b?.release()
    expect(locks.running).toBe(false)
  })

  it('重复释放是幂等的，且不误清后续占用者', () => {
    const locks = new AccountLocks('test')
    const first = locks.tryAcquire('acct-1')
    first?.release()
    const second = locks.tryAcquire('acct-1')
    // 旧句柄再释放一次，不得把第二个占用者的锁清掉。
    first?.release()
    expect(locks.has('acct-1')).toBe(true)
    second?.release()
    expect(locks.has('acct-1')).toBe(false)
  })
})
