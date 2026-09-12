import { afterEach, describe, expect, it } from 'vitest'
import { chmodSync, mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  activeEntry,
  clearStorage,
  getStoragePath,
  loadStorage,
  resolveEntryEndpoint,
  saveStorage,
} from '../src/host/storage.ts'
import { CODEBUDDY_ENDPOINT, CODEBUDDY_ENDPOINT_EXTERNAL } from '../src/contracts/constants.ts'
import type { CodeBuddyAccountEntry, CodeBuddyStorage } from '../src/host/storage.ts'

let workdir: string | undefined

function useTempAuthFile(): string {
  workdir = mkdtempSync(join(tmpdir(), 'codebuddy-storage-'))
  const path = join(workdir, 'codebuddy-auth.json')
  process.env.DSH_CODEBUDDY_AUTH_FILE = path
  return path
}

afterEach(() => {
  delete process.env.DSH_CODEBUDDY_AUTH_FILE
  if (workdir !== undefined) {
    rmSync(workdir, { recursive: true, force: true })
    workdir = undefined
  }
})

function entry(id: string, uid: string, nickname = uid): CodeBuddyAccountEntry {
  return {
    id,
    auth: {
      accessToken: `token-${id}`,
      expiresAt: Date.now() + 3600_000,
      refreshToken: `refresh-${id}`,
      refreshExpiresAt: Date.now() + 86_400_000,
      domain: 'example.com',
    },
    account: { uid, nickname },
  }
}

/** Write raw JSON as an owner-only file, matching what saveStorage produces. */
function writeOwnerOnly(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value), { encoding: 'utf-8', mode: 0o600 })
  chmodSync(path, 0o600)
}

