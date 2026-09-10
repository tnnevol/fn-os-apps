import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  CODEBUDDY_CLIENT_ENDPOINTS,
  CODEBUDDY_CLIENT_IDS,
  CODEBUDDY_CLIENT_LABELS,
  CODEBUDDY_CLIENT_PLATFORMS,
  CODEBUDDY_CLIENT_VERSIONS,
  CODEBUDDY_DEFAULT_CLIENT,
  normalizeClientId,
} from '../src/constants.ts'

/**
 * WorkBuddy 客户端登录。
 *
 * 实测（对官方端点探测）：同一个 `/v2/plugin/auth/state` 端点对
 * `platform=CLI` 与 `platform=workbuddy` 都返回可用的 state 与 authUrl，返回的
 * URL 会带上调用时所用的 platform，`/auth/token` 的待登录码也同为 11217——
 * 即两个客户端共用一套握手协议，只是参数与目标主机不同。
 */
describe('客户端标识字典', () => {
  it('cli 与 workbuddy 都有完整的平台/版本/端点/展示名', () => {
    for (const id of CODEBUDDY_CLIENT_IDS) {
      expect(CODEBUDDY_CLIENT_PLATFORMS[id]).toBeTruthy()
      expect(CODEBUDDY_CLIENT_VERSIONS[id]).toMatch(/^\d+\.\d+\.\d+$/)
      expect(CODEBUDDY_CLIENT_ENDPOINTS[id]).toMatch(/^https:\/\//)
      expect(CODEBUDDY_CLIENT_LABELS[id]).toBeTruthy()
    }
  })

  it('platform 取值与官方约定一致（CLI 大写、workbuddy 小写）', () => {
    // 服务端把该值原样回填进 authUrl，大小写必须与官方客户端一致。
    expect(CODEBUDDY_CLIENT_PLATFORMS.cli).toBe('CLI')
    expect(CODEBUDDY_CLIENT_PLATFORMS.workbuddy).toBe('workbuddy')
  })

  it('版本是固定值，不是随机/会话生成', () => {
    expect(CODEBUDDY_CLIENT_VERSIONS.cli).toBe('2.145.0')
    expect(CODEBUDDY_CLIENT_VERSIONS.workbuddy).toBe('5.5.4')
    // 多次读取必须完全一致（若写成函数或随机值，这里会暴露）。
    expect(CODEBUDDY_CLIENT_VERSIONS.workbuddy).toBe('5.5.4')
  })

  it('workbuddy 走自己的服务地址（不是 CodeBuddy 的）', () => {
    expect(CODEBUDDY_CLIENT_ENDPOINTS.workbuddy).toBe('https://www.workbuddy.cn')
    expect(CODEBUDDY_CLIENT_ENDPOINTS.cli).not.toBe('https://www.workbuddy.cn')
  })

  it('缺省客户端是 cli（历史条目兼容）', () => {
    expect(CODEBUDDY_DEFAULT_CLIENT).toBe('cli')
  })

  it('normalizeClientId 收敛非法输入，不把拼错的值带进端点解析', () => {
    expect(normalizeClientId('workbuddy')).toBe('workbuddy')
    expect(normalizeClientId('WorkBuddy')).toBe('cli') // 大小写敏感，未知即回退
    expect(normalizeClientId(undefined)).toBe('cli')
    expect(normalizeClientId(null)).toBe('cli')
    expect(normalizeClientId('')).toBe('cli')
    expect(normalizeClientId(123)).toBe('cli')
  })
})

describe('账号条目记录客户端', () => {
  it('buildAccountEntry 写入 client 与固定版本', async () => {
    const { buildAccountEntry } = await import('../src/storage.ts')
    const token = { accessToken: 'a', refreshToken: 'r', expiresIn: 3600, refreshExpiresIn: 7200, domain: 'www.workbuddy.cn' }
    const account = { uid: 'u1', nickname: 'n1' }
    const wb = buildAccountEntry(token as never, account as never, { client: 'workbuddy' })
    expect(wb.client).toBe('workbuddy')
    expect(wb.clientVersion).toBe('5.5.4')

    // 不传 client 时按 cli 记录（而不是留空）
    const cli = buildAccountEntry(token as never, account as never, {})
    expect(cli.client).toBe('cli')
    expect(cli.clientVersion).toBe('2.145.0')
  })

  it('resolveEntryEndpoint 让 workbuddy 账号走 workbuddy.cn', async () => {
    const { buildAccountEntry, resolveEntryEndpoint } = await import('../src/storage.ts')
    const token = { accessToken: 'a', refreshToken: 'r', expiresIn: 3600, refreshExpiresIn: 7200, domain: 'www.workbuddy.cn' }
    const account = { uid: 'u1', nickname: 'n1' }
    const wb = buildAccountEntry(token as never, account as never, { client: 'workbuddy', environment: 'internal' })
    // 即使环境是 internal，workbuddy 也必须走自己的地址（否则凭据不被承认）。
    expect(resolveEntryEndpoint(wb)).toBe('https://www.workbuddy.cn')

    const cli = buildAccountEntry(token as never, account as never, { client: 'cli', environment: 'internal' })
    expect(resolveEntryEndpoint(cli)).toBe('https://copilot.tencent.com')
  })

  it('显式 endpoint 优先于客户端默认', async () => {
    const { buildAccountEntry, resolveEntryEndpoint } = await import('../src/storage.ts')
    const token = { accessToken: 'a', refreshToken: 'r', expiresIn: 3600, refreshExpiresIn: 7200, domain: 'd' }
    const entry = buildAccountEntry(token as never, { uid: 'u', nickname: 'n' } as never, {
      client: 'workbuddy',
      endpoint: 'https://custom.example.com/',
    })
    expect(resolveEntryEndpoint(entry)).toBe('https://custom.example.com')
  })
})

describe('添加账号弹框的客户端选择', () => {
  const MODAL = readFileSync(
    '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/components/AddAccountModal.tsx',
    'utf8',
  )

  it('提供客户端选择器，并把版本一并展示（让用户看到固定版本）', () => {
    expect(MODAL).toContain("t('clientLabel')")
    expect(MODAL).toContain('CODEBUDDY_CLIENT_IDS')
    // 选项文案带上版本，例如 "WorkBuddy · v5.5.4"。
    expect(MODAL).toMatch(/CODEBUDDY_CLIENT_VERSIONS\[id\]/)
  })

  it('环境选择器只在 CLI 下出现（WorkBuddy 与环境无关）', () => {
    // 留一个改了没作用的控件会误导用户，因此按客户端条件渲染。
    expect(MODAL).toMatch(/client === 'cli' \? \(\s*<DshForm\.Slot[\s\S]{0,200}environmentLabel/)
  })

  it('提交时只发送对当前客户端有意义的字段', () => {
    // WorkBuddy 不带 environment，否则会被存进账号条目、日后误导排查。
    expect(MODAL).toContain("const cliOnly = client === 'cli'")
    expect(MODAL).toMatch(/\.\.\.cliOnly \? \{ environment \} : \{\}/)
  })

  it('客户端经 normalizeClientId 收敛后再提交', () => {
    expect(MODAL).toMatch(/setClient\(normalizeClientId\(value\)\)/)
  })
})
