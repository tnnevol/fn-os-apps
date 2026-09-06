/** Browser half of the standalone Codex OAuth plugin. */

import '../styles/index.scss'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { CodexAuthSection } from '../components/CodexAuthSection.tsx'
import type { CodexAuthSectionProps } from '../components/CodexAuthSection.tsx'
import { CodexUsageStatus } from '../components/CodexUsageStatus.tsx'
import type { CodexUsageStatusProps } from '../components/CodexUsageStatus.tsx'
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
export const inject = ['slots', 'locale', 'connection', 'remote', 'remote.session', 'timer']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => installSemiDshTheme(), 'dsh-codex-auth-plugin: Semi DSH theme')
  const namespace = 'settings.dsh-codex-auth'
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'dsh-codex-auth-plugin: locale')
  const t = ctx.locale.bind(namespace) as CodexAuthSectionProps['t']
  const connection = ctx.get('connection') as ConnectionHandle
  // DSH exposes the merged Remote API on `ctx.remote`. Using `ctx.get('remote')`
  // only resolves the base service and omits namespaces such as `session`.
  const remote = ctx.remote as unknown
  const timer = ctx.get('timer') as CodexUsageStatusProps['timer']
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'codex-auth',
    order: 24,
    label: () => t('title'),
    inject: (): CodexAuthSectionProps => ({ t, connection, remote }),
  }, CodexAuthSection))
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right',
    id: 'codex-usage',
    order: 1,
    inject: (): CodexUsageStatusProps => ({ t, timer }),
  }, CodexUsageStatus))
}
