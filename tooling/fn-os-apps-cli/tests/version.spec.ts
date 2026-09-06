import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  askPlugin: vi.fn(),
  readPackageInfo: vi.fn(),
  versionBump: vi.fn(),
}))

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
}))
vi.mock('bumpp', () => ({ versionBump: mocks.versionBump }))
vi.mock('../src/core/package.js', () => ({ readPackageInfo: mocks.readPackageInfo }))
vi.mock('../src/ui/prompts.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/ui/prompts.js')>()),
  askPlugin: mocks.askPlugin,
}))

const { runVersion } = await import('../src/commands/version.js')

const targets = [
  {
    value: 'codebuddy',
    label: 'CodeBuddy',
    name: '@tnnevol/dsh-codebuddy',
    filter: '@tnnevol/dsh-codebuddy...',
    path: 'plugins/dsh-codebuddy-plugin/package.json',
    slug: 'dsh-codebuddy',
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
    mocks.readPackageInfo.mockResolvedValue({ name: 'plugin', version: '1.2.3' })
    mocks.versionBump.mockResolvedValue({ currentVersion: '1.2.3', newVersion: '1.2.4' })
  })

  it('bumps all selected plugins in one operation and creates no tag', async () => {
    await runVersion(['plugin'])

    expect(mocks.versionBump).toHaveBeenCalledTimes(1)
    expect(mocks.versionBump).toHaveBeenCalledWith(expect.objectContaining({
      files: targets.map(target => target.path),
      currentVersion: '1.2.3',
      commit: 'chore(plugin): release selected plugins v%s',
      tag: false,
    }))
    expect(mocks.versionBump.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      commit: 'chore(plugin): release selected plugins v%s',
    }))
  })

  it('creates no tag for a single plugin release', async () => {
    mocks.askPlugin.mockResolvedValue([targets[1]])
    await runVersion(['plugin'])

    expect(mocks.versionBump).toHaveBeenCalledTimes(1)
    expect(mocks.versionBump).toHaveBeenCalledWith(expect.objectContaining({
      files: ['plugins/dsh-fnos-plugin/package.json'],
      commit: 'chore(plugin): release plugin v%s',
      tag: false,
    }))
  })

  it('rejects a combined release when plugin versions differ', async () => {
    mocks.readPackageInfo
      .mockResolvedValueOnce({ name: '@tnnevol/dsh-codebuddy', version: '1.2.3' })
      .mockResolvedValueOnce({ name: '@tnnevol/dsh-fnos', version: '1.2.2' })

    await expect(runVersion(['plugin'])).rejects.toThrow('same current version')
    expect(mocks.versionBump).not.toHaveBeenCalled()
  })

  it('keeps version flags when plugin selection is interactive', async () => {
    await runVersion(['plugin', '--no-commit', '--no-tag', '--yes'])

    expect(mocks.versionBump).toHaveBeenCalledTimes(1)
    expect(mocks.versionBump).toHaveBeenCalledWith(expect.objectContaining({
      commit: false,
      tag: false,
      confirm: false,
    }))
  })
})
