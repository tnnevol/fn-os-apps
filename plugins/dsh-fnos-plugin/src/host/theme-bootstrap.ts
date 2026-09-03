/** Initial-theme helpers for the Host-side index transform. */

import { isFnosTheme, type FnosTheme } from '../contracts/theme-contract.ts'

export type DshThemePreference = FnosTheme | 'system'

/** Third-party theme ids are runtime-only and must not touch fnOS settings. */
export function isDshThemePreference(value: unknown): value is DshThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

/**
 * Resolve the cached preference that is safe to use before the Client tree
 * starts. Explicit DSH preferences remain authoritative and never use the
 * fnOS cache.
 */
export function cachedFnosThemeForBoot(
  preference: DshThemePreference,
  systemTheme: unknown,
): FnosTheme | null {
  if (preference !== 'system' || !isFnosTheme(systemTheme)) return null
  return systemTheme
}

/**
 * Replace the preference literal emitted by DSH's official ui-theme bootstrap.
 * The fnOS bundle is appended after ui-theme in the profile composition, so
 * the official script is already present when this transform runs.
 */
export function injectCachedFnosTheme(
  html: string,
  preference: DshThemePreference,
  systemTheme: unknown,
): string {
  const cachedTheme = cachedFnosThemeForBoot(preference, systemTheme)
  if (cachedTheme === null) return html
  return html.replace(
    /(const\s+preference\s*=\s*)"system"/,
    `$1${JSON.stringify(cachedTheme)}`,
  )
}
