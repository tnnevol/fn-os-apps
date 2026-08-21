/** Shared contract for the fnOS theme snapshot persisted by the plugin. */

export type FnosTheme = 'light' | 'dark'

/** Host-backed settings owned by the fnOS integration plugin. */
export interface FnosSettings {
  /** Last resolved fnOS theme while DSH is configured to follow the system. */
  systemTheme?: FnosTheme
}

export const FNOS_SYSTEM_THEME_FIELD = 'systemTheme'

export function isFnosTheme(value: unknown): value is FnosTheme {
  return value === 'light' || value === 'dark'
}
