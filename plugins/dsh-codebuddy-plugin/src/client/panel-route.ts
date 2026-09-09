/**
 * Hash 路由：CodeBuddy 管理面板的多页面隔离（#/codebuddy/<page>）。
 * 与 showcase 的路由控制器同构；每个页面是独立的 hash 路由，不做动态组件切换。
 *
 * @module dsh-codebuddy/panel-route
 */

export const PANEL_HASHES = {
  accounts: '#/codebuddy/accounts',
  credits: '#/codebuddy/credits',
  tokens: '#/codebuddy/tokens',
} as const

export type PanelRoute = keyof typeof PANEL_HASHES

const entries = Object.entries(PANEL_HASHES) as Array<[PanelRoute, string]>

type PanelBrowser = {
  location: Pick<Location, 'hash'>
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

export class PanelRouteController {
  private readonly listeners = new Set<() => void>()
  private active = false
  private page: PanelRoute = 'accounts'
  private snapshot: { active: boolean, page: PanelRoute } = { active: false, page: 'accounts' }

  constructor(private readonly browser: PanelBrowser = window) {
    this.syncFromHash()
    // `useSyncExternalStore` reads the snapshot before effects run. Hydrating
    // the snapshot here keeps a direct refresh of #/codebuddy/accounts on the
    // panel instead of briefly (or permanently) falling back to the session.
    this.snapshot = { active: this.active, page: this.page }
  }

  readonly getSnapshot = (): { active: boolean, page: PanelRoute } => this.snapshot

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  readonly sync = (): void => {
    const before = `${this.active}:${this.page}`
    this.syncFromHash()
    if (`${this.active}:${this.page}` !== before) {
      this.snapshot = { active: this.active, page: this.page }
      for (const listener of this.listeners) listener()
    }
  }

  private syncFromHash(): void {
    const hash = this.browser.location.hash
    this.active = hash === '#/codebuddy' || entries.some(([, h]) => h === hash)
    this.page = (entries.find(([, h]) => h === hash)?.[0]) ?? 'accounts'
  }

  open(page: PanelRoute): void {
    this.browser.location.hash = PANEL_HASHES[page]
    this.sync()
  }

  close(): void {
    this.browser.location.hash = '#/'
    this.sync()
  }

  install(): () => void {
    this.browser.addEventListener('hashchange', this.sync)
    this.browser.addEventListener('popstate', this.sync)
    this.sync()
    return () => {
      this.browser.removeEventListener('hashchange', this.sync)
      this.browser.removeEventListener('popstate', this.sync)
      this.listeners.clear()
    }
  }
}
