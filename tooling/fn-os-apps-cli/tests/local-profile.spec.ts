import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dirname, join } from 'node:path'
import { repositoryRoot } from '../src/config/paths.js'

const mocks = vi.hoisted(() => ({
  runTurbo: vi.fn(),
  runRepoDsh: vi.fn(),
  readFile: vi.fn(),
}))

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

vi.mock('../src/config/targets.js', () => ({ pluginTargets: targets, findPluginTarget: vi.fn() }))
vi.mock('../src/core/turbo.js', () => ({
  runRepoDsh: mocks.runRepoDsh,
  runTurbo: mocks.runTurbo,
  runTurboWatch: vi.fn(),
}))
vi.mock('node:fs/promises', async importOriginal => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  readFile: mocks.readFile,
}))

const { ensureLocalProfilePlugins, localProfilePlugins } = await import('../src/core/local-profile.js')

/** The profile records absolute `link:` specs, so the fixture must match the resolved directory. */
const codexDirectory = dirname(join(repositoryRoot, 'plugins/dsh-codex-auth-plugin/package.json'))

describe('local profile plugins', () => {
  beforeEach(() => {
    mocks.runTurbo.mockResolvedValue(undefined)
    mocks.runRepoDsh.mockResolvedValue(undefined)
    mocks.readFile.mockRejectedValue(new Error('ENOENT'))
  })

  it('excludes the fnOS plugin, which only serves the fnOS host', () => {
    expect(localProfilePlugins.map(target => target.name)).toEqual(['@tnnevol/dsh-codex-auth'])
  })

  it('builds the plugins and links them into the web profile', async () => {
    await ensureLocalProfilePlugins()

    expect(mocks.runTurbo).toHaveBeenCalledWith(['build'], ['@tnnevol/dsh-codex-auth...'])
    expect(mocks.runRepoDsh).toHaveBeenCalledTimes(1)
    const [args] = mocks.runRepoDsh.mock.calls[0] ?? []
    expect(args?.[0]).toBe('plugin')
    expect(args?.slice(1, 4)).toEqual(['--profile', 'web', 'add'])
    expect(String(args?.[4])).toContain('plugins/dsh-codex-auth-plugin')
  })

  it('skips a plugin the profile already links as a bundle layer', async () => {
    mocks.readFile.mockResolvedValue(JSON.stringify({
      dependencies: {
        '@tnnevol/dsh-codex-auth': `link:${codexDirectory}`,
      },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@tnnevol/dsh-codex-auth'] } },
    }))

    await ensureLocalProfilePlugins()

    expect(mocks.runTurbo).toHaveBeenCalled()
    expect(mocks.runRepoDsh).not.toHaveBeenCalled()
  })

  it('re-links a plugin that is a dependency but not yet a bundle layer', async () => {
    mocks.readFile.mockResolvedValue(JSON.stringify({
      dependencies: {
        '@tnnevol/dsh-codex-auth': `link:${codexDirectory}`,
      },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } },
    }))

    await ensureLocalProfilePlugins()

    expect(mocks.runRepoDsh).toHaveBeenCalledTimes(1)
  })
})
