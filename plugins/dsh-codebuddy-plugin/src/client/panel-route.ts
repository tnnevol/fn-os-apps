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
 * @param hash - 原始 `location.hash` 取值。
 * @returns 面板是否拥有该 hash。
 */
function isPanelHash(hash: string): boolean {
  return hash === PANEL_PREFIX || hash.startsWith(`${PANEL_PREFIX}/`)
}

/**
 * 解析 hash 指向的页面，缺省落到入口页。
 * @param hash - 原始 `location.hash` 取值。
 * @returns 被指向的页面；hash 无法识别时返回入口页。
 */
function pageFromHash(hash: string): PanelRoute {
  return entries.find(([, h]) => h === hash)?.[0] ?? DEFAULT_PAGE
}

type PanelBrowser = {
  location: { hash: string }
  /** 可选：规范化使用 `replaceState`，刷新不会新增历史条目。 */
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
    // 裸面板 hash 或无法识别的面板 hash 会被改写为规范子页。
    // 不这样做的话，书签里的 `/#/codebuddy` 能渲染面板，但留下的 URL
    // 只有本匹配器的前缀规则才认得；加载时即规范化，地址栏与之后的
    // 刷新就都不再有歧义。
    if (this.active) this.canonicalize()
    // `useSyncExternalStore` 会在 effects 运行前读取快照。在这里先填充
    // 快照，直接刷新 #/codebuddy/accounts 才能停留在面板上，而不是短暂
    // （或永久）回落到会话页。
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
    // 与加载时相同的规范化，这样运行期导航到裸路由（`/#/codebuddy`）
    // 也会落定在具体子页上。
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
      // 没有 history 句柄（最小化测试浏览器）：直接写 hash 也能落到规范页，
      // 代价是多一条历史记录。
      this.browser.location.hash = canonical
      return
    }
    // `replaceState` 只改写地址栏、不压入历史条目，刷新裸路由就不会
    // 留下多余的一步「后退」。
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
