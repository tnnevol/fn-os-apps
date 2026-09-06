export const SEMI_UI_SHOWCASE_HASH = '#/plugins/semi-ui'

export const SEMI_UI_COMPONENT_HASHES = {
  button: '#/plugins/semi-ui/button',
  input: '#/plugins/semi-ui/input',
  'input-number': '#/plugins/semi-ui/input-number',
  slider: '#/plugins/semi-ui/slider',
  switch: '#/plugins/semi-ui/switch',
  form: '#/plugins/semi-ui/form',
  cascader: '#/plugins/semi-ui/cascader',
  'tree-select': '#/plugins/semi-ui/tree-select',
  checkbox: '#/plugins/semi-ui/checkbox',
  tree: '#/plugins/semi-ui/tree',
  icon: '#/plugins/semi-ui/icon',
  modal: '#/plugins/semi-ui/modal',
  popover: '#/plugins/semi-ui/popover',
  tooltip: '#/plugins/semi-ui/tooltip',
  dropdown: '#/plugins/semi-ui/dropdown',
  progress: '#/plugins/semi-ui/progress',
  spin: '#/plugins/semi-ui/spin',
  toast: '#/plugins/semi-ui/toast',
} as const

export type ShowcaseComponentRoute = keyof typeof SEMI_UI_COMPONENT_HASHES

const componentRouteEntries = Object.entries(SEMI_UI_COMPONENT_HASHES) as Array<[ShowcaseComponentRoute, string]>

function getComponentRoute(hash: string): ShowcaseComponentRoute {
  const entry = componentRouteEntries.find(([, componentHash]) => componentHash === hash)
  return entry?.[0] ?? 'button'
}

function isShowcaseHash(hash: string): boolean {
  return hash === SEMI_UI_SHOWCASE_HASH || componentRouteEntries.some(([, componentHash]) => componentHash === hash)
}

export interface ShowcaseRouteSnapshot {
  active: boolean
  component: ShowcaseComponentRoute
}

export class ShowcaseRouteController {
  private readonly listeners = new Set<() => void>()
  private active = false
  private snapshot: ShowcaseRouteSnapshot = { active: false, component: 'button' }
  private previousHash = '#/'

  constructor(private readonly browser: Pick<Window, 'location' | 'history' | 'addEventListener' | 'removeEventListener'> = window) {
    this.active = isShowcaseHash(browser.location.hash)
    this.snapshot = { active: this.active, component: getComponentRoute(browser.location.hash) }
  }

  // useSyncExternalStore requires the snapshot reference to remain stable until
  // the external store actually changes.
  readonly getSnapshot = (): ShowcaseRouteSnapshot => this.snapshot

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  readonly sync = (): void => {
    const hash = this.browser.location.hash
    const active = isShowcaseHash(hash)
    const component = getComponentRoute(hash)
    if (active === this.active && component === this.snapshot.component) return
    this.active = active
    this.snapshot = { active, component }
    for (const listener of this.listeners) listener()
  }

  open(component: ShowcaseComponentRoute = 'button'): void {
    if (!this.active) this.previousHash = this.browser.location.hash || '#/'
    this.browser.location.hash = SEMI_UI_COMPONENT_HASHES[component]
    this.sync()
  }

  select(component: ShowcaseComponentRoute): void {
    if (!this.active) {
      this.open(component)
      return
    }
    this.browser.location.hash = SEMI_UI_COMPONENT_HASHES[component]
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
        this.snapshot = { active: false, component: 'button' }
      }
      this.browser.removeEventListener('hashchange', this.sync)
      this.browser.removeEventListener('popstate', this.sync)
      this.listeners.clear()
    }
  }
}
