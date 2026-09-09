/**
 * Local usage-indicator preferences shared by the settings page and the
 * composer indicator.
 *
 * These are UI-only affordances with no business meaning beyond the display,
 * so they live in `localStorage` rather than a Host user-settings document.
 * The store is module-scoped so the settings controls and the composer
 * indicator share one source of truth, and `storage` events keep other tabs
 * in sync without a Host round-trip.
 */

import {
  CODEBUDDY_AUTO_SWITCH_KEY,
  CODEBUDDY_SHOW_USAGE_KEY,
} from './constants.ts'

const usagePrefListeners = new Set<() => void>()

function emitUsagePref(): void {
  for (const listener of usagePrefListeners) listener()
}

/** Subscribe to preference changes; returns the disposer. */
export function subscribeUsagePref(listener: () => void): () => void {
  usagePrefListeners.add(listener)
  return () => { usagePrefListeners.delete(listener) }
}

/** Read the persisted show/hide preference; defaults to shown when unset. */
export function getUsagePref(): boolean {
  try {
    return window.localStorage.getItem(CODEBUDDY_SHOW_USAGE_KEY) !== '0'
  } catch {
    return true
  }
}

/** Persist the show/hide preference and notify every subscriber in every tab. */
export function setUsagePref(value: boolean): void {
  try {
    window.localStorage.setItem(CODEBUDDY_SHOW_USAGE_KEY, value ? '1' : '0')
  } catch {
    // A private-mode storage refusal still updates the in-memory listeners.
  }
  emitUsagePref()
}

/** The auto-switch remaining-percentage threshold; defaults to 10. */
export function getAutoSwitchThresholdPref(): number {
  try {
    const raw = window.localStorage.getItem(`${CODEBUDDY_AUTO_SWITCH_KEY}:threshold`)
    if (raw === null) return 10
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? Math.round(parsed) : 10
  } catch {
    return 10
  }
}

/** Persist the auto-switch threshold and notify subscribers. */
export function setAutoSwitchThresholdPref(value: number): void {
  try {
    window.localStorage.setItem(`${CODEBUDDY_AUTO_SWITCH_KEY}:threshold`, String(Math.round(value)))
  } catch {
    // See setUsagePref.
  }
  emitUsagePref()
}

/** Read the auto-switch preference; defaults to on. */
export function getAutoSwitchPref(): boolean {
  try {
    return window.localStorage.getItem(CODEBUDDY_AUTO_SWITCH_KEY) !== '0'
  } catch {
    return true
  }
}

/** Persist the auto-switch preference and notify subscribers. */
export function setAutoSwitchPref(value: boolean): void {
  try {
    window.localStorage.setItem(CODEBUDDY_AUTO_SWITCH_KEY, value ? '1' : '0')
  } catch {
    // See setUsagePref.
  }
  emitUsagePref()
}

// Cross-tab sync: a `storage` event fires in every *other* tab when any key
// changes, so each tab's indicator and controls re-read without a Host call.
if (typeof window !== 'undefined' && window.localStorage !== undefined) {
  window.addEventListener('storage', (event) => {
    if (event.key === CODEBUDDY_SHOW_USAGE_KEY
      || event.key === CODEBUDDY_AUTO_SWITCH_KEY
      || event.key === null) {
      emitUsagePref()
    }
  })
}
