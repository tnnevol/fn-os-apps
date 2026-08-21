/** Browser half of the fnOS-specific DSH integration plugin. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { InputTriggerServiceContract, InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { AuthorizedDirectoriesCard } from './AuthorizedDirectoriesCard.tsx'
import { FnosInputPickerButton } from './FnosInputPickerButton.tsx'
import { FnosInputReferencesDock } from './FnosInputReferencesDock.tsx'
import { insertFnosReferences } from './input-reference-actions.ts'
import { FNOS_REFERENCE_SOURCE, decodeFnosReference, fileUrlForPath } from './input-references.ts'
import type { FnosLocaleKey } from './locales.ts'
import { en, zh } from './locales.ts'
import { installFnosPathOpener } from './path-opener.ts'
import { createTrimApp } from './sdk.ts'
import { createThemeBridge, type ThemeBridge } from './theme-bridge.ts'
import { createThemePersistence } from './theme-persistence.ts'
import { installWorkspaceAuthorizedShortcut } from './workspace-authorized-shortcut.ts'
import { FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NAMESPACE } from '../authorized-directories-contract.ts'
import type { FnosSettings, FnosTheme } from '../theme-contract.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.dsh-fnos': FnosLocaleKey
  }
}

export const name = 'dsh-fnos-plugin-client'
export const inject = ['theme', 'slots', 'locale', 'sessions', 'inputTriggers', 'workspaces', 'settingsScope']

const DARK_ATTRIBUTE = 'data-ds-dark-theme'

/**
 * Keep DSH's saved preference unchanged. When it is set to "system", apply
 * the fnOS theme to the document after the SDK bridge has supplied the real
 * NAS state and persist that resolved state for the next Host bootstrap. For
 * explicit light/dark preferences, DSH remains authoritative and the stale
 * fnOS snapshot is removed.
 */
function createThemeController(
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

  const clearSystemTheme = (): void => {
    if (systemFallbackActive && typeof document !== 'undefined') {
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
      persistence.sync(preference, null)
      clearSystemTheme()
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
      clearSystemTheme()
    },
  }
}

export function apply(ctx: ClientContext): void {
  const bridge = createThemeBridge()
  const fnosSettings = ctx.settingsScope.bind<FnosSettings>({
    namespace: FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NAMESPACE,
  })
  {
    const controller = createThemeController(ctx, bridge, createThemePersistence(fnosSettings))

    ctx.effect(() => {
      const unsubscribe = bridge.subscribe(() => { controller.refresh() })
      const unsubscribeSettings = fnosSettings.subscribe(() => { controller.refresh() })
      const offThemeChange = ctx.on('theme/change', () => { controller.refresh() })
      controller.refresh()
      void bridge.connect().catch(error => {
        console.debug('[dsh-fnos] unable to connect to fnOS theme events', error)
      })

      return async () => {
        unsubscribe()
        unsubscribeSettings()
        offThemeChange()
        await bridge.disconnect()
        controller.dispose()
      }
    }, 'dsh-fnos: fnOS theme bridge')
  }

  const namespace = 'settings.dsh-fnos'
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'dsh-fnos: locale')
  const t = ctx.locale.bind(namespace) as (key: FnosLocaleKey) => string

  ctx.effect(() => installFnosPathOpener(ctx.workspaces, {
    createSdk: createTrimApp,
    message: key => t(key),
  }), 'dsh-fnos: fnOS path opener')
  ctx.effect(() => installWorkspaceAuthorizedShortcut(t), 'dsh-fnos: workspace authorized shortcut')

  const source: InputTriggerSource = {
    trigger: '@',
    name: FNOS_REFERENCE_SOURCE,
    candidates: async () => [],
    onPick: () => undefined,
    codec: {
      clipboardText: ref => {
        const decoded = decodeFnosReference(ref)
        return decoded === undefined ? ref : fileUrlForPath(decoded.path)
      },
      serialize: async ref => {
        const decoded = decodeFnosReference(ref)
        return decoded === undefined ? ref : fileUrlForPath(decoded.path)
      },
    },
  }
  const inputTriggers = ctx.get('inputTriggers') as InputTriggerServiceContract
  ctx.effect(() => {
    const unregister = inputTriggers.registerSource(source)
    return unregister
  }, 'dsh-fnos: fnOS input reference source')

  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: 'dsh-fnos-authorized-directories',
    // Keep the fnOS card after DSH's built-in configurable plugin cards.
    priority: 100,
    inject: () => ({ t }),
  }, AuthorizedDirectoriesCard))
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right',
    id: 'dsh-fnos-input-picker',
    order: 100,
    locale: namespace,
    inject: (sessionId) => ({
      insertReferences: (input, references) => insertFnosReferences(ctx, sessionId, references, input),
    }),
  }, FnosInputPickerButton))
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'dsh-fnos-input-references',
    order: 100,
    locale: namespace,
  }, FnosInputReferencesDock))
}
