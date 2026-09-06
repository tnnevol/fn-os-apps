import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  askPlugin: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  spawnSync: vi.fn(),
  readPackageInfo: vi.fn(),
  versionBump: vi.fn(),
}))

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  confirm: mocks.confirm,
  isCancel: vi.fn(() => false),
  select: mocks.select,
}))
vi.mock('node:fs/promises', () => ({
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
}))
vi.mock('node:fs', async importOriginal => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  existsSync: vi.fn((path: unknown) => String(path).endsWith('published-dsh-plugins.json')),
}))
vi.mock('node:child_process', () => ({ spawnSync: mocks.spawnSync }))
vi.mock('bumpp', () => ({ versionBump: mocks.versionBump }))
vi.mock('../src/core/package.js', () => ({ readPackageInfo: mocks.readPackageInfo }))
vi.mock('../src/ui/prompts.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/ui/prompts.js')>()),
  askPlugin: mocks.askPlugin,
}))

const { runVersion } = await import('../src/commands/version.js')

const targets = [
  {
    value: 'codex',
    label: 'Codex Auth',
    name: '@tnnevol/dsh-codex-auth',
    filter: '@tnnevol/dsh-codex-auth...',
    path: 'plugins/dsh-codex-auth-plugin/package.json',
    slug: 'dsh-codex-auth',
  },
  {
    value: 'fnos',
    label: 'fnOS',
    name: '@tnnevol/dsh-fnos',
    filter: '@tnnevol/dsh-fnos...',
    path: 'plugins/dsh-fnos-plugin/package.json',
    slug: 'dsh-fnos',
  },
]

describe('plugin version command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.askPlugin.mockResolvedValue(targets)
    mocks.readPackageInfo.mockImplementation(async (path: string) => ({
      name: path.includes('codex-auth') ? '@tnnevol/dsh-codex-auth' : '@tnnevol/dsh-fnos',
      version: '1.2.3',
    }))
    mocks.versionBump.mockResolvedValue({ currentVersion: '1.2.3', newVersion: '1.2.4' })
    mocks.select.mockResolvedValue('patch')
    mocks.confirm.mockResolvedValue(true)
    mocks.readFile.mockImplementation(async (path: string) => path.endsWith('published-dsh-plugins.json')
      ? JSON.stringify({
          version: 1,
          plugins: [
            { name: '@tnnevol/dsh-codex-auth', version: '1.2.2' },
            { name: '@tnnevol/dsh-fnos', version: '1.2.2' },
          ],
        })
      : JSON.stringify({ name: 'plugin', version: '1.2.3' }))
    mocks.spawnSync.mockReturnValue({ status: 0, error: undefined, stderr: '', stdout: '' })
  })

  it('updates selected plugin packages and the published plugin manifest in one commit', async () => {
    await runVersion(['plugin', '--yes'])

    expect(mocks.versionBump).not.toHaveBeenCalled()
    const writtenPaths = mocks.writeFile.mock.calls.map(call => String(call[0]))
    expect(writtenPaths.filter(path => path.endsWith('/package.json'))).toHaveLength(2)
    expect(writtenPaths.filter(path => path.endsWith('published-dsh-plugins.json'))).toHaveLength(2)
    expect(mocks.spawnSync).toHaveBeenNthCalledWith(1, 'git', ['add', '--', ...targets.map(target => target.path), 'apps/fn-deepseek-harness/app/published-dsh-plugins.json'], expect.any(Object))
    expect(mocks.spawnSync).toHaveBeenNthCalledWith(2, 'git', ['commit', '-m', 'chore(plugin): release selected plugins v1.2.4'], expect.any(Object))
  })

  it('updates one plugin and synchronizes its matching manifest entry', async () => {
    mocks.askPlugin.mockResolvedValue([targets[1]])
    mocks.readPackageInfo.mockResolvedValue({ name: '@tnnevol/dsh-fnos', version: '1.2.3' })
    await runVersion(['plugin', '--yes'])

    expect(mocks.writeFile).toHaveBeenCalledTimes(2)
    expect(mocks.spawnSync).toHaveBeenNthCalledWith(2, 'git', ['commit', '-m', 'chore(plugin): release @tnnevol/dsh-fnos v1.2.4'], expect.any(Object))
  })

  it('rejects a combined release when plugin versions differ', async () => {
    mocks.readPackageInfo
      .mockResolvedValueOnce({ name: '@tnnevol/dsh-codex-auth', version: '1.2.3' })
      .mockResolvedValueOnce({ name: '@tnnevol/dsh-fnos', version: '1.2.2' })

    await expect(runVersion(['plugin'])).rejects.toThrow('same current version')
    expect(mocks.versionBump).not.toHaveBeenCalled()
  })

  it('does not commit when --no-commit is provided', async () => {
    await runVersion(['plugin', '--no-commit', '--yes'])

    expect(mocks.writeFile).toHaveBeenCalled()
    expect(mocks.spawnSync).not.toHaveBeenCalled()
  })
})
