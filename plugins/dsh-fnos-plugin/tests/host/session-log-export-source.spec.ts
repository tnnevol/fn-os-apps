import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSessionLogZip } from '../../src/host/authorized-directories.ts'

/**
 * 「导出到 NAS」的上游取数。
 *
 * 这里守的是一条具体的回归：早期实现走 `ctx.get('apiProxy').downloads.sessionLog()`，
 * 但全仓与上游 DSH 都没有任何插件提供 `apiProxy`，取值恒为 `undefined`，于是
 * 每次导出都必然 503。修法是回源请求 DSH 自己注册的 `/api/session.export`。
 *
 * 因此断言三件事：请求确实打到那条 route（而不是某个注入服务），地址是本机
 * loopback（绑定 0.0.0.0 时不能真的往 0.0.0.0 发请求），并且当前浏览器的
 * `dsh-auth-*` Cookie 被转发给 DSH browser-session 认证。
 */

interface FetchCall {
  url: string
  init: RequestInit | undefined
}

function context(host: '127.0.0.1' | '0.0.0.0', port: number): { webServer: { host: string, port: number } } {
  return { webServer: { host, port } }
}

function stubFetch(response: Response): FetchCall[] {
  const calls: FetchCall[] = []
  vi.stubGlobal('fetch', ((url: URL | string, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return Promise.resolve(response)
  }) as typeof fetch)
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('「导出到 NAS」的上游取数', () => {
  it('请求 DSH 自己的 /api/session.export 而不是注入服务', async () => {
    const calls = stubFetch(new Response('zip', { status: 200 }))
    await fetchSessionLogZip(context('127.0.0.1', 3080) as never, 'session-1', new AbortController().signal, 'dsh-auth-test=session-cookie')

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toContain('/api/session.export')
    expect(calls[0]!.url).toContain('sessionId=session-1')
    expect(calls[0]!.url).toContain('includeDescendants=true')
    expect(calls[0]!.init?.headers).toEqual({ cookie: 'dsh-auth-test=session-cookie' })
  })

  it('绑定 0.0.0.0 时回落到 loopback', async () => {
    const calls = stubFetch(new Response('zip', { status: 200 }))
    await fetchSessionLogZip(context('0.0.0.0', 3080) as never, 'session-1', new AbortController().signal, undefined)

    expect(calls[0]!.url).toContain('127.0.0.1:3080')
    expect(calls[0]!.url).not.toContain('0.0.0.0')
  })

  it('用实际监听端口，而不是猜一个固定值', async () => {
    const calls = stubFetch(new Response('zip', { status: 200 }))
    // 端口 0 表示由系统分配，webServer.port 拿到的才是真实值。
    await fetchSessionLogZip(context('127.0.0.1', 51999) as never, 'session-2', new AbortController().signal, undefined)

    expect(calls[0]!.url).toContain('127.0.0.1:51999')
  })

  it('把中止信号透传给上游，客户端断开时一并取消', async () => {
    const calls = stubFetch(new Response('zip', { status: 200 }))
    const controller = new AbortController()
    await fetchSessionLogZip(context('127.0.0.1', 3080) as never, 'session-1', controller.signal, undefined)

    expect(calls[0]!.init?.signal).toBe(controller.signal)
  })

  it('上游非 2xx 时原样返回，由调用方决定对外状态码', async () => {
    stubFetch(new Response('session not found', { status: 404 }))
    const response = await fetchSessionLogZip(context('127.0.0.1', 3080) as never, 'missing', new AbortController().signal, undefined)

    // 不能吞掉 404：会话不存在与导出失败要能区分开。
    expect(response.ok).toBe(false)
    expect(response.status).toBe(404)
  })
})
