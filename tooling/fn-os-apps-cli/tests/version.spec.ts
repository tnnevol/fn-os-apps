import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readPackageInfo: vi.fn(),
  versionBump: vi.fn(),
}))

vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  isCancel: vi.fn(() => false),
  select: vi.fn(),
  text: vi.fn(),
}))
vi.mock('node:fs/promises', () => ({
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
}))
vi.mock('bumpp', () => ({ versionBump: mocks.versionBump }))
vi.mock('../src/core/package.js', () => ({ readPackageInfo: mocks.readPackageInfo }))

const { runVersion } = await import('../src/commands/version.js')

describe('project version command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readPackageInfo.mockResolvedValue({ name: 'fn-os-apps', version: '1.2.3' })
    mocks.versionBump.mockResolvedValue({ currentVersion: '1.2.3', newVersion: '1.2.4' })
    mocks.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('docs/package.json')) return JSON.stringify({ name: '@tnnevol/fn-os-apps-docs', version: '1.2.3' })
      if (path.endsWith('docs/development/manifest.md')) return 'version               = 1.2.1\n'
      return JSON.stringify({ name: 'package', version: '1.2.3' })
    })
  })

  it('bumps the project version files with the requested release', async () => {
    await runVersion(['patch', '--no-commit', '--no-tag', '--yes'])

    expect(mocks.versionBump).toHaveBeenCalledWith(expect.objectContaining({
      currentVersion: '1.2.3',
      release: 'patch',
      commit: false,
      tag: false,
      push: false,
    }))
    expect(mocks.versionBump.mock.calls[0]?.[0].files).toEqual(expect.arrayContaining([
      'package.json',
      'docs/package.json',
      'docs/development/manifest.md',
    ]))
  })

  it('aligns the docs example text file before bumping', async () => {
    await runVersion(['patch', '--no-commit', '--no-tag', '--yes'])

    const writtenPaths = mocks.writeFile.mock.calls.map(call => String(call[0]))
    expect(writtenPaths.filter(path => path.endsWith('docs/development/manifest.md'))).toHaveLength(1)
    const written = mocks.writeFile.mock.calls.find(call => String(call[0]).endsWith('docs/development/manifest.md'))
    expect(written?.[1]).toContain('version               = 1.2.3')
  })

  it('aligns the docs workspace package when it drifts from the root version', async () => {
    mocks.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('docs/package.json')) return JSON.stringify({ name: '@tnnevol/fn-os-apps-docs', version: '1.2.2' })
      if (path.endsWith('docs/development/manifest.md')) return 'version               = 1.2.3\n'
      return JSON.stringify({ name: 'package', version: '1.2.3' })
    })

    await runVersion(['patch', '--no-commit', '--no-tag', '--yes'])

    const written = mocks.writeFile.mock.calls.find(call => String(call[0]).endsWith('docs/package.json'))
    expect(written?.[1]).toContain('1.2.3')
  })

  it('does not rewrite the docs package when it already matches', async () => {
    await runVersion(['patch', '--no-commit', '--no-tag', '--yes'])

    const writtenPaths = mocks.writeFile.mock.calls.map(call => String(call[0]))
    expect(writtenPaths.filter(path => path.endsWith('docs/package.json'))).toHaveLength(0)
  })

  it('rejects unknown version options', async () => {
    await expect(runVersion(['patch', '--nope'])).rejects.toThrow('Unknown version option')
    expect(mocks.versionBump).not.toHaveBeenCalled()
  })
})
