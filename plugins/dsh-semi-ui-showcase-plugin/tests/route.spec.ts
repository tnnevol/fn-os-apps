import { describe, expect, it, vi } from 'vitest'
import { apply as applyHost, SEMI_UI_SHOWCASE_SETTINGS_NAMESPACE } from '../src/index.ts'
import { SEMI_UI_SHOWCASE_HASH, ShowcaseRouteController } from '../src/client/route.ts'

function fakeBrowser(hash = '#/') {
  const listeners = new Map<string, Set<() => void>>()
  return {
    location: { hash },
    history: {} as History,
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      const callbacks = listeners.get(type) ?? new Set()
      callbacks.add(listener as () => void)
      listeners.set(type, callbacks)
    }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.get(type)?.delete(listener as () => void)
    }),
  }
}

describe('Semi UI showcase hash route', () => {
  it('serves a settings namespace so the showcase card is discoverable', () => {
    const register = vi.fn()
    applyHost({ settings: { register } } as never)
    expect(register).toHaveBeenCalledTimes(1)
    expect(register.mock.calls[0]?.[0]).toBe(SEMI_UI_SHOWCASE_SETTINGS_NAMESPACE)
  })

  it('closes the settings shell before opening the showcase route', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/client/ShowcaseCard.tsx', import.meta.url), 'utf8'))
    expect(source).toContain("key: 'Escape'")
    expect(source).toContain('closeDshSettings(); route.open()')
  })

  it('uses Semi render content and the official chevron icon for the theme trigger', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/client/ShowcasePage.tsx', import.meta.url), 'utf8'))
    expect(source).toContain('render={themeDropdownContent}')
    expect(source).toContain('DshIconChevronDown')
    expect(source).not.toContain('⌄')
  })

  it('opens the route and returns to the previous DSH hash', () => {
    const browser = fakeBrowser('#/conversation/1')
    const route = new ShowcaseRouteController(browser as unknown as Window)
    route.open()
    expect(browser.location.hash).toBe(SEMI_UI_SHOWCASE_HASH)
    expect(route.getSnapshot().active).toBe(true)
    route.close()
    expect(browser.location.hash).toBe('#/conversation/1')
    expect(route.getSnapshot().active).toBe(false)
  })

  it('keeps the external-store snapshot stable between route changes', () => {
    const route = new ShowcaseRouteController(fakeBrowser() as unknown as Window)
    expect(route.getSnapshot()).toBe(route.getSnapshot())
    route.open()
    expect(route.getSnapshot().active).toBe(true)
    expect(route.getSnapshot()).toBe(route.getSnapshot())
  })

  it('ignores unknown hashes and removes listeners on dispose', () => {
    const browser = fakeBrowser('#/future-dsh-route')
    const route = new ShowcaseRouteController(browser as unknown as Window)
    const dispose = route.install()
    expect(route.getSnapshot().active).toBe(false)
    dispose()
    expect(browser.removeEventListener).toHaveBeenCalledTimes(2)
    expect(browser.location.hash).toBe('#/future-dsh-route')
  })
})
