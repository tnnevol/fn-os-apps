/** Browser half of the fnOS-specific DSH integration plugin. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'

interface ThemeBridge {
  media: MediaQueryList
  getTheme(): 'light' | 'dark' | null
  subscribe(listener: (theme: 'light' | 'dark' | null) => void): () => void
  connect(): Promise<() => void | Promise<void>>
  disconnect(): void | Promise<void>
}

declare global {
  // eslint-disable-next-line no-var
  var __DSH_FNOS_THEME_BRIDGE__: ThemeBridge | undefined
}

export const name = 'dsh-fnos-plugin-client'
export const inject = ['theme']

const DARK_ATTRIBUTE = 'data-ds-dark-theme'
let systemFallbackActive = false
let previousColorScheme: string | undefined
let previousDarkAttribute: boolean | undefined

function applySystemTheme(theme: 'light' | 'dark' | null): void {
  if (theme === null || typeof document === 'undefined') return
  if (!systemFallbackActive) {
    previousColorScheme = document.documentElement.style.colorScheme
    previousDarkAttribute = document.body?.hasAttribute(DARK_ATTRIBUTE)
  }
  const dark = theme === 'dark'
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document.body?.toggleAttribute(DARK_ATTRIBUTE, dark)
  systemFallbackActive = true
}

function clearSystemThemeFallback(): void {
  if (!systemFallbackActive || typeof document === 'undefined') return
  if (previousColorScheme === '') document.documentElement.style.removeProperty('color-scheme')
  else if (previousColorScheme !== undefined) document.documentElement.style.colorScheme = previousColorScheme
  if (previousDarkAttribute === true) document.body?.setAttribute(DARK_ATTRIBUTE, '')
  else if (previousDarkAttribute === false) document.body?.removeAttribute(DARK_ATTRIBUTE)
  previousColorScheme = undefined
  previousDarkAttribute = undefined
  systemFallbackActive = false
}

/**
 * DSH rc.7 exposes the theme registry as a service but does not expose a
 * public "re-resolve system preference" method. The bridge uses the existing
 * media slot plus the runtime's publish seam when present, and always keeps a
 * direct DOM fallback for a future incompatible runtime.
 */
function refreshSystemTheme(ctx: ClientContext, bridge: ThemeBridge): void {
  const theme = ctx.theme
  if (theme.getTheme().preference !== 'system') {
    clearSystemThemeFallback()
    return
  }

  const runtime = theme as unknown as {
    media?: MediaQueryList
    publish?: () => void
  }
  if (runtime.media !== bridge.media) runtime.media = bridge.media
  runtime.publish?.()
  applySystemTheme(bridge.getTheme())
}

export function apply(ctx: ClientContext): void {
  const bridge = globalThis.__DSH_FNOS_THEME_BRIDGE__
  if (bridge === undefined) return

  const runtime = ctx.theme as unknown as { media?: MediaQueryList }
  const previousMedia = runtime.media
  const unsubscribe = bridge.subscribe(() => { refreshSystemTheme(ctx, bridge) })
  const offThemeChange = ctx.on('theme/change', () => { refreshSystemTheme(ctx, bridge) })

  ctx.effect(() => {
    runtime.media = bridge.media
    refreshSystemTheme(ctx, bridge)
    void bridge.connect().catch(error => {
      console.debug('[dsh-fnos] unable to connect to fnOS theme events', error)
    })
    return async () => {
      unsubscribe()
      offThemeChange()
      await bridge.disconnect()
      clearSystemThemeFallback()
      if (runtime.media === bridge.media) {
        if (previousMedia === undefined) delete runtime.media
        else runtime.media = previousMedia
      }
    }
  }, 'dsh-fnos: fnOS theme bridge')
}