describe('CodeBuddy multi-account storage', () => {
  it('reads back a saved multi-account document and resolves the active entry', async () => {
    useTempAuthFile()
    const a = entry('a', 'uid-a', '账号A')
    const b = entry('b', 'uid-b', '账号B')
    await saveStorage({ activeId: 'b', accounts: [a, b] })
    const loaded = await loadStorage()
    expect(loaded).toBeDefined()
    expect(loaded?.accounts).toHaveLength(2)
    expect(activeEntry(loaded!)!.account.uid).toBe('uid-b')
  })

  it('migrates the legacy single-account shape with that account active', async () => {
    const path = useTempAuthFile()
    writeOwnerOnly(path, {
      auth: {
        accessToken: 'legacy-token',
        expiresAt: Date.now() + 3600_000,
        refreshToken: 'legacy-refresh',
        refreshExpiresAt: Date.now() + 86_400_000,
        domain: 'example.com',
      },
      account: { uid: 'legacy-uid', nickname: '旧账号' },
    })
    const loaded = await loadStorage()
    expect(loaded).toBeDefined()
    expect(loaded?.accounts).toHaveLength(1)
    expect(activeEntry(loaded!)!.account.uid).toBe('legacy-uid')
    expect(activeEntry(loaded!)!.auth.accessToken).toBe('legacy-token')
  })

  it('falls back to the first entry when activeId does not match', async () => {
    useTempAuthFile()
    await saveStorage({ activeId: 'missing', accounts: [entry('a', 'uid-a'), entry('b', 'uid-b')] })
    const loaded = await loadStorage()
    expect(activeEntry(loaded!)!.id).toBe('a')
  })

  it('drops malformed entries and reads as signed out when none remain', async () => {
    const path = useTempAuthFile()
    writeOwnerOnly(path, {
      activeId: 'x',
      accounts: [{ id: 'x' }, null],
    })
    expect(await loadStorage()).toBeUndefined()
    expect(existsSync(path)).toBe(true)
  })

  it('reads an absent file as signed out', async () => {
    useTempAuthFile()
    expect(await loadStorage()).toBeUndefined()
    await clearStorage()
    expect(await loadStorage()).toBeUndefined()
  })

  it('normalizes empty-string account fields on load', async () => {
    const path = useTempAuthFile()
    const a = entry('a', 'uid-a')
    ;(a.account as Record<string, unknown>).uin = ''
    await saveStorage({ activeId: 'a', accounts: [a] })
    // Round-trip through the raw file: saved then loaded back.
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as CodeBuddyStorage
    expect((raw.accounts[0]!.account as Record<string, unknown>).uin).toBe('')
    const loaded = await loadStorage()
    expect(loaded?.accounts[0]?.account.uin).toBeUndefined()
  })

  it('keeps getStoragePath tracking the override', () => {
    const path = useTempAuthFile()
    expect(getStoragePath()).toBe(path)
  })

  it('persists and normalizes the optional local label', async () => {
    useTempAuthFile()
    const a = entry('a', 'uid-a', '账号A')
    a.account.label = '  工作账号  '
    await saveStorage({ activeId: 'a', accounts: [a] })
    const loaded = await loadStorage()
    expect(loaded?.accounts[0]?.account.label).toBe('工作账号')
  })

  it('omits the label when absent or blank', async () => {
    useTempAuthFile()
    await saveStorage({ activeId: 'a', accounts: [entry('a', 'uid-a', '账号A')] })
    const loaded = await loadStorage()
    expect(loaded?.accounts[0]?.account.label).toBeUndefined()
  })

  it('resolves the endpoint from the entry environment', () => {
    expect(resolveEntryEndpoint({ ...entry('a', 'u'), environment: 'external' })).toBe(CODEBUDDY_ENDPOINT_EXTERNAL)
    expect(resolveEntryEndpoint({ ...entry('a', 'u'), environment: 'internal' })).toBe('https://copilot.tencent.com')
    expect(resolveEntryEndpoint({ ...entry('a', 'u'), environment: 'ioa' })).toBe('https://copilot.tencent.com')
  })

  it('prefers an explicit entry endpoint over the environment default', () => {
    const item = { ...entry('a', 'u'), environment: 'internal', endpoint: 'https://corp.example.com///' }
    expect(resolveEntryEndpoint(item)).toBe('https://corp.example.com')
  })

  it('falls back to the legacy endpoint when the entry predates environments', () => {
    expect(resolveEntryEndpoint(entry('a', 'u'))).toBe(CODEBUDDY_ENDPOINT)
    expect(resolveEntryEndpoint({ ...entry('a', 'u'), environment: 'cloudhosted' })).toBe(CODEBUDDY_ENDPOINT)
  })

  it('lower-cases a hand-edited environment value on load', async () => {
    useTempAuthFile()
    const a = { ...entry('a', 'u'), environment: 'EXTERNAL' }
    await saveStorage({ activeId: 'a', accounts: [a] })
    const loaded = await loadStorage()
    expect(loaded?.accounts[0]?.environment).toBe('external')
    expect(resolveEntryEndpoint(activeEntry(loaded!))).toBe(CODEBUDDY_ENDPOINT_EXTERNAL)
  })
})

