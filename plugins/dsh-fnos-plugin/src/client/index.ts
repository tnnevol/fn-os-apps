/** Browser half of the fnOS-specific DSH integration plugin. */

import '../styles/index.scss'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InputTriggerServiceContract, InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { AuthorizedDirectoriesCard } from '../components/AuthorizedDirectoriesCard.tsx'
import { FnosInputPickerButton } from '../components/FnosInputPickerButton.tsx'
import { FnosSessionLogHeaderAction } from '../components/FnosSessionLogHeaderAction.tsx'
import { insertFnosReferences } from './input-references/input-reference-actions.ts'
import { FNOS_REFERENCE_SOURCE, fnosReferencePromptText, type FnosInputReference, type InputSnapshotForReference } from './input-references/input-references.ts'
import type { FnosLocaleKey } from './locales.ts'
import { en, zh } from './locales.ts'
import { installFnosRemotePathOpener } from './services/path-opener.ts'
import { FnosSettingsDocumentAction } from '../components/FnosSettingsDocumentAction.tsx'
import { FnosWebRestartAction } from '../components/FnosWebRestartAction.tsx'
import { installFnosBrowserRefreshShortcut } from './shortcuts/browser-refresh-shortcut.ts'
import { installFnosSettingsShortcut } from './shortcuts/settings-shortcut.ts'
import { isEmbeddedFnosFrame } from './services/sdk-carrier.ts'
import { createTrimApp } from './services/sdk.ts'
import { installFnosPageTitle } from './services/sdk-title.ts'
import { createThemeBridge } from './services/theme-bridge.ts'
import { createThemePersistence } from './services/theme-persistence.ts'
import { createThemeController } from './services/theme-controller.ts'
import { installWorkspaceAuthorizedShortcut } from './shortcuts/workspace-authorized-shortcut.ts'
import { FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NAMESPACE } from '../contracts/authorized-directories-contract.ts'
import type { FnosSettings, FnosTheme } from '../contracts/theme-contract.ts'
import { installSemiDshTheme } from '@tnnevol/dsh-semi-ui'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.dsh-fnos': FnosLocaleKey
  }
}

export const name = 'dsh-fnos-plugin-client'
export const inject = ['theme', 'slots', 'locale', 'sessions', 'inputTriggers', 'remote', 'remote.session', 'settingsScope', 'sessionLogDownload']

type SessionLogDownloadState = {
  bySession: Record<string, { open: boolean, status: 'downloading' | 'success' | 'error', error: string | null } | undefined>
}

type SessionLogDownloadStore = {
  getSnapshot: () => SessionLogDownloadState
  subscribe: (listener: () => void) => () => void
}

type SessionLogDownloadController = {
  store: SessionLogDownloadStore
  download: (sessionId: SessionId) => Promise<void>
  dismiss: (sessionId: SessionId) => void
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => installSemiDshTheme(), 'dsh-fnos: Semi DSH theme')
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

  ctx.effect(() => installFnosRemotePathOpener(ctx.remote.session, {
    createSdk: createTrimApp,
    message: key => t(key),
  }), 'dsh-fnos: fnOS path opener')
  ctx.effect(() => installFnosPageTitle(createTrimApp), 'dsh-fnos: fnOS page title')
  ctx.effect(() => installFnosBrowserRefreshShortcut(), 'dsh-fnos: browser refresh shortcut')
  ctx.effect(() => installFnosSettingsShortcut(), 'dsh-fnos: settings shortcut')
  ctx.effect(() => installWorkspaceAuthorizedShortcut(t), 'dsh-fnos: workspace authorized shortcut')

  const source: InputTriggerSource = {
    trigger: '@',
    name: FNOS_REFERENCE_SOURCE,
    candidates: async () => [],
    onPick: () => undefined,
    codec: {
      clipboardText: ref => fnosReferencePromptText(ref),
      serialize: async ref => fnosReferencePromptText(ref),
    },
  }
  const inputTriggers = ctx.get('inputTriggers') as InputTriggerServiceContract
  ctx.effect(() => {
    const unregister = inputTriggers.registerSource(source)
    return unregister
  }, 'dsh-fnos: fnOS input reference source')

  if (isEmbeddedFnosFrame()) {
    ctx.slots.inject('conversation.session.header.utilities', () => {
      const sessionLogDownload = ctx.get('sessionLogDownload') as SessionLogDownloadController | undefined
      if (sessionLogDownload === undefined) throw new Error('sessionLogDownload service is unavailable')
      return ctx.slots.register({
        name: 'conversation.session.header.utilities',
        id: 'session-log-download',
        order: 0,
        priority: -1,
        locale: namespace,
        inject: (sessionId) => ({
          hooks: { sessionLogDownload: sessionLogDownload.store },
          sessionId,
          exportToComputer: (sessionId: SessionId) => sessionLogDownload.download(sessionId),
          dismissDownload: (sessionId: SessionId) => { sessionLogDownload.dismiss(sessionId) },
        }),
      }, FnosSessionLogHeaderAction)
    })
    ctx.slots.inject('settings.action', () => ctx.slots.register({
      name: 'settings.action',
      id: 'open-document',
      order: 0,
      priority: -1,
      locale: namespace,
      inject: () => ({ t }),
    }, FnosSettingsDocumentAction))
  }
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: 'dsh-fnos-authorized-directories',
    // Keep the fnOS card after DSH's built-in configurable plugin cards.
    priority: 100,
    inject: () => ({ t }),
  }, AuthorizedDirectoriesCard))
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'dsh-fnos-web-restart',
    order: 0,
    priority: -1,
    locale: namespace,
    inject: () => ({ t }),
  }, FnosWebRestartAction))
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'dsh-fnos-input-picker',
    order: 100,
    locale: namespace,
    inject: (sessionId: string) => ({
      insertReferences: (input: InputSnapshotForReference, references: readonly FnosInputReference[]) => insertFnosReferences(ctx, sessionId as SessionId, references, input),
    }),
  }, FnosInputPickerButton))
}
