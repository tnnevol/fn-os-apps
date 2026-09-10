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

describe('已移除的「积分管理」路由', () => {
  it('旧链接 #/codebuddy/credits 回落到入口页（账号管理）', async () => {
    // 积分面板已迁入账号页、菜单项移除。用户可能存过这个书签，
    // 未知子页由 pageFromHash 回落到 DEFAULT_PAGE，因此不会白屏。
    const { PanelRouteController } = await import('../src/client/panel-route.ts')
    const browser = {
      location: { hash: '#/codebuddy/credits' },
      history: { replaceState: (_d: unknown, _u: string, url?: string | URL | null) => { browser.location.hash = String(url) } },
    }
    const route = new PanelRouteController(browser as never)
    expect(route.getSnapshot().active).toBe(true)
    expect(route.getSnapshot().page).toBe('accounts')
    // 地址栏被改写为规范子页，刷新后不会再落到未知路由。
    expect(browser.location.hash).toBe('#/codebuddy/accounts')
  })

  it('PANEL_HASHES 不再包含 credits', async () => {
    const { PANEL_HASHES } = await import('../src/client/panel-route.ts')
    expect(Object.keys(PANEL_HASHES)).not.toContain('credits')
  })
})
