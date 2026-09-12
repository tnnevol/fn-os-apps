import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SerialQueue } from '../src/host/concurrency.ts'

/**
 * 切换路径此前**零单元测试**（339 个用例中无一覆盖 switchTo/switchAccount）。
 * 这里补上锁与 CAS 的行为验证。
 */

function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cb-switch-'))
  process.env.DSH_CODEBUDDY_AUTH_FILE = join(dir, 'codebuddy-auth.json')
  return dir
}

/** 造两个账号的凭据文档。 */
async function seedTwoAccounts(): Promise<void> {
  const { buildAccountEntry, saveStorage } = await import('../src/host/storage.ts')
  const token = { accessToken: 'a', refreshToken: 'r', expiresIn: 3600, refreshExpiresIn: 7200, domain: 'd' }
  const a = buildAccountEntry(token as never, { uid: 'u1', nickname: 'A' } as never, {})
  const b = buildAccountEntry(token as never, { uid: 'u2', nickname: 'B' } as never, {})
  await saveStorage({ activeId: a.id, accounts: [a, b] })
  return undefined as never
}

describe('SerialQueue', () => {
  it('串行执行，不交叉', async () => {
    const q = new SerialQueue()
    const order: string[] = []
    await Promise.all([
      q.runExclusive(async () => { order.push('1:start'); await new Promise(r => setTimeout(r, 20)); order.push('1:end') }),
      q.runExclusive(async () => { order.push('2:start'); order.push('2:end') }),
    ])
    // 若并发执行会得到 1:start,2:start,...；串行则 1 完整结束后 2 才开始。
    expect(order).toEqual(['1:start', '1:end', '2:start', '2:end'])
  })

  it('前一个任务抛错不卡死队列', async () => {
    const q = new SerialQueue()
    await expect(q.runExclusive(async () => { throw new Error('boom') })).rejects.toThrow('boom')
    // 后续任务仍能执行 —— 否则一次失败会永久卡死切换能力。
    await expect(q.runExclusive(async () => 'ok')).resolves.toBe('ok')
  })

  it('pending 反映排队数并归零', async () => {
    const q = new SerialQueue()
    expect(q.pending).toBe(0)
    const all = Promise.all([
      q.runExclusive(async () => { await new Promise(r => setTimeout(r, 10)) }),
      q.runExclusive(async () => {}),
    ])
    expect(q.pending).toBeGreaterThan(0)
    await all
    expect(q.pending).toBe(0)
  })
})

describe('mutateStorage 事务', () => {
  it('并发改名不丢更新（读-改-写被串行化）', async () => {
    scratch()
    await seedTwoAccounts()
    const { mutateStorage, loadStorage } = await import('../src/host/storage.ts')

    // 两个并发事务各改**不同**账号的备注名。若无锁，后写的会整体覆盖前一次。
    const first = loadStorage()
    const ids = (await first)!.accounts.map(e => e.id)
    await Promise.all([
      mutateStorage((cur) => {
        if (cur === undefined) return undefined
        return { ...cur, accounts: cur.accounts.map(e => e.id === ids[0] ? { ...e, account: { ...e.account, label: 'L1' } } : e) }
      }),
      mutateStorage((cur) => {
        if (cur === undefined) return undefined
        return { ...cur, accounts: cur.accounts.map(e => e.id === ids[1] ? { ...e, account: { ...e.account, label: 'L2' } } : e) }
      }),
    ])

    const after = (await loadStorage())!
    const labels = after.accounts.map(e => e.account.label)
    console.log('  并发改名后的备注:', JSON.stringify(labels))
    // 两次改动都必须保留 —— 这正是无锁时会被覆盖的地方。
    expect(labels.filter(Boolean).sort()).toEqual(['L1', 'L2'])
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  }, 60_000)

  it('返回 undefined 表示放弃，不落盘', async () => {
    scratch()
    await seedTwoAccounts()
    const { mutateStorage, loadStorage } = await import('../src/host/storage.ts')
    const before = readFileSync(`${process.env.DSH_CODEBUDDY_AUTH_FILE}`, 'utf8')
    const result = await mutateStorage(() => undefined)
    expect(result).toBeUndefined()
    expect(readFileSync(`${process.env.DSH_CODEBUDDY_AUTH_FILE}`, 'utf8')).toBe(before)
    void loadStorage
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  }, 60_000)
})

