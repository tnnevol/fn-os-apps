/** Synchronizes fnOS's resolved theme while DSH follows its system preference. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { isDshThemePreference } from '../theme-bootstrap.ts'
import type { ThemeBridge } from './theme-bridge.ts'
import type { createThemePersistence } from './theme-persistence.ts'

const DARK_ATTRIBUTE = 'data-ds-dark-theme'

/**
 * Keep DSH's explicit preferences authoritative. The fnOS theme is only a
 * temporary projection for the `system` preference and must not win a later
 * DSH light/dark selection because of listener ordering.
 */
export function createThemeController(
  ctx: ClientContext,
  bridge: ThemeBridge,
  persistence: ReturnType<typeof createThemePersistence>,
) {
  let systemFallbackActive = false
  let previousColorScheme: string | undefined
  let previousDarkAttribute: boolean | undefined

  const applySystemTheme = (theme: 'light' | 'dark'): void => {
    if (typeof document === 'undefined') return
    if (!systemFallbackActive) {
      previousColorScheme = document.documentElement.style.colorScheme
      previousDarkAttribute = document.body?.hasAttribute(DARK_ATTRIBUTE)
    }
    const dark = theme === 'dark'
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    document.body?.toggleAttribute(DARK_ATTRIBUTE, dark)
    systemFallbackActive = true
  }

  const clearSystemTheme = (restorePrevious: boolean): void => {
    if (systemFallbackActive && restorePrevious && typeof document !== 'undefined') {
      if (previousColorScheme === '') document.documentElement.style.removeProperty('color-scheme')
      else if (previousColorScheme !== undefined) document.documentElement.style.colorScheme = previousColorScheme
      if (previousDarkAttribute === true) document.body?.setAttribute(DARK_ATTRIBUTE, '')
      else if (previousDarkAttribute === false) document.body?.removeAttribute(DARK_ATTRIBUTE)
    }
    previousColorScheme = undefined
    previousDarkAttribute = undefined
    systemFallbackActive = false
  }

  const refresh = (): void => {
    const theme = ctx.theme
    const preference = theme.getTheme().preference
    if (preference !== 'system') {
      if (isDshThemePreference(preference)) persistence.sync(preference, null)
      // DSH's ThemePresenter owns explicit light/dark DOM state. Do not
      // restore the state captured before the temporary system projection.
      clearSystemTheme(false)
      return
    }

    const fnosTheme = bridge.getTheme()
    persistence.sync(preference, fnosTheme)
    if (fnosTheme === null) return

    applySystemTheme(fnosTheme)
    // DSH's ThemePresenter also listens to theme/change. Re-apply after the
    // current event turn so the fnOS state wins regardless of listener order.
    queueMicrotask(() => {
      if (ctx.theme.getTheme().preference === 'system' && bridge.getTheme() === fnosTheme) {
        applySystemTheme(fnosTheme)
      }
    })
  }

  return {
    refresh,
    dispose(): void {
      clearSystemTheme(true)
    },
  }
}
