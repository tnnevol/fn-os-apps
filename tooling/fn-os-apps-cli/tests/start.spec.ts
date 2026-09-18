import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runTurboWatch: vi.fn(),
  runDocsDev: vi.fn(),
}))

vi.mock('../src/commands/docs.js', () => ({ runDocsDev: mocks.runDocsDev, runDocsBuild: vi.fn() }))
vi.mock('../src/core/turbo.js', () => ({
  runTurboWatch: mocks.runTurboWatch,
}))

const { runStart } = await import('../src/commands/start.js')

/** Pretend to be (or not be) a terminal: only a real TTY may host Turbo's TUI. */
function fakeTty(value: boolean): void {
  for (const stream of [process.stdin, process.stdout]) {
    Object.defineProperty(stream, 'isTTY', { value, configurable: true })
  }
}

describe('start command', () => {
  beforeEach(() => {
    mocks.runTurboWatch.mockResolvedValue(undefined)
    mocks.runDocsDev.mockResolvedValue(undefined)
  })

  afterEach(() => {
    delete (process.stdin as { isTTY?: boolean }).isTTY
    delete (process.stdout as { isTTY?: boolean }).isTTY
  })

  it('runs docs through Turbo on a TTY so the task can take the keyboard', async () => {
    fakeTty(true)
    await runStart()

    // The docs `dev` task is `interactive`, so it needs Turbo's TUI to receive
    // the keyboard; that is the whole reason the watch path exists.
    expect(mocks.runTurboWatch).toHaveBeenCalledTimes(1)
    expect(mocks.runTurboWatch).toHaveBeenCalledWith(['dev'], ['./docs'])
    expect(mocks.runDocsDev).not.toHaveBeenCalled()
  })

  it('runs docs outside Turbo without a TTY, where an interactive task would fail', async () => {
    fakeTty(false)
    await runStart()

    expect(mocks.runTurboWatch).not.toHaveBeenCalled()
    expect(mocks.runDocsDev).toHaveBeenCalledTimes(1)
  })
})
