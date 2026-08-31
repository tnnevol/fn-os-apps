import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { installSemiDshTheme } from '@tnnevol/dsh-semi-ui'
import { SemiUiHeaderAction } from './SemiUiHeaderAction.tsx'
import { ShowcasePage } from './ShowcasePage.tsx'
import { ShowcaseRouteController } from './route.ts'
import { ShowcaseThemeController } from './theme-preview.ts'

export const name = 'dsh-semi-ui-showcase-plugin-client'
export const inject = ['slots', 'theme']

export function apply(ctx: ClientContext): void {
  const route = new ShowcaseRouteController()
  const theme = new ShowcaseThemeController(ctx.theme.getTheme(), preference => { ctx.theme.setTheme(preference) })
  ctx.effect(() => installSemiDshTheme(), 'dsh-semi-ui-showcase: shared theme')
  ctx.effect(() => route.install(), 'dsh-semi-ui-showcase: hash route')
  ctx.effect(() => {
    const offThemeChange = ctx.on('theme/change', snapshot => { theme.sync(snapshot) })
    return () => {
      offThemeChange()
      theme.dispose()
    }
  }, 'dsh-semi-ui-showcase: theme preview state')
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'dsh-semi-ui-showcase',
    order: 100,
    inject: () => ({ route }),
  }, SemiUiHeaderAction))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'dsh-semi-ui-showcase',
    order: 100,
    inject: () => ({ route, theme }),
  }, ShowcasePage))
}
