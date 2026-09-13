import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PNPM_STORE_FILE, buildDshRuntimeEnv, readPersistedPnpmStoreDir } from '../src/config/dsh-runtime-env.ts'

describe('DSH runtime environment', () => {
  const directories: string[] = []

  afterEach(async () => {
    while (directories.length > 0) await rm(directories.pop() as string, { recursive: true, force: true })
  })

  async function homeWithStore(content?: string): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), 'fnos-dsh-runtime-env-'))
    directories.push(directory)
    if (content !== undefined) await writeFile(join(directory, PNPM_STORE_FILE), content)
    return directory
  }

  it('forwards the store recorded at install time so pnpm does not see a different location', async () => {
    // pnpm pins the store into node_modules/.modules.yaml and then fails every
    // install with ERR_PNPM_UNEXPECTED_STORE once the resolved store changes.
    // Dropping this variable when Web startup moved off the CLI wrapper is what
    // broke `dsh plugin` and third-party market updates.
    const home = await homeWithStore('/vol1/@appshare/fn-deepseek-harness/.local/share/pnpm/store\n')
    const environment = buildDshRuntimeEnv(home, { PATH: '/usr/bin' })
    expect(environment.PNPM_CONFIG_STORE_DIR).toBe('/vol1/@appshare/fn-deepseek-harness/.local/share/pnpm/store')
    expect(environment.HOME).toBe(home)
    expect(environment.DSH_HOME).toBe(home)
    expect(environment.NPM_CONFIG_PREFIX).toBe(`${home}/.npm-global`)
    expect(environment.PATH).toBe('/usr/bin')
  })

  it('clears an inherited store override when no store was recorded', async () => {
    const home = await homeWithStore()
    const environment = buildDshRuntimeEnv(home, { PNPM_CONFIG_STORE_DIR: '/stale/store' })
    expect(environment.PNPM_CONFIG_STORE_DIR).toBeUndefined()
  })

  it('ignores an empty or relative recorded value instead of guessing', async () => {
    expect(await homeWithStore('\n').then(home => readPersistedPnpmStoreDir(home))).toBeUndefined()
    expect(await homeWithStore('relative/store\n').then(home => readPersistedPnpmStoreDir(home))).toBeUndefined()
    expect(readPersistedPnpmStoreDir('/nonexistent-dsh-home')).toBeUndefined()
  })

  it('uses only the first line so a trailing record cannot leak into the store path', async () => {
    const home = await homeWithStore('/vol1/@appshare/store\n/vol1/other/store\n')
    expect(readPersistedPnpmStoreDir(home)).toBe('/vol1/@appshare/store')
  })
})
