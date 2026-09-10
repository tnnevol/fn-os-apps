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
