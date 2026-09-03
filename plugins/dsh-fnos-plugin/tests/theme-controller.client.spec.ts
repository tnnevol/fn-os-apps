import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createThemeController } from '../src/client/theme-controller.ts'
import type { ThemeBridge } from '../src/client/theme-bridge.ts'

const DARK_ATTRIBUTE = 'data-ds-dark-theme'

class FakeElement {
  readonly style = { colorScheme: '', removeProperty: (name: string) => {
    if (name === 'color-scheme') this.style.colorScheme = ''
  } }
  private readonly attributes = new Set<string>()

  hasAttribute(name: string): boolean { return this.attributes.has(name) }
  setAttribute(name: string): void { this.attributes.add(name) }
  removeAttribute(name: string): void { this.attributes.delete(name) }
  toggleAttribute(name: string, force?: boolean): boolean {
    const next = force === undefined ? !this.attributes.has(name) : force
    if (next) this.attributes.add(name)
    else this.attributes.delete(name)
    return next
  }
}

function installDocument(): { root: FakeElement; body: FakeElement } {
  const root = new FakeElement()
  const body = new FakeElement()
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { documentElement: root, body },
  })
  return { root, body }
}

function makeController(initialPreference: 'light' | 'dark' | 'system', fnosTheme: 'light' | 'dark') {
  let preference = initialPreference
  const ctx = {
    theme: { getTheme: () => ({ preference } as never) },
  } as unknown as ClientContext
  const bridge = {
    getTheme: () => fnosTheme,
  } as ThemeBridge
  const persistence = { sync: vi.fn() }
  return {
    controller: createThemeController(ctx, bridge, persistence as never),
    setPreference(next: 'light' | 'dark' | 'system') { preference = next },
    persistence,
  }
}

beforeEach(() => {
  installDocument()
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'document')
})

describe('fnOS theme controller', () => {
  it('does not restore the pre-system dark state after DSH switches directly to light', () => {
    document.documentElement.style.colorScheme = 'dark'
    document.body.setAttribute(DARK_ATTRIBUTE, '')
    const state = makeController('system', 'dark')

    state.controller.refresh()
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.body.hasAttribute(DARK_ATTRIBUTE)).toBe(true)

    // Model the official ThemePresenter running before the fnOS listener.
    state.setPreference('light')
    document.documentElement.style.colorScheme = 'light'
    document.body.removeAttribute(DARK_ATTRIBUTE)
    state.controller.refresh()

    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(document.body.hasAttribute(DARK_ATTRIBUTE)).toBe(false)
    expect(state.persistence.sync).toHaveBeenLastCalledWith('light', null)
  })

  it('still restores the previous DOM state when the controller is disposed', () => {
    document.documentElement.style.colorScheme = 'light'
    document.body.removeAttribute(DARK_ATTRIBUTE)
    const state = makeController('system', 'dark')

    state.controller.refresh()
    state.controller.dispose()

    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(document.body.hasAttribute(DARK_ATTRIBUTE)).toBe(false)
  })
})
