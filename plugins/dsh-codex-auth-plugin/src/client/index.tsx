/** Browser half of the standalone Codex OAuth plugin. */

import './style.scss'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { CodexAuthCard } from './CodexAuthCard.tsx'
import type { CodexAuthCardInjected } from './CodexAuthCard.tsx'
import { CodexUsageStatus } from './CodexUsageStatus.tsx'
import type { CodexUsageStatusProps } from './CodexUsageStatus.tsx'
import { decodeCodexAuthSettings } from '../settings-contract.ts'
import { installCodexModelEditorPresentation } from './model-editor-presentation.ts'
import { CodexAuthRemoteSettingsScope } from './remote-settings-scope.ts'
import { CODEX_AUTH_SETTINGS_NAMESPACE } from '../auth-paths.ts'
import { en, zh } from './locales.ts'
import type { CodexAuthLocaleKey } from './locales.ts'
import { installSemiDshTheme } from '@tnnevol/dsh-semi-ui'

// Keep the renderer-provided slot service visible to consumers that resolve the
// renderer package through a different peer dependency path.
declare module '@deepseek-ai/cordis' {
  interface Context {
    slots: SlotRegistry
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.dsh-codex-auth': CodexAuthLocaleKey
  }
}

export const name = 'dsh-codex-auth-plugin-client'
export const inject = ['slots', 'locale', 'connection', 'remote', 'remote.session', 'settingsScope', 'timer']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => installSemiDshTheme(), 'dsh-codex-auth-plugin: Semi DSH theme')
  ctx.effect(
    () => installCodexModelEditorPresentation(),
    'dsh-codex-auth-plugin: Codex model editor presentation',
  )
  const namespace = 'settings.dsh-codex-auth'
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'dsh-codex-auth-plugin: locale')
  const t = ctx.locale.bind(namespace) as CodexAuthCardInjected['t']
  const connection = ctx.get('connection') as ConnectionHandle
  // DSH exposes the merged Remote API on `ctx.remote`. Using `ctx.get('remote')`
  // only resolves the base service and omits namespaces such as `session`.
  const remote = ctx.remote as unknown
  const timer = ctx.get('timer') as CodexUsageStatusProps['timer']
  const remoteScope = connection.isLoopback ? undefined : new CodexAuthRemoteSettingsScope()
  const configScope = remoteScope ?? ctx.settingsScope.bind({
    namespace: CODEX_AUTH_SETTINGS_NAMESPACE,
    decode: decodeCodexAuthSettings,
  })
  if (remoteScope !== undefined) {
    ctx.effect(() => {
      void remoteScope.load()
      return async () => {
        await remoteScope.dispose()
      }
    }, 'dsh-codex-auth-plugin: remote settings scope')
  }
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: CODEX_AUTH_SETTINGS_NAMESPACE,
    inject: (): CodexAuthCardInjected => ({ t, configScope, connection, remote }),
  }, CodexAuthCard))
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right',
    id: 'codex-usage',
    order: 1,
    inject: (): CodexUsageStatusProps => ({ t, timer }),
  }, CodexUsageStatus))
}
