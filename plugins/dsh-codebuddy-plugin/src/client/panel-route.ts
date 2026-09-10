/**
 * Hash 路由：CodeBuddy 管理面板的多页面隔离（#/codebuddy/<page>）。
 * 与 showcase 的路由控制器同构；每个页面是独立的 hash 路由，不做动态组件切换。
 *
 * @module dsh-codebuddy/panel-route
 */

export const PANEL_HASHES = {
  accounts: '#/codebuddy/accounts',
  tokens: '#/codebuddy/tokens',
} as const

export type PanelRoute = keyof typeof PANEL_HASHES

const entries = Object.entries(PANEL_HASHES) as Array<[PanelRoute, string]>

/** 面板 hash 的公共前缀；`#/codebuddy` 与 `#/codebuddy/<page>` 都属于面板。 */
const PANEL_PREFIX = '#/codebuddy'

/** 面板的入口页：裸路由或无法识别的子页都落到这里。 */
const DEFAULT_PAGE: PanelRoute = 'accounts'

/**
 * 该 hash 是否属于本面板。
 *
 * DSH 前端自身没有 hash 路由（整个前端 bundle 不读写 `location.hash`），
 * 因此「`/#/codebuddy` 刷新后回到会话页」只会由本匹配器造成：精确相等
 * 会把带尾斜杠的 `#/codebuddy/`、或任何未知子页判成非面板。用前缀匹配
 * 兜住全部变体，刷新才稳定停在面板里。
 * @param hash - the raw `location.hash` value.
 * @returns whether the panel owns this hash.
 */
function isPanelHash(hash: string): boolean {
  return hash === PANEL_PREFIX || hash.startsWith(`${PANEL_PREFIX}/`)
}

/**
 * Resolve the page a hash addresses, defaulting to the entry page.
 * @param hash - the raw `location.hash` value.
 * @returns the addressed page, or the entry page when the hash is unknown.
 */
function pageFromHash(hash: string): PanelRoute {
  return entries.find(([, h]) => h === hash)?.[0] ?? DEFAULT_PAGE
}

type PanelBrowser = {
  location: { hash: string }
  /** Optional: canonicalization uses `replaceState` so a refresh adds no entry. */
  history?: { replaceState: (data: unknown, unused: string, url?: string | URL | null) => void }
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

export class PanelRouteController {
  private readonly listeners = new Set<() => void>()
  private active = false
  private page: PanelRoute = DEFAULT_PAGE
  private snapshot: { active: boolean, page: PanelRoute } = { active: false, page: DEFAULT_PAGE }

  constructor(private readonly browser: PanelBrowser = window) {
    this.syncFromHash()
    // A bare or unrecognized panel hash is rewritten to its canonical subpage.
    // Without this, a bookmarked `/#/codebuddy` renders the panel but leaves a
    // URL that only this matcher's prefix rule understands; canonicalizing on
    // load keeps the address bar and any later refresh unambiguous.
    if (this.active) this.canonicalize()
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
    // Same canonicalization as load, so a runtime navigation to the bare route
    // (`/#/codebuddy`) also settles on a concrete subpage.
    if (this.active) this.canonicalize()
    if (`${this.active}:${this.page}` !== before) {
      this.snapshot = { active: this.active, page: this.page }
      for (const listener of this.listeners) listener()
    }
  }

  private syncFromHash(): void {
    const hash = this.browser.location.hash
    this.active = isPanelHash(hash)
    this.page = pageFromHash(hash)
  }

  /** 把裸路由/未知子页改写成规范子页，不新增历史记录。 */
  private canonicalize(): void {
    const canonical = PANEL_HASHES[this.page]
    if (this.browser.location.hash === canonical) return
    const history = this.browser.history
    if (history === undefined) {
      // No history handle (minimal test browser): a plain hash write still
      // lands on the canonical page, at the cost of one history entry.
      this.browser.location.hash = canonical
      return
    }
    // `replaceState` rewrites the address bar without pushing an entry, so a
    // refresh of the bare route leaves no extra Back step behind.
    history.replaceState(null, '', canonical)
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
