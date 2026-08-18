/** Browser half of the standalone Codex OAuth plugin. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { CodexAuthCard } from './CodexAuthCard.tsx'
import type { CodexAuthCardInjected } from './CodexAuthCard.tsx'
import { decodeCodexAuthSettings } from '../settings-contract.ts'
import { installCodexModelEditorPresentation } from './model-editor-presentation.ts'
import { CODEX_AUTH_SETTINGS_NAMESPACE } from '../auth-paths.ts'
import { en, zh } from './locales.ts'
import type { CodexAuthLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.dsh-codex-auth': CodexAuthLocaleKey
  }
}

export const name = 'dsh-codex-auth-plugin-client'
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => installCodexModelEditorPresentation(),
    'dsh-codex-auth-plugin: Codex model editor presentation',
  )
  const namespace = 'settings.dsh-codex-auth'
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'dsh-codex-auth-plugin: locale')
  const t = ctx.locale.bind(namespace) as CodexAuthCardInjected['t']
  const configScope = ctx.settingsScope.bind({
    namespace: CODEX_AUTH_SETTINGS_NAMESPACE,
    decode: decodeCodexAuthSettings,
  })
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: CODEX_AUTH_SETTINGS_NAMESPACE,
    inject: (): CodexAuthCardInjected => ({ t, configScope }),
  }, CodexAuthCard))
}