describe('switchTo 的 CAS', () => {
  it('expectedActiveId 不匹配时放弃切换，不覆盖别人的改动', async () => {
    scratch()
    await seedTwoAccounts()
    const { CodeBuddySession } = await import('../src/host/session.ts')
    const { loadStorage } = await import('../src/host/storage.ts')
    const session = new CodeBuddySession()
    const ids = (await loadStorage())!.accounts.map(e => e.id)

    // 当前是 ids[0]。B 先切到 ids[1]。
    expect(await session.switchTo(ids[1]!)).toBe(true)
    // A 仍以为当前是 ids[0]，要求切到 ids[1]（其实已是）→ CAS 失败，返回 false。
    const stale = await session.switchTo(ids[1]!, ids[0])
    console.log('  过期 CAS 的返回:', stale)
    expect(stale).toBe(false)
    // 且当前账号仍是 B（没有被改回去）
    expect((await loadStorage())!.activeId).toBe(ids[1])
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  }, 60_000)

  it('expectedActiveId 匹配时正常切换', async () => {
    scratch()
    await seedTwoAccounts()
    const { CodeBuddySession } = await import('../src/host/session.ts')
    const { loadStorage } = await import('../src/host/storage.ts')
    const session = new CodeBuddySession()
    const ids = (await loadStorage())!.accounts.map(e => e.id)
    expect(await session.switchTo(ids[1]!, ids[0])).toBe(true)
    expect((await loadStorage())!.activeId).toBe(ids[1])
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  }, 60_000)

  it('目标账号不存在时返回 false 且不写入', async () => {
    scratch()
    await seedTwoAccounts()
    const { CodeBuddySession } = await import('../src/host/session.ts')
    const { loadStorage } = await import('../src/host/storage.ts')
    const session = new CodeBuddySession()
    const before = (await loadStorage())!.activeId
    expect(await session.switchTo('does-not-exist')).toBe(false)
    expect((await loadStorage())!.activeId).toBe(before)
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  }, 60_000)

  it('已过期账号的文件权限保持 owner-only', async () => {
    scratch()
    await seedTwoAccounts()
    const { CodeBuddySession } = await import('../src/host/session.ts')
    const { loadStorage } = await import('../src/host/storage.ts')
    const session = new CodeBuddySession()
    const ids = (await loadStorage())!.accounts.map(e => e.id)
    await session.switchTo(ids[1]!)
    const { statSync } = await import('node:fs')
    const mode = statSync(process.env.DSH_CODEBUDDY_AUTH_FILE!).mode & 0o777
    console.log('  切换后文件权限:', mode.toString(8))
    expect(mode).toBe(0o600)
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  }, 60_000)
})

describe('并发切换不产生中间态', () => {
  it('两个并发切换只有一个最终生效，且结果是其中之一', async () => {
    scratch()
    await seedTwoAccounts()
    const { CodeBuddySession } = await import('../src/host/session.ts')
    const { loadStorage } = await import('../src/host/storage.ts')
    const session = new CodeBuddySession()
    const ids = (await loadStorage())!.accounts.map(e => e.id)

    await Promise.all([session.switchTo(ids[1]!), session.switchTo(ids[0]!)])
    const final = (await loadStorage())!.activeId
    console.log('  并发切换后 activeId 属于:', final === ids[0] ? 'A' : 'B')
    // 关键：结果必须是某个合法账号，且文档未被写坏。
    expect(ids).toContain(final)
    expect((await loadStorage())!.accounts).toHaveLength(2)
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  }, 60_000)
})

describe('跨模块写入互斥（锁在 storage 层的原因）', () => {
  it('并发「改名 + 切换」两者都保留，不互相覆盖', async () => {
    scratch()
    await seedTwoAccounts()
    const { CodeBuddyAuthService } = await import('../src/host/auth-service.ts')
    const { CodeBuddySession } = await import('../src/host/session.ts')
    const { loadStorage } = await import('../src/host/storage.ts')

    const session = new CodeBuddySession()
    // 最小 ctx：CodeBuddyAuthService 的构造会调 ctx.effect / ctx.inject。
    const noop = (): void => {}
    const ctx = {
      logger: { info: noop, warn: noop, error: noop },
      effect: () => noop,
      inject: () => noop,
      get: () => undefined,
    }
    const service = new CodeBuddyAuthService(ctx as never, session)

    const ids = (await loadStorage())!.accounts.map(e => e.id)
    // 同时：给账号 A 改名 + 把当前切到 B。
    // 若无统一的 storage 级锁，后写的一次会整体覆盖前一次。
    await Promise.all([
      service.renameLabel(ids[0]!, 'RENAMED'),
      session.switchTo(ids[1]!),
    ])

    const after = (await loadStorage())!
    const labels = after.accounts.map(e => e.account.label)
    console.log('  改名结果:', JSON.stringify(labels))
    console.log('  当前账号是否为 B:', after.activeId === ids[1])
    // 两个改动都必须落地
    expect(after.accounts.find(e => e.id === ids[0])!.account.label).toBe('RENAMED')
    expect(after.activeId).toBe(ids[1])
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  }, 60_000)
})
