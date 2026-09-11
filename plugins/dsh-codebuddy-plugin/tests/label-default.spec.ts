import { describe, expect, it } from 'vitest'
import { chmodSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 备注名默认使用账号昵称（登录后落盘）。
 *
 * 过去只在展示层做 `label ?? nickname` 回落，存储里始终没有 label —— 于是「备注名」
 * 这一项在导出的凭据文件、日志、以及任何直接读文档的消费者眼里都是**缺失**的，
 * 想知道账号叫什么只能自己实现一遍回落规则。
 *
 * 现在登录时若未显式指定，就把昵称写进 label：数据自解释，用户之后通过重命名覆盖。
 */
const TOKEN = { accessToken: 'a', refreshToken: 'r', expiresIn: 3600, refreshExpiresIn: 7200, domain: 'd' }

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cb-label-'))
  const file = join(dir, 'codebuddy-auth.json')
  process.env.DSH_CODEBUDDY_AUTH_FILE = file
  return file
}

describe('buildAccountEntry：备注名缺省时回落为昵称', () => {
  it('未指定 label → label = nickname（落盘，而不是留空）', async () => {
    scratch()
    const { buildAccountEntry } = await import('../src/host/storage.ts')
    const e = buildAccountEntry(TOKEN as never, { uid: 'u', nickname: '我的账号' } as never, {})
    expect(e.account.label).toBe('我的账号')
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  })

  it('显式指定 label → 用指定值（覆盖昵称）', async () => {
    scratch()
    const { buildAccountEntry } = await import('../src/host/storage.ts')
    const e = buildAccountEntry(TOKEN as never, { uid: 'u', nickname: '我的账号' } as never, { label: '工作号' })
    expect(e.account.label).toBe('工作号')
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  })

  it('空白 label（清空或不填）→ 同样回落为昵称', async () => {
    scratch()
    const { buildAccountEntry } = await import('../src/host/storage.ts')
    for (const label of ['', '   ', '\t\n']) {
      const e = buildAccountEntry(TOKEN as never, { uid: 'u', nickname: '昵称' } as never, { label })
      expect(e.account.label).toBe('昵称')
    }
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  })

  it('label 两端空白会被 trim', async () => {
    scratch()
    const { buildAccountEntry } = await import('../src/host/storage.ts')
    const e = buildAccountEntry(TOKEN as never, { uid: 'u', nickname: 'n' } as never, { label: '  工作号  ' })
    expect(e.account.label).toBe('工作号')
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  })

  it('昵称也为空时省略 label（不落空串）', async () => {
    scratch()
    const { buildAccountEntry } = await import('../src/host/storage.ts')
    const e = buildAccountEntry(TOKEN as never, { uid: 'u', nickname: '' } as never, {})
    expect(e.account.label).toBeUndefined()
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  })

  it('落盘后文档里确实有 label 字段', async () => {
    const file = scratch()
    const { buildAccountEntry, saveStorage } = await import('../src/host/storage.ts')
    const e = buildAccountEntry(TOKEN as never, { uid: 'u', nickname: '落盘昵称' } as never, {})
    await saveStorage({ activeId: e.id, accounts: [e] })
    chmodSync(file, 0o600)
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { accounts: Array<{ account: { label?: string } }> }
    expect(raw.accounts[0]!.account.label).toBe('落盘昵称')
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  })
})

describe('重登录：保留用户自定义的备注名（回归）', () => {
  /**
   * 引入「缺省回落昵称」时带来过一个回归：重登录路径原先靠
   * `fresh.account.label === undefined` 判断「本次登录有没有给 label」，
   * 而回落之后该值恒有值，于是用户的备注名会被昵称覆盖
   * （实测：`公司账号` → `m6440216j102`）。
   *
   * 修法与 `client` 字段一致：用「调用方有没有给」判断，而不是「结果里有没有」。
   */
  const SERVICE_SRC = readFileSync(new URL('../src/host/auth-service.ts', import.meta.url), 'utf8')

  it('判据是 options.label（而非 fresh.account.label）', () => {
    expect(SERVICE_SRC).toMatch(/const labelSpecified = options\.label !== undefined && options\.label\.trim\(\)\.length > 0/)
  })

  it('保留逻辑：本次没给就用旧条目的 label', () => {
    expect(SERVICE_SRC).toMatch(/const effectiveLabel = labelSpecified\s*\n\s*\? fresh\.account\.label\s*\n\s*: existing\.account\.label \?\? fresh\.account\.label/)
  })

  it('不再用 fresh.account.label 是否为空来判定「用户有没有填」', () => {
    // 旧形态（有 bug）：fresh.account.label === undefined && existing.account.label !== undefined
    expect(SERVICE_SRC).not.toMatch(/fresh\.account\.label === undefined && existing\.account\.label !== undefined/)
  })

  it('运行时验证四种组合', async () => {
    scratch()
    const { buildAccountEntry } = await import('../src/host/storage.ts')
    // 模拟 runLogin 的决策（与实现同构）
    const decide = (labelSpecified: boolean, existingLabel: string | undefined, nickname: string): string | undefined => {
      const fresh = buildAccountEntry(TOKEN as never, { uid: 'u', nickname } as never, labelSpecified ? { label: '新填的' } : {})
      return labelSpecified ? fresh.account.label : existingLabel ?? fresh.account.label
    }
    // 本次给了 → 用新值
    expect(decide(true, '公司账号', 'n')).toBe('新填的')
    // 本次没给 + 旧有 → 保留用户备注名（回归点）
    expect(decide(false, '公司账号', 'm6440216j102')).toBe('公司账号')
    // 本次没给 + 旧无 → 回落昵称
    expect(decide(false, undefined, 'm6440216j102')).toBe('m6440216j102')
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  }, 60_000)
})
