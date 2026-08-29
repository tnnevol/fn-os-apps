export const SEMI_UI_SHOWCASE_HASH = '#/plugins/semi-ui'

export interface ShowcaseRouteSnapshot {
  active: boolean
}

export class ShowcaseRouteController {
  private readonly listeners = new Set<() => void>()
  private active = false
  private snapshot: ShowcaseRouteSnapshot = { active: false }
  private previousHash = '#/'

  constructor(private readonly browser: Pick<Window, 'location' | 'history' | 'addEventListener' | 'removeEventListener'> = window) {
    this.active = browser.location.hash === SEMI_UI_SHOWCASE_HASH
    this.snapshot = { active: this.active }
  }

  // useSyncExternalStore requires the snapshot reference to remain stable until
  // the external store actually changes.
  readonly getSnapshot = (): ShowcaseRouteSnapshot => this.snapshot

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  readonly sync = (): void => {
    const active = this.browser.location.hash === SEMI_UI_SHOWCASE_HASH
    if (active === this.active) return
    this.active = active
    this.snapshot = { active }
    for (const listener of this.listeners) listener()
  }

  open(): void {
    if (!this.active) this.previousHash = this.browser.location.hash || '#/'
    this.browser.location.hash = SEMI_UI_SHOWCASE_HASH
    this.sync()
  }

  close(): void {
    this.browser.location.hash = this.previousHash
    this.sync()
  }

  install(): () => void {
    this.browser.addEventListener('hashchange', this.sync)
    this.browser.addEventListener('popstate', this.sync)
    this.sync()
    return () => {
      if (this.active) {
        this.browser.location.hash = '#/'
        this.active = false
        this.snapshot = { active: false }
      }
      this.browser.removeEventListener('hashchange', this.sync)
      this.browser.removeEventListener('popstate', this.sync)
      this.listeners.clear()
    }
  }
}
