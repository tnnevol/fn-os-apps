/** Shared contract for the fnOS theme snapshot persisted by the plugin. */

export type FnosTheme = 'light' | 'dark'

/** Host-backed settings owned by the fnOS integration plugin. */
export interface FnosSettings {
  /** Last resolved fnOS theme while DSH is configured to follow the system. */
  systemTheme?: FnosTheme
  /** User-managed third-party plugin API URL path prefixes. */
  gatewayProxyPaths?: string[]
}

export const FNOS_SYSTEM_THEME_FIELD = 'systemTheme'
export const FNOS_GATEWAY_PROXY_PATHS_FIELD = 'gatewayProxyPaths'

export function isFnosTheme(value: unknown): value is FnosTheme {
  return value === 'light' || value === 'dark'
}
