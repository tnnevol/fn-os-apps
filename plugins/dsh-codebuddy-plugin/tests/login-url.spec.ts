import { describe, expect, it } from 'vitest'
import { requestAuthState } from '../src/codebuddy.ts'
import {
  CODEBUDDY_CLIENT_ENDPOINTS,
  CODEBUDDY_CLIENT_VERSIONS,
} from '../src/constants.ts'

/**
 * 两个客户端共用一套登录握手，但生成的 URL 与版本各不相同。
 *
 * 这是**真实网络请求**（对官方端点），因为 URL 由服务端按 platform 生成，
 * 本地桩无法验证协议是否被接受；只断言形状，不断言具体 state 值。
 */
describe('登录握手 URL（真实请求）', () => {
  it('workbuddy：platform=workbuddy 且 version=5.5.4', async () => {
    const hs = await requestAuthState(CODEBUDDY_CLIENT_ENDPOINTS.workbuddy, 'workbuddy')
    const url = new URL(hs.authUrl)
    expect(url.host).toBe('www.workbuddy.cn')
    expect(url.searchParams.get('platform')).toBe('workbuddy')
    expect(url.searchParams.get('version')).toBe('5.5.4')
    expect(url.searchParams.get('state')).toBe(hs.state)
    expect(hs.state.length).toBeGreaterThan(0)
  }, 60_000)

  it('cli：默认客户端，version 为 CLI 版本（回归保护）', async () => {
    // 不传 client 时必须仍按 CLI 走（签名新增了中间参数，容易漏改调用点）。
    const hs = await requestAuthState(CODEBUDDY_CLIENT_ENDPOINTS.cli)
    const url = new URL(hs.authUrl)
    expect(url.searchParams.get('version')).toBe(CODEBUDDY_CLIENT_VERSIONS.cli)
    expect(hs.state.length).toBeGreaterThan(0)
  }, 60_000)

  it('两个客户端的登录地址不同（避免共用端点导致凭据错配）', async () => {
    const wb = new URL((await requestAuthState(CODEBUDDY_CLIENT_ENDPOINTS.workbuddy, 'workbuddy')).authUrl)
    const cli = new URL((await requestAuthState(CODEBUDDY_CLIENT_ENDPOINTS.cli, 'cli')).authUrl)
    expect(wb.host).not.toBe(cli.host)
    expect(wb.searchParams.get('platform')).not.toBe(cli.searchParams.get('platform'))
  }, 90_000)
})
