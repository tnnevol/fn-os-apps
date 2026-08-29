/** Browser-only DSH bundle host entry. */
import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'

export const name = '@tnnevol/dsh-semi-ui-showcase'
export const SEMI_UI_SHOWCASE_SETTINGS_NAMESPACE = 'dsh-semi-ui-showcase'
const SEMI_UI_SHOWCASE_SETTINGS_NS = settingsNamespace(SEMI_UI_SHOWCASE_SETTINGS_NAMESPACE)
const SemiUiShowcaseSettingsSchema = z.object({})

export const inject = ['settings']

export function apply(ctx: Context): void {
  // The configurable plugins tab only dispatches cards for namespaces served by
  // the Host settings provider. This intentionally empty section makes the
  // read-only showcase card discoverable without creating user configuration.
  ctx.settings.register(SEMI_UI_SHOWCASE_SETTINGS_NS, SemiUiShowcaseSettingsSchema)
}
