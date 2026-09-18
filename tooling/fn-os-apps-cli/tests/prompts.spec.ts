import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  multiselect: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
}))

vi.mock('@clack/prompts', () => ({
  cancel: mocks.cancel,
  isCancel: mocks.isCancel,
  multiselect: mocks.multiselect,
}))

const { askBuildSelection, askCheckSelection, askFpkApps } = await import('../src/ui/prompts.js')

type App = { name: string, label: string }

describe('selection prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isCancel.mockReturnValue(false)
    mocks.multiselect.mockResolvedValue([])
  })

  it('returns the only option without prompting', async () => {
    const apps: App[] = [{ name: 'fn-memos', label: 'Memos' }]
    const selected = await askFpkApps(apps)

    expect(mocks.multiselect).not.toHaveBeenCalled()
    expect(selected).toEqual(apps)
  })

  it('returns an empty selection when there is nothing to choose', async () => {
    const selected = await askFpkApps([])

    expect(mocks.multiselect).not.toHaveBeenCalled()
    expect(selected).toEqual([])
  })

  it('prompts when more than one option exists', async () => {
    const apps: App[] = [
      { name: 'fn-memos', label: 'Memos' },
      { name: 'fn-halo', label: 'Halo' },
    ]
    mocks.multiselect.mockResolvedValue(['fn-halo'])

    const selected = await askFpkApps(apps)

    expect(mocks.multiselect).toHaveBeenCalledTimes(1)
    expect(selected).toEqual([apps[1]])
  })

  it('returns undefined when the user cancels', async () => {
    const apps: App[] = [
      { name: 'fn-memos', label: 'Memos' },
      { name: 'fn-halo', label: 'Halo' },
    ]
    mocks.multiselect.mockResolvedValue(Symbol('clack:cancel'))
    mocks.isCancel.mockReturnValue(true)

    expect(await askFpkApps(apps)).toBeUndefined()
    expect(mocks.cancel).toHaveBeenCalledWith('已取消 FPK 构建')
  })

  it('prompts for check and build because both still offer two targets', async () => {
    mocks.multiselect.mockResolvedValueOnce(['sdd']).mockResolvedValueOnce(['docs'])

    expect(await askCheckSelection()).toEqual(['sdd'])
    expect(await askBuildSelection()).toEqual(['docs'])
    expect(mocks.multiselect).toHaveBeenCalledTimes(2)
  })
})
