/** Shared constants for the CodeBuddy client bundle. */

/** The RPC channel the host auth service listens on (mirror of the host constant). */
export const CODEBUDDY_AUTH_CHANNEL = '/codebuddy'

/** How often the composer usage indicator refreshes, in ms. */
export const CODEBUDDY_USAGE_REFRESH_MS = 60_000

/** LocalStorage keys for the UI-only usage preferences. */
export const CODEBUDDY_SHOW_USAGE_KEY = 'dsh-codebuddy:show-usage'
export const CODEBUDDY_AUTO_SWITCH_KEY = 'dsh-codebuddy-auto-switch'
export const CODEBUDDY_AUTO_CHECKIN_KEY = 'dsh-codebuddy-auto-checkin'
export const CODEBUDDY_AUTO_TRAVEL_KEY = 'dsh-codebuddy-auto-travel'
