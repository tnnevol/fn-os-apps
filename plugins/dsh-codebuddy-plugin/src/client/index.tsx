/** Browser half of the CodeBuddy plugin. */

import '../styles/index.scss'
import '../styles/panel-layout.scss'
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
import { CodeBuddyPanelPage } from './panel.tsx'
import { PanelRouteController } from './panel-route.ts'
import { bumpAccountEpoch } from './account-epoch.ts'
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
export const inject = ['slots', 'locale', 'connection', 'remote']

export function apply(ctx: ClientContext): void {
  const panelRoute = new PanelRouteController()
  // 账号切换后 host 广播 llm/adapters-updated；bump 代际让用量指示器与管理面板
  // 各页即时重拉账号相关数据（模型选择器由 harness 目录自己刷新）。
  const remote = (ctx as unknown as { remote?: { $on: (event: string, listener: () => void) => () => void } }).remote
  ctx.effect(() => {
    if (remote === undefined) return () => {}
    const off = remote.$on('llm/adapters-updated', () => { bumpAccountEpoch() })
    return () => { off() }
  }, 'dsh-codebuddy-plugin: account epoch sync')
  ctx.effect(() => panelRoute.install(), 'dsh-codebuddy-plugin: panel hash route')
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
    inject: (): CodeBuddySectionProps => ({ rpc, t, panelRoute }),
  }, CodeBuddySection))

  // Live quota readout lives in the composer dock, matching the Codex plugin.
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right',
    id: 'codebuddy-usage',
    order: 2,
    inject: (): CodeBuddyUsageStatusProps => ({ t, timer, rpc }),
  }, CodeBuddyUsageStatus))

  // 全页面管理面板（hash 路由隔离，非动态组件切换）。shell.overlay 的键由
  // dsh-client-ui-layout 的运行时 SlotMap 提供，但其类型包不在本插件的依赖
  // 图里，所以注入走与 showcase 插件相同的字符串键（运行时等价）。
  const slots = ctx.slots as unknown as {
    inject: (key: string, factory: () => () => void) => () => void
    register: (options: Record<string, unknown>, component: unknown) => () => void
  }
  slots.inject('shell.overlay', () => slots.register({
    name: 'shell.overlay',
    id: 'codebuddy-panel',
    order: 120,
    inject: () => ({ rpc, route: panelRoute, t }),
  }, CodeBuddyPanelPage))
}
