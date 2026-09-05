/** Browser half of the CodeBuddy plugin. */

import '../styles/index.scss'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { installSemiDshTheme } from '@tnnevol/dsh-semi-ui'
import { CodeBuddySection } from '../components/CodeBuddySection.tsx'
import type { CodeBuddySectionProps } from '../components/CodeBuddySection.tsx'
import { CodeBuddyUsageStatus } from '../components/CodeBuddyUsageStatus.tsx'
import type { CodeBuddyUsageStatusProps } from '../components/CodeBuddyUsageStatus.tsx'
import { en, zh } from './locales.ts'
import type { CodeBuddyLocaleKey } from './locales.ts'
import type { ConnectionRpc } from './rpc.ts'

/** This plugin's settings namespace for copy. */
const NS = 'settings.codebuddy'

// Keep the renderer-provided slot service visible to consumers that resolve the
// renderer package through a different peer dependency path.
declare module '@deepseek-ai/cordis' {
  interface Context {
    slots: SlotRegistry
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.codebuddy': CodeBuddyLocaleKey
  }
}

type TimerService = {
  interval(callback: () => void, delay: number): () => void
}

export const name = 'dsh-codebuddy-plugin-client'
export const inject = ['slots', 'locale', 'connection']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => installSemiDshTheme(), 'dsh-codebuddy-plugin: Semi DSH theme')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-codebuddy-plugin: locale')

  const t = ctx.locale.bind(NS) as CodeBuddySectionProps['t']
  const rpc = (ctx.get('connection') as { rpc: ConnectionRpc }).rpc
  // The composer indicator refreshes on a timer service when present; the DSH
  // client exposes `ctx.timer` for this purpose. Fall back to a local timer
  // shim so the indicator still works on minimal compositions.
  const timer = (ctx.get('timer') as TimerService | undefined) ?? {
    interval(callback: () => void, delay: number): () => void {
      const id = window.setInterval(callback, delay)
      return () => { window.clearInterval(id) }
    },
  }

  // Settings page (login + usage preferences) keeps its original surface.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'codebuddy',
    order: 25,
    label: () => t('nav'),
    inject: (): CodeBuddySectionProps => ({ rpc, t }),
  }, CodeBuddySection))

  // Live quota readout lives in the composer dock, matching the Codex plugin.
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right',
    id: 'codebuddy-usage',
    order: 2,
    inject: (): CodeBuddyUsageStatusProps => ({ t, timer, rpc }),
  }, CodeBuddyUsageStatus))
}
