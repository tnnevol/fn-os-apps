import { describe, expect, it } from 'vitest'
import { PanelRouteController } from '../src/client/panel-route.ts'

function browserWithHash(hash: string) {
  const listeners = new Map<string, Set<() => void>>()
  const replaced: string[] = []
  const browser = {
    location: { hash },
    history: {
      replaceState(_data: unknown, _unused: string, url?: string | URL | null) {
        const next = String(url ?? '')
        replaced.push(next)
        // `replaceState` with a hash-only URL updates `location.hash` in a real
        // browser; mirror that so the controller's own read stays consistent.
        browser.location.hash = next
      },
    },
    replaced,
    addEventListener(type: string, listener: () => void) {
      const bucket = listeners.get(type) ?? new Set<() => void>()
      bucket.add(listener)
      listeners.set(type, bucket)
    },
    removeEventListener(type: string, listener: () => void) {
      listeners.get(type)?.delete(listener)
    },
    emit(type: string) {
      for (const listener of listeners.get(type) ?? []) listener()
    },
  }
  return browser
}

describe('CodeBuddy panel hash route', () => {
  it('hydrates the active snapshot from the URL before the first render', () => {
    const browser = browserWithHash('#/codebuddy/accounts')
    const route = new PanelRouteController(browser)

    expect(route.getSnapshot()).toEqual({ active: true, page: 'accounts' })
  })

  it('keeps the panel active when refreshed on the bare #/codebuddy route', () => {
    const browser = browserWithHash('#/codebuddy')
    const route = new PanelRouteController(browser)

    expect(route.getSnapshot()).toEqual({ active: true, page: 'accounts' })
  })

  it('keeps the panel active when refreshed on #/codebuddy with a trailing slash', () => {
    const browser = browserWithHash('#/codebuddy/')
    const route = new PanelRouteController(browser)

    expect(route.getSnapshot()).toEqual({ active: true, page: 'accounts' })
  })

  it('falls back to the entry page for an unrecognized subpage instead of leaving the panel', () => {
    const browser = browserWithHash('#/codebuddy/does-not-exist')
    const route = new PanelRouteController(browser)

    expect(route.getSnapshot()).toEqual({ active: true, page: 'accounts' })
  })

  it('canonicalizes a bare panel route without pushing a history entry', () => {
    const browser = browserWithHash('#/codebuddy')
    new PanelRouteController(browser)

    expect(browser.replaced).toEqual(['#/codebuddy/accounts'])
    expect(browser.location.hash).toBe('#/codebuddy/accounts')
  })

  it('leaves a canonical subpage URL untouched', () => {
    const browser = browserWithHash('#/codebuddy/tokens')
    const route = new PanelRouteController(browser)

    expect(browser.replaced).toEqual([])
    expect(route.getSnapshot()).toEqual({ active: true, page: 'tokens' })
  })

  it('does not claim unrelated hashes', () => {
    for (const hash of ['#/', '', '#/codebuddyx', '#/plugins/semi-ui']) {
      const route = new PanelRouteController(browserWithHash(hash))
      expect(route.getSnapshot().active).toBe(false)
    }
  })

  it('syncs browser history navigation and closes cleanly', () => {
    const browser = browserWithHash('#/codebuddy/accounts')
    const route = new PanelRouteController(browser)
    const dispose = route.install()

    browser.location.hash = '#/codebuddy/tokens'
    browser.emit('popstate')
    expect(route.getSnapshot()).toEqual({ active: true, page: 'tokens' })

    route.close()
    expect(route.getSnapshot()).toEqual({ active: false, page: 'accounts' })
    dispose()
  })
})
