import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 改名后必须**广播**给其它已挂载的视图。
 *
 * 真实缺陷：`renameLabel` 写了凭据文档，但不像 `switchAccount` / `removeAccount` /
 * 登录那样调用 `notifyModels()`。RPC 的响应只回到发起调用的那个组件——设置页改名
 * 后自己 `setAccounts(响应)` 立即正确，但管理面板是**常驻不卸载**的
 * （`shell.overlay` 常驻，仅 `snapshot.active` 为 false 时 `return null`），它只认
 * `accountEpoch` 变化；而 epoch 只由 host 广播的 `llm/adapters-updated` 推进。
 * 于是设置页改名后面板一直显示旧备注名，直到手动刷新或碰巧发生别的广播。
 *
 * 这里用**真实行为**验证，而不是扫描源码里有没有 `notifyModels` 这个字符串：
 * 构造 AuthService 时注入一个广播观察者，断言它在改名后被调用。
 * 广播机制的底层是 adapter replace → `llm/adapters-updated`，而 harness 的实现
 * 明确保证「replace 与首次注册一样会广播自己」（与 provider 列表是否变化无关），
 * 因此「观察者被调用」等价于「客户端 epoch 会推进」。
 */

function scratch(): void {
  const dir = mkdtempSync(join(tmpdir(), 'cb-rename-'))
  process.env.DSH_CODEBUDDY_AUTH_FILE = join(dir, 'codebuddy-auth.json')
}

/** 最小 ctx：构造 AuthService 会用到 ctx.logger / effect / inject / get。 */
function stubCtx(): unknown {
  const noop = (): void => {}
  return {
    logger: { info: noop, warn: noop, error: noop },
    effect: () => noop,
    inject: () => noop,
    get: () => undefined,
  }
}

/** 造两个账号，返回其 id 与一个能记录广播次数的服务实例。 */
async function setup(): Promise<{
  service: { renameLabel: (id: string, label: string | undefined) => Promise<unknown> }
  ids: string[]
  broadcasts: () => number
  load: () => Promise<{ accounts: Array<{ id: string, account: { label?: string, nickname: string } }> } | undefined>
}> {
  const { buildAccountEntry, saveStorage, loadStorage } = await import('../src/host/storage.ts')
  const { CodeBuddyAuthService } = await import('../src/host/auth-service.ts')
  const { CodeBuddySession } = await import('../src/host/session.ts')

  const token = { accessToken: 'a', refreshToken: 'r', expiresIn: 3600, refreshExpiresIn: 7200, domain: 'd' }
  const a = buildAccountEntry(token as never, { uid: 'u1', nickname: 'A' } as never, {})
  const b = buildAccountEntry(token as never, { uid: 'u2', nickname: 'B' } as never, {})
  await saveStorage({ activeId: a.id, accounts: [a, b] })

  let count = 0
  const service = new CodeBuddyAuthService(
    stubCtx() as never,
    new CodeBuddySession(),
    () => { count += 1 },   // onActiveChanged：等价于客户端 epoch +1
  )
  return {
    service: service as never,
    ids: [a.id, b.id],
    broadcasts: () => count,
    load: () => loadStorage() as never,
  }
}

describe('改名后广播给其它视图', () => {
  it('改名触发一次广播（面板据此重取，不再停留旧备注名）', async () => {
    scratch()
    const { service, ids, broadcasts, load } = await setup()
    const before = broadcasts()
    await service.renameLabel(ids[0]!, '新备注')
    expect(broadcasts()).toBe(before + 1)
    // 同时确认改动确实落盘（广播不是唯一效果）。
    const storage = await load()
    expect(storage!.accounts.find(e => e.id === ids[0])!.account.label).toBe('新备注')
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  })

  it('清除备注名（空串）同样广播', async () => {
    scratch()
    const { service, ids, broadcasts } = await setup()
    await service.renameLabel(ids[0]!, '先设一个')
    const before = broadcasts()
    await service.renameLabel(ids[0]!, '')
    // 清空也是可见变化：卡片会从备注名回落成昵称。
    expect(broadcasts()).toBe(before + 1)
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  })

  it('备注名没变时不广播（不白跑一轮各账号的额度/签到/旅行探测）', async () => {
    scratch()
    const { service, ids, broadcasts } = await setup()
    await service.renameLabel(ids[0]!, '同名')
    const before = broadcasts()
    await service.renameLabel(ids[0]!, '同名')
    expect(broadcasts()).toBe(before)
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  })

  it('对同一个值只设一次也视为无变化（新值与现值相同）', async () => {
    scratch()
    const { service, ids, broadcasts } = await setup()
    // 首轮：从「无 label」变成「A2」→ 有变化、广播。
    const before = broadcasts()
    await service.renameLabel(ids[0]!, 'A2')
    expect(broadcasts()).toBe(before + 1)
    // 次轮：原样再设一次 → 无变化、不广播。
    const mid = broadcasts()
    await service.renameLabel(ids[0]!, 'A2')
    expect(broadcasts()).toBe(mid)
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  })

  it('账号不存在时不广播（没有任何状态变化）', async () => {
    scratch()
    const { service, broadcasts } = await setup()
    const before = broadcasts()
    await service.renameLabel('no-such-id', 'x')
    expect(broadcasts()).toBe(before)
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  })

  it('清除备注名是真实变化（label 建立时被预置成昵称）', async () => {
    scratch()
    const { service, ids, broadcasts, load } = await setup()
    /**
     * 这条纠正了一个想当然的前提：`buildAccountEntry` 在未显式给 label 时会把
     * label **预置成昵称**（`label = nickname`），因此新条目一定带 label，不存在
     * 「本来就没有备注名」的状态。于是「清空」总是 `'A'` → 无 label 的真实变化，
     * 而展示层 `label ?? nickname` 的回落结果仍是 `'A'`——**值看着没变，存储
     * 形态变了**。
     *
     * 因此这里断言「会广播」：按值比较会误判为无变化，但按存储形态它是变化。
     * 这一点值得留下，因为按值比较是本文件最容易想当然写错的地方。
     */
    const before = broadcasts()
    await service.renameLabel(ids[0]!, '')
    expect(broadcasts()).toBe(before + 1)
    // 存储里 label 被删掉，但昵称仍是 A，所以展示结果不变。
    const storage = await load()
    const entry = storage!.accounts.find(e => e.id === ids[0])!
    expect(entry.account.label).toBeUndefined()
    expect(entry.account.nickname).toBe('A')
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  })

  it('清空后再清空 → 第二次无变化、不广播', async () => {
    scratch()
    const { service, ids, broadcasts } = await setup()
    await service.renameLabel(ids[0]!, '')
    const before = broadcasts()
    // 此时 label 已不存在，再清一次没有任何形态变化。
    await service.renameLabel(ids[0]!, '')
    expect(broadcasts()).toBe(before)
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  })
})
