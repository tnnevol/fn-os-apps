import { describe, expect, it } from 'vitest'
import { chmodSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 客户端标识必须**跟着账号走**。
 *
 * 用 CLI 标识发 WorkBuddy 账号的请求，服务端仍会受理（实测三种组合都返回 200），
 * 但会把流量归因到错误的客户端：客户端侧的用量/统计会记错，服务端若按客户端做
 * 策略（限流、灰度、审计）也会对这个账号判错。
 *
 * 版本同理：CLI 与 WorkBuddy 是两条产品线，版本号各不相同且固定（不随会话变化）。
 */
const ADAPTER_SRC = readFileSync(
  new URL('../src/host/adapter.ts', import.meta.url), 'utf8',
)
const SESSION_SRC = readFileSync(
  new URL('../src/host/session.ts', import.meta.url), 'utf8',
)

describe('session 暴露当前账号的客户端身份', () => {
  it('提供 activeClient / activeClientVersion，与 chatBase 同源（都取 activeEntry）', () => {
    expect(SESSION_SRC).toMatch(/activeClient\(\): CodeBuddyClientId \| undefined/)
    expect(SESSION_SRC).toMatch(/activeClientVersion\(\): string \| undefined/)
    // 未登录时返回 undefined，由调用方回退（与 chatBase 的回退策略一致）
    expect(SESSION_SRC).toMatch(/const storage = this\.storage\n\s*if \(storage !== undefined\) return normalizeClientId\(activeEntry\(storage\)\.client\)\n\s*return undefined/)
  })

  it('版本取自客户端字典（不硬编码、不随机）', () => {
    expect(SESSION_SRC).toMatch(/CODEBUDDY_CLIENT_VERSIONS\[client\]/)
  })

  it('按账号取，而不是按插件默认', async () => {
    // 真实往返：两个不同 client 的账号，activeClient 应各自正确
    const dir = mkdtempSync(join(tmpdir(), 'cb-cid-'))
    const file = join(dir, 'codebuddy-auth.json')
    process.env.DSH_CODEBUDDY_AUTH_FILE = file
    const { buildAccountEntry, saveStorage } = await import('../src/host/storage.ts')
    const { CodeBuddySession } = await import('../src/host/session.ts')
    const token = { accessToken: 'a', refreshToken: 'r', expiresIn: 3600, refreshExpiresIn: 7200, domain: 'd' }
    const wb = buildAccountEntry(token as never, { uid: 'u1', nickname: 'WB' } as never, { client: 'workbuddy' })
    const cli = buildAccountEntry(token as never, { uid: 'u2', nickname: 'CLI' } as never, { client: 'cli' })
    await saveStorage({ activeId: wb.id, accounts: [wb, cli] })
    chmodSync(file, 0o600)

    const session = new CodeBuddySession()
    // 真实调用顺序：adapter 先调 authHeaders()（内部会读盘填好内存态），
    // 再取客户端身份。这里照做，否则 activeClient() 尚无数据可读。
    await session.authHeaders()
    expect(session.activeClient()).toBe('workbuddy')
    expect(session.activeClientVersion()).toBe('5.5.4')

    // 切到 CLI 账号后，身份随之变化（switchTo 会 invalidate，需重新读）
    await session.switchTo(cli.id)
    await session.authHeaders()
    expect(session.activeClient()).toBe('cli')
    expect(session.activeClientVersion()).toBe('2.148.0')
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  }, 60_000)
})

describe('adapter 按账号生成请求标识', () => {
  it('clientIdentityHeaders 接收 client 与 version（不再是硬编码 CLI）', () => {
    expect(ADAPTER_SRC).toMatch(/function clientIdentityHeaders\(client: CodeBuddyClientId, version: string \| undefined\)/)
    // 旧的零参硬编码形态已移除
    expect(ADAPTER_SRC).not.toMatch(/function clientIdentityHeaders\(\): Record<string, string> \{\s*return \{\s*'X-IDE-Type': 'CLI'/)
  })

  it('X-IDE-* 三个头都按客户端取值', () => {
    const fn = ADAPTER_SRC.slice(
      ADAPTER_SRC.indexOf('function clientIdentityHeaders'),
      ADAPTER_SRC.indexOf('function clientUserAgent'),
    )
    expect(fn).toMatch(/'X-IDE-Type': platform/)
    expect(fn).toMatch(/'X-IDE-Name': platform/)
    expect(fn).toMatch(/'X-IDE-Version': version \?\? CODEBUDDY_CLIENT_VERSIONS\[client\]/)
    // platform 来自字典（CLI / workbuddy），与登录时声明的一致
    expect(fn).toMatch(/CODEBUDDY_CLIENT_PLATFORMS\[client\]/)
  })

  it('user-agent 的产品名与版本按客户端生成', () => {
    const fn = ADAPTER_SRC.slice(
      ADAPTER_SRC.indexOf('function clientUserAgent'),
      ADAPTER_SRC.indexOf('function clientUserAgent') + 700,
    )
    expect(fn).toMatch(/client === 'workbuddy' \? 'WorkBuddy' : 'CLI'/)
    expect(fn).toMatch(/return `\$\{product\}\/\$\{v\} CodeBuddy\/\$\{v\}`/)
  })

  it('调用点把账号的客户端身份传进去（而非用默认值）', () => {
    expect(ADAPTER_SRC).toMatch(/clientIdentityHeaders\(client, clientVersion\)/)
    expect(ADAPTER_SRC).toMatch(/'user-agent': clientUserAgent\(client, clientVersion\)/)
    // 从 session 取，而不是插件级默认
    expect(ADAPTER_SRC).toMatch(/client = this\.config\.session\.activeClient\(\) \?\? CODEBUDDY_DEFAULT_CLIENT/)
    expect(ADAPTER_SRC).toMatch(/clientVersion = this\.config\.session\.activeClientVersion\(\)/)
  })

  it('未登录时回退到默认客户端（与既有 chatBase 回退同策略）', () => {
    expect(ADAPTER_SRC).toMatch(/let client: CodeBuddyClientId = CODEBUDDY_DEFAULT_CLIENT/)
  })

  it('UA 的安全策略约束仍在注释中留档（含 harness 标识会被 400 拦截）', () => {
    expect(ADAPTER_SRC).toMatch(/deepseek-harness/)
    expect(ADAPTER_SRC).toMatch(/400/)
  })
})

describe('客户端版本的取值', () => {
  it('两个客户端的版本各不相同且固定', async () => {
    const { CODEBUDDY_CLIENT_VERSIONS } = await import('../src/contracts/constants.ts')
    expect(CODEBUDDY_CLIENT_VERSIONS.cli).toBe('2.148.0')
    expect(CODEBUDDY_CLIENT_VERSIONS.workbuddy).toBe('5.5.4')
    expect(CODEBUDDY_CLIENT_VERSIONS.cli).not.toBe(CODEBUDDY_CLIENT_VERSIONS.workbuddy)
  })

  it('platform 取值与登录声明一致（CLI / workbuddy）', async () => {
    const { CODEBUDDY_CLIENT_PLATFORMS } = await import('../src/contracts/constants.ts')
    expect(CODEBUDDY_CLIENT_PLATFORMS.cli).toBe('CLI')
    expect(CODEBUDDY_CLIENT_PLATFORMS.workbuddy).toBe('workbuddy')
  })
})
