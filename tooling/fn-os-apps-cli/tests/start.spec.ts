import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  askStartSelection: vi.fn(),
  askPlugins: vi.fn(),
  ensureLocalProfilePlugins: vi.fn(),
  runTurboWatch: vi.fn(),
  runDocsDev: vi.fn(),
  devEnvironment: vi.fn(() => ({ DSH_HOME: '/repo/.dsh' })),
  DEV_WEB_TASK: '//#dev:web',
}))

vi.mock('@clack/prompts', () => ({
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
  multiselect: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
}))
vi.mock('../src/ui/prompts.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/ui/prompts.js')>()),
  askStartSelection: mocks.askStartSelection,
  askPlugins: mocks.askPlugins,
}))
vi.mock('../src/core/local-profile.js', () => ({
  ensureLocalProfilePlugins: mocks.ensureLocalProfilePlugins,
}))
vi.mock('../src/commands/docs.js', () => ({ runDocsDev: mocks.runDocsDev, runDocsBuild: vi.fn() }))
vi.mock('../src/core/turbo.js', () => ({
  DEV_WEB_TASK: mocks.DEV_WEB_TASK,
  devEnvironment: mocks.devEnvironment,
  runTurboWatch: mocks.runTurboWatch,
}))

const { runStart } = await import('../src/commands/start.js')

const pluginFilter = '@tnnevol/dsh-fnos...'

/** Pretend to be (or not be) a terminal: only a real TTY may host Turbo's TUI. */
function fakeTty(value: boolean): void {
  for (const stream of [process.stdin, process.stdout]) {
    Object.defineProperty(stream, 'isTTY', { value, configurable: true })
  }
}

describe('start command', () => {
  beforeEach(() => {
    mocks.askStartSelection.mockResolvedValue(['docs'])
    mocks.askPlugins.mockResolvedValue([pluginFilter])
    mocks.runTurboWatch.mockResolvedValue(undefined)
    mocks.runDocsDev.mockResolvedValue(undefined)
    mocks.ensureLocalProfilePlugins.mockResolvedValue(undefined)
  })

  afterEach(() => {
    delete (process.stdin as { isTTY?: boolean }).isTTY
    delete (process.stdout as { isTTY?: boolean }).isTTY
  })

  it('schedules DSH Web into the same turbo watch as the docs task', async () => {
    fakeTty(true)
    await runStart(['--web', '--docs'])

    // One single `turbo watch` keeps the TUI: DSH Web is a Turbo row, not a
    // second foreground process.
    expect(mocks.runTurboWatch).toHaveBeenCalledTimes(1)
    expect(mocks.runTurboWatch).toHaveBeenCalledWith(['//#dev:web', 'dev'], ['./docs'], { env: { DSH_HOME: '/repo/.dsh' } })
  })

  it('runs docs through Turbo on a TTY so the task can take the keyboard', async () => {
    fakeTty(true)
    await runStart(['--docs'])

    expect(mocks.runTurboWatch).toHaveBeenCalledWith(['dev'], ['./docs'], expect.anything())
    expect(mocks.runDocsDev).not.toHaveBeenCalled()
  })

  it('runs docs outside Turbo without a TTY, where an interactive task would fail', async () => {
    fakeTty(false)
    await runStart(['--docs'])

    expect(mocks.runTurboWatch).not.toHaveBeenCalled()
    expect(mocks.runDocsDev).toHaveBeenCalledTimes(1)
  })

  it('keeps plugins on Turbo and starts docs headlessly when neither has a TTY', async () => {
    fakeTty(false)
    mocks.askStartSelection.mockResolvedValue(['docs', 'plugins'])
    await runStart([])

    expect(mocks.runTurboWatch).toHaveBeenCalledTimes(1)
    expect(mocks.runTurboWatch).toHaveBeenCalledWith(['dev'], [pluginFilter], expect.anything())
    expect(mocks.runDocsDev).toHaveBeenCalledTimes(1)
  })

  it('links the local profile plugins before booting DSH Web', async () => {
    fakeTty(true)
    await runStart(['--web'])
    expect(mocks.ensureLocalProfilePlugins).toHaveBeenCalledTimes(1)
    expect(mocks.runTurboWatch).toHaveBeenCalledWith(['//#dev:web'], [], expect.anything())
  })

  it('does not touch the local profile when DSH Web is not selected', async () => {
    fakeTty(true)
    await runStart(['--docs'])

    expect(mocks.ensureLocalProfilePlugins).not.toHaveBeenCalled()
  })

  it('keeps the Turbo watch path for plugins', async () => {
    fakeTty(true)
    mocks.askStartSelection.mockResolvedValue(['plugins'])
    await runStart([])

    expect(mocks.runTurboWatch).toHaveBeenCalledTimes(1)
    const [tasks] = mocks.runTurboWatch.mock.calls[0] ?? []
    expect(tasks).toEqual(['dev'])
    expect(mocks.ensureLocalProfilePlugins).not.toHaveBeenCalled()
  })

  it('schedules all three target classes into one watch on a TTY', async () => {
    fakeTty(true)
    mocks.askStartSelection.mockResolvedValue(['web', 'plugins', 'docs'])
    await runStart([])

    expect(mocks.runTurboWatch).toHaveBeenCalledTimes(1)
    expect(mocks.runTurboWatch).toHaveBeenCalledWith(
      ['//#dev:web', 'dev'],
      ['./docs', pluginFilter],
      { env: { DSH_HOME: '/repo/.dsh' } },
    )
  })

  it('does nothing when the interactive selection is cancelled', async () => {
    mocks.askStartSelection.mockResolvedValue(undefined)
    await runStart([])

    expect(mocks.runTurboWatch).not.toHaveBeenCalled()
    expect(mocks.runDocsDev).not.toHaveBeenCalled()
    expect(mocks.ensureLocalProfilePlugins).not.toHaveBeenCalled()
  })
})
