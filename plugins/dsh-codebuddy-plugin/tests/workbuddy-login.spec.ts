import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  CODEBUDDY_CLI_VERSION,
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
    // 不写死具体版本号：CLI 版本需跟随上游发布更新（见 CODEBUDDY_CLI_VERSION
    // 的注释），写死会让每次升版都误判为回归。这里锁的是「稳定性 + 形态」，
    // 具体数值另有「与上游一致」的检查。
    const first = CODEBUDDY_CLIENT_VERSIONS.cli
    expect(first).toBe(CODEBUDDY_CLI_VERSION)
    // 多次读取完全一致（若写成随机值或函数，这里会暴露）。
    expect(CODEBUDDY_CLIENT_VERSIONS.cli).toBe(first)
    expect(CODEBUDDY_CLIENT_VERSIONS.workbuddy).toBe('5.5.4')
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
    const wb = buildAccountEntry(token, account, { client: 'workbuddy' })
    expect(wb.client).toBe('workbuddy')
    expect(wb.clientVersion).toBe('5.5.4')

    // 不传 client 时按 cli 记录（而不是留空）
    const cli = buildAccountEntry(token, account, {})
    expect(cli.client).toBe('cli')
    expect(cli.clientVersion).toBe(CODEBUDDY_CLI_VERSION)
  })

  it('resolveEntryEndpoint 让 workbuddy 账号走 workbuddy.cn', async () => {
    const { buildAccountEntry, resolveEntryEndpoint } = await import('../src/storage.ts')
    const token = { accessToken: 'a', refreshToken: 'r', expiresIn: 3600, refreshExpiresIn: 7200, domain: 'www.workbuddy.cn' }
    const account = { uid: 'u1', nickname: 'n1' }
    const wb = buildAccountEntry(token, account, { client: 'workbuddy', environment: 'internal' })
    // 即使环境是 internal，workbuddy 也必须走自己的地址（否则凭据不被承认）。
    expect(resolveEntryEndpoint(wb)).toBe('https://www.workbuddy.cn')

    const cli = buildAccountEntry(token, account, { client: 'cli', environment: 'internal' })
    expect(resolveEntryEndpoint(cli)).toBe('https://copilot.tencent.com')
  })

  it('显式 endpoint 优先于客户端默认', async () => {
    const { buildAccountEntry, resolveEntryEndpoint } = await import('../src/storage.ts')
    const token = { accessToken: 'a', refreshToken: 'r', expiresIn: 3600, refreshExpiresIn: 7200, domain: 'd' }
    const entry = buildAccountEntry(token, { uid: 'u', nickname: 'n' }, {
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

describe('token 解析对字段命名的容忍', () => {
  /**
   * 服务端在不同客户端/网关下可能用 camelCase 或 snake_case 返回同一组字段。
   * 只认一种写法会解析出 `undefined`，进而发出 `Authorization: Bearer undefined`
   * 并收到 401；而失败发生在登录流程内、错误又被吞掉，表现就是「登录完成了但
   * 账号不出现」，极难定位。参考实现（workbuddy-switch 的 oauth 解析）对每个
   * 字段都同时容忍两种写法。
   */
  it('camelCase（CLI 的既有形态）仍能解析', async () => {
    const { normalizeAuthToken } = await import('../src/codebuddy.ts')
    const token = normalizeAuthToken({
      accessToken: 'a', refreshToken: 'r', expiresIn: 3600, refreshExpiresIn: 7200, domain: 'd.example',
    })
    expect(token?.accessToken).toBe('a')
    expect(token?.refreshToken).toBe('r')
    expect(token?.expiresIn).toBe(3600)
    expect(token?.domain).toBe('d.example')
  })

  it('snake_case 也能解析（workbuddy 可能的形态）', async () => {
    const { normalizeAuthToken } = await import('../src/codebuddy.ts')
    const token = normalizeAuthToken({
      access_token: 'a2', refresh_token: 'r2', expires_in: 1800, refresh_expires_in: 3600, domain: 'wb.example',
    })
    expect(token?.accessToken).toBe('a2')
    expect(token?.refreshToken).toBe('r2')
    expect(token?.expiresIn).toBe(1800)
    expect(token?.refreshExpiresIn).toBe(3600)
  })

  it('缺 accessToken 时返回 undefined（不带着残缺对象继续走）', async () => {
    const { normalizeAuthToken } = await import('../src/codebuddy.ts')
    // 否则下一步会发出 `Bearer undefined`，得到 401 而不知原因。
    expect(normalizeAuthToken({ refreshToken: 'r' })).toBeUndefined()
    expect(normalizeAuthToken({ accessToken: '' })).toBeUndefined()
    expect(normalizeAuthToken(undefined)).toBeUndefined()
  })

  it('domain 缺失时归一化为空串（避免 "undefined" 进入 X-Domain）', async () => {
    const { normalizeAuthToken } = await import('../src/codebuddy.ts')
    expect(normalizeAuthToken({ accessToken: 'a' })?.domain).toBe('')
  })

  it('时长缺失不产生 NaN（NaN 比较恒为 false，会让过期判断失效）', async () => {
    const { buildAccountEntry } = await import('../src/storage.ts')
    const entry = buildAccountEntry({ accessToken: 'a', domain: 'd' }, { uid: 'u', nickname: 'n' }, {})
    expect(Number.isFinite(entry.auth.expiresAt)).toBe(true)
    expect(Number.isFinite(entry.auth.refreshExpiresAt)).toBe(true)
    // refreshToken 缺失存空串（真值判断下等价于「没有可刷新凭据」）。
    expect(entry.auth.refreshToken).toBe('')
  })
})

describe('登录失败会反馈给用户', () => {
  it('runLogin 失败原因写入本次握手条目（不是实例字段，避免并发串台）', () => {
    const src = readFileSync(
      '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/auth-service.ts',
      'utf8',
    )
    expect(src).toMatch(/pendingEntry\.failure = error instanceof Error/)
  })

  it('pollLogin 把失败与「仍在等待」区分开', () => {
    const src = readFileSync(
      '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/auth-service.ts',
      'utf8',
    )
    // 返回体带 error 即表示不必再轮询。
    expect(src).toMatch(/pending\.failure === undefined \? \{\} : \{ error: pending\.failure \}/)
  })

  it('客户端轮询遇到 error 立即停止并上报，不等到超时', () => {
    const src = readFileSync(
      '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/components/AddAccountModal.tsx',
      'utf8',
    )
    expect(src).toMatch(/result\.value\.error !== undefined[\s\S]{0,220}onFailed/)
  })
})
