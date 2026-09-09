import { describe, expect, it } from 'vitest'
import { PanelRouteController } from '../src/client/panel-route.ts'

function browserWithHash(hash: string) {
  const listeners = new Map<string, Set<() => void>>()
  return {
    location: { hash },
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
}

describe('CodeBuddy panel hash route', () => {
  it('hydrates the active snapshot from the URL before the first render', () => {
    const browser = browserWithHash('#/codebuddy/accounts')
    const route = new PanelRouteController(browser)

    expect(route.getSnapshot()).toEqual({ active: true, page: 'accounts' })
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