describe('normalizeEntry 必须保留客户端身份字段', () => {
  /**
   * 守一个真实缺陷：`normalizeEntry` 是**逐字段白名单重建**，而 `loadStorage`
   * 对每个条目都调用它。曾经漏掉 `client` / `clientVersion`，于是每次读盘都把
   * WorkBuddy 账号降级成 CLI：`resolveEntryEndpoint` 回落到 copilot.tencent.com，
   * 而凭据签发于 www.workbuddy.cn → 服务端不认、账号表现为掉线。
   *
   * 更严重的是 loadStorage 的结果会被切换/改名/删除/刷新等写路径回写磁盘，
   * 所以是**持久化擦除**而非内存态问题。这条用例用「写→读」往返锁住该字段。
   */
  it('client / clientVersion 经 saveStorage → loadStorage 往返后不丢', async () => {
    const { chmodSync, mkdtempSync, readFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = mkdtempSync(join(tmpdir(), 'cb-roundtrip-'))
    const file = join(dir, 'codebuddy-auth.json')
    process.env.DSH_CODEBUDDY_AUTH_FILE = file

    const { buildAccountEntry, loadStorage, resolveEntryEndpoint, saveStorage } = await import('../src/host/storage.ts')
    const token = { accessToken: 'a', refreshToken: 'r', expiresIn: 3600, refreshExpiresIn: 7200, domain: 'www.workbuddy.cn' }
    const account = { uid: 'u1', nickname: 'n1' }

    const wb = buildAccountEntry(token as never, account as never, { client: 'workbuddy' })
    const cli = buildAccountEntry(token as never, { uid: 'u2', nickname: 'n2' } as never, { client: 'cli' })
    await saveStorage({ activeId: wb.id, accounts: [wb, cli] })

    // 磁盘原文本来就有（写路径正确）
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { accounts: Array<{ client?: string }> }
    expect(raw.accounts[0]!.client).toBe('workbuddy')

    // 关键：读盘后仍在（曾经在这里被抹掉）
    const loaded = (await loadStorage())!
    const loadedWb = loaded.accounts.find(e => e.account.uid === 'u1')!
    const loadedCli = loaded.accounts.find(e => e.account.uid === 'u2')!
    expect(loadedWb.client).toBe('workbuddy')
    expect(loadedWb.clientVersion).toBe('5.5.6')
    expect(loadedCli.client).toBe('cli')

    // 且端点解析正确 —— 这是该字段的实际用途
    expect(resolveEntryEndpoint(loadedWb)).toBe('https://www.workbuddy.cn')
    expect(resolveEntryEndpoint(loadedCli)).not.toBe('https://www.workbuddy.cn')

    delete process.env.DSH_CODEBUDDY_AUTH_FILE
    void chmodSync
  }, 60_000)

  it('缺失 client 的历史条目归一化为 cli（向后兼容）', async () => {
    const { chmodSync, mkdtempSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = mkdtempSync(join(tmpdir(), 'cb-legacy-'))
    const file = join(dir, 'codebuddy-auth.json')
    process.env.DSH_CODEBUDDY_AUTH_FILE = file
    // 模拟「建 client 字段之前」写入的条目。
    writeFileSync(file, JSON.stringify({
      activeId: 'old',
      accounts: [{
        id: 'old',
        auth: { accessToken: 'a', expiresAt: Date.now() + 3_600_000, refreshToken: 'r', refreshExpiresAt: Date.now() + 7_200_000, domain: 'd' },
        account: { uid: 'u', nickname: 'n' },
      }],
    }))
    // loadStorage 会拒绝非 owner-only 的文件（isOwnerOnly），因此必须设 0o600，
    // 否则返回 undefined —— 那是权限校验，不是格式问题。
    chmodSync(file, 0o600)
    const { loadStorage } = await import('../src/host/storage.ts')
    const loaded = (await loadStorage())!
    // 老条目没有该字段 → 按 CLI 处理，且补上固定版本号。
    expect(loaded.accounts[0]!.client).toBe('cli')
    expect(loaded.accounts[0]!.clientVersion).toBe('2.148.0')
    delete process.env.DSH_CODEBUDDY_AUTH_FILE
  }, 60_000)
})

describe('重新登录不应改变账号的客户端身份', () => {
  /**
   * 守一个真实缺陷：设置页的「重新登录」不带 `client`，而 `buildAccountEntry`
   * 对未指定的 client 会按 `cli` 落值，于是 host 侧「以本次登录为准」的覆盖逻辑
   * 会把 WorkBuddy 账号静默降级成 CLI —— 之后请求发往 copilot.tencent.com，
   * 而凭据签发于 www.workbuddy.cn。
   *
   * 修法是区分「显式指定」与「未指定」：未指定时保留既有值。
   * 这里用源码断言锁住该分支（host 侧完整登录流程需要真实 OAuth，无法单测）。
   */
  it('host 侧按「是否显式指定」分支，而不是看 fresh.client 是否为空', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(
      '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/host/auth-service.ts',
      'utf8',
    )
    // 必须基于 options.client 判断（fresh.client 恒有值，看它永远为真）。
    expect(src).toContain('const clientSpecified = options.client !== undefined')
    expect(src).toMatch(/clientSpecified\s*\n?\s*\? \{/)
    // 未指定时要保留既有 client，而不是删掉或写成 cli。
    expect(src).toMatch(/existing\.client === undefined \? \{\} : \{ client: existing\.client \}/)
  })
})

/**
 * `nextActiveId` 决定一次登录之后谁是当前账号。
 *
 * 这条规则此前**零覆盖**，而「添加账号不抢占当前账号」的正确性全压在它身上：
 * `activate` 传错或规则写反，用户只是多存一个备用账号，正在用的账号却会被
 * 静默换掉，后续所有请求改走新账号。因此这里逐情形钉住。
 */
describe('nextActiveId：登录后谁是当前账号', () => {
  async function load() {
    const { nextActiveId } = await import('../src/host/storage.ts')
    return nextActiveId
  }

  it('首账号：无论 activate 与否都必须成为当前账号', async () => {
    // 否则会留下「有账号却没有当前账号」的空悬状态。
    const nextActiveId = await load()
    expect(nextActiveId(undefined, 'new', false)).toBe('new')
    expect(nextActiveId(undefined, 'new', true)).toBe('new')
  })

  it('新增账号 + activate=false：保持原当前账号（本次需求）', async () => {
    const nextActiveId = await load()
    expect(nextActiveId('old', 'new', false)).toBe('old')
  })

  it('新增账号 + activate=true：切换过去', async () => {
    const nextActiveId = await load()
    expect(nextActiveId('old', 'new', true)).toBe('new')
  })

  it('重复登录当前账号：即使 activate=false 也不能把自己挤下去', async () => {
    // wasActive 兜底：刷新当前账号的凭据仍属于当前账号。
    const nextActiveId = await load()
    expect(nextActiveId('me', 'me', false, true)).toBe('me')
  })

  it('重复登录非当前账号 + activate=false：保持原当前账号', async () => {
    const nextActiveId = await load()
    expect(nextActiveId('current', 'other', false, false)).toBe('current')
  })

  it('重复登录非当前账号 + activate=true：切换过去', async () => {
    const nextActiveId = await load()
    expect(nextActiveId('current', 'other', true, false)).toBe('other')
  })

  it('wasActive 默认 false', async () => {
    const nextActiveId = await load()
    expect(nextActiveId('current', 'other', false)).toBe('current')
  })

  it('current 与 freshId 相同时，wasActive 不影响结果', async () => {
    // 这条记录一个**等价性**事实，而不是在测行为差异：当两者相同，两个分支
    // 返回同一个值，因此 wasActive 在该情形下是冗余的。
    //
    // 之所以冗余却仍保留：它让规则自我表达「重复登录当前账号不能把自己挤下去」
    // 这一意图，且属于防御性写法。它成立的前提是调用点满足
    // `replaced.id === existing.id`（见下一条不变量），一旦该前提被破坏，
    // wasActive 就不再冗余——那时这条等价性断言与下一条会一起失效并提醒。
    const nextActiveId = await load()
    expect(nextActiveId('same', 'same', false, true)).toBe(nextActiveId('same', 'same', false, false))
  })

  it('调用点不变量：被复用的条目沿用原 id（wasActive 冗余的前提）', () => {
    const src = readFileSync(new URL('../src/host/auth-service.ts', import.meta.url), 'utf8')
    // 复用分支必须保留 existing.id，并据此算 wasActive。若有人改成新 id，
    // `activate || wasActive` 的保护语义就变了，需要重新审视。
    const start = src.indexOf('const wasActive =')
    expect(start).toBeGreaterThan(-1)
    const block = src.slice(src.indexOf('const existing = stored?.accounts.find'), start)
    expect(block).toMatch(/id: existing\.id/)
    expect(src.slice(start, start + 200)).toMatch(/stored\.activeId === existing\.id/)
  })
})
