import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { describe, expect, it, vi } from 'vitest'
import { createThemePersistence } from '../../src/client/services/theme-persistence.ts'
import type { FnosSettings } from '../../src/contracts/theme-contract.ts'

function makeScope(initial: Partial<SettingsScopeSnapshot<FnosSettings>> = {}) {
  let snapshot: SettingsScopeSnapshot<FnosSettings> = {
    status: 'ready',
    value: undefined,
    base: undefined,
    user: undefined,
    revision: 0,
    writable: true,
    mode: 'host',
    ...initial,
  }
  const set = vi.fn(() => Promise.resolve())
  const unset = vi.fn(() => Promise.resolve())
  const scope: SettingsScope<FnosSettings> = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    set,
    unset,
    mutate: vi.fn(() => Promise.resolve()),
  }
  return {
    scope,
    set,
    unset,
    publish(value: FnosSettings | undefined) { snapshot = { ...snapshot, value } },
  }
}

describe('fnOS theme persistence', () => {
  it('stores the resolved fnOS theme while DSH follows the system', () => {
    const host = makeScope()
    createThemePersistence(host.scope).sync('system', 'dark')
    expect(host.set).toHaveBeenCalledWith('systemTheme', 'dark')
    expect(host.unset).not.toHaveBeenCalled()
  })

  it('does not write an unchanged cache or write from a memory scope', () => {
    const cached = makeScope({ value: { systemTheme: 'light' } })
    createThemePersistence(cached.scope).sync('system', 'light')
    expect(cached.set).not.toHaveBeenCalled()
    expect(cached.unset).not.toHaveBeenCalled()

    const memory = makeScope({ mode: 'memory', writable: false })
    createThemePersistence(memory.scope).sync('system', 'dark')
    expect(memory.set).not.toHaveBeenCalled()
  })

  it('clears the cached theme when DSH chooses an explicit theme', () => {
    const host = makeScope({ value: { systemTheme: 'dark' } })
    createThemePersistence(host.scope).sync('light', null)
    expect(host.unset).toHaveBeenCalledWith('systemTheme')
    expect(host.set).not.toHaveBeenCalled()
  })

  it('coalesces repeated writes while the settings request is pending', () => {
    let resolve!: () => void
    const host = makeScope()
    host.set.mockImplementation(() => new Promise<void>(done => { resolve = done }))
    const persistence = createThemePersistence(host.scope)
    persistence.sync('system', 'dark')
    persistence.sync('system', 'dark')
    expect(host.set).toHaveBeenCalledTimes(1)
    resolve()
  })

  it('does not resend after a request resolves before the snapshot updates', async () => {
    let resolve!: () => void
    const host = makeScope()
    host.set.mockImplementation(() => new Promise<void>(done => { resolve = done }))
    const persistence = createThemePersistence(host.scope)

    persistence.sync('system', 'dark')
    resolve()
    await new Promise<void>(queueMicrotask)
    persistence.sync('system', 'dark')

    expect(host.set).toHaveBeenCalledTimes(1)
  })
})
