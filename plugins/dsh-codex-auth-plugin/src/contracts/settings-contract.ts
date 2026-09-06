/** Node-free settings contract shared by the Host plugin and browser card. */

/** Stable settings section owned by the Codex Auth plugin. */
export interface CodexAuthSettingsConfig {
  /** Register the optional view_image tool for image-capable Codex models. */
  enableImageTool: boolean
  /** Allow image-capable Codex models to receive images uploaded in the conversation. */
  enableImageUpload: boolean
}

/** Keep the plugin's initial image-capability state aligned with DSH's default UI behavior. */
export const DEFAULT_CODEX_AUTH_SETTINGS: Readonly<CodexAuthSettingsConfig> = Object.freeze({
  enableImageTool: true,
  enableImageUpload: true,
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Narrow the settings wire payload before it enters React state. */
export function decodeCodexAuthSettings(value: unknown): CodexAuthSettingsConfig | undefined {
  if (!isRecord(value) || typeof value['enableImageTool'] !== 'boolean') return undefined
  return {
    enableImageTool: value['enableImageTool'],
    enableImageUpload: typeof value['enableImageUpload'] === 'boolean'
      ? value['enableImageUpload']
      : DEFAULT_CODEX_AUTH_SETTINGS.enableImageUpload,
  }
}
