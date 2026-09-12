
/** CodeBuddy 类型声明；由原模块抽取，运行时实现保留在 src 下。 */
import type { PANEL_HASHES } from '../../client/panel-route.ts'

export type PanelRoute = keyof typeof PANEL_HASHES
export type PanelBrowser = {
  location: { hash: string }
  /** 可选：规范化使用 `replaceState`，刷新不会新增历史条目。 */
  history?: { replaceState: (data: unknown, unused: string, url?: string | URL | null) => void }
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}
