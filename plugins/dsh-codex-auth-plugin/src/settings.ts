/** Host settings registration that makes the standalone auth card discoverable. */

import z from '@deepseek-ai/schemastery'
import { CODEX_AUTH_SETTINGS_NAMESPACE } from './auth-paths.ts'
import { DEFAULT_CODEX_AUTH_SETTINGS } from './settings-contract.ts'

/** Branded namespace used by the Host settings service. */
export const CODEX_AUTH_SETTINGS_NS = CODEX_AUTH_SETTINGS_NAMESPACE

/** Settings schema for the plugin card and its optional image capability. */
export const CodexAuthSettingsSchema = z.object({
  enableImageTool: z.boolean().default(DEFAULT_CODEX_AUTH_SETTINGS.enableImageTool),
  enableImageUpload: z.boolean().default(DEFAULT_CODEX_AUTH_SETTINGS.enableImageUpload),
})
