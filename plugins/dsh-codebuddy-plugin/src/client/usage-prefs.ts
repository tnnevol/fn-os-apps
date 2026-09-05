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
  CODEBUDDY_CUSTOM_LIMIT_KEY,
  CODEBUDDY_DANGER_PCT_KEY,
  CODEBUDDY_DEFAULT_DANGER_PCT,
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

/** Read the custom quota cap; `undefined` when unset or not a positive number. */
export function getCustomLimit(): number | undefined {
  try {
    const raw = window.localStorage.getItem(CODEBUDDY_CUSTOM_LIMIT_KEY)
    if (raw === null) return undefined
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  } catch {
    return undefined
  }
}

/** Persist the custom quota cap and notify subscribers. */
export function setCustomLimit(value: number | undefined): void {
  try {
    if (value === undefined) {
      window.localStorage.removeItem(CODEBUDDY_CUSTOM_LIMIT_KEY)
    } else {
      window.localStorage.setItem(CODEBUDDY_CUSTOM_LIMIT_KEY, String(value))
    }
  } catch {
    // See setUsagePref.
  }
  emitUsagePref()
}

/** Read the danger-percentage threshold; defaults to 90 when unset/invalid. */
export function getDangerPct(): number {
  try {
    const raw = window.localStorage.getItem(CODEBUDDY_DANGER_PCT_KEY)
    if (raw === null) return CODEBUDDY_DEFAULT_DANGER_PCT
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 && parsed <= 100 ? parsed : CODEBUDDY_DEFAULT_DANGER_PCT
  } catch {
    return CODEBUDDY_DEFAULT_DANGER_PCT
  }
}

/** Persist the danger-percentage threshold and notify subscribers. */
export function setDangerPct(value: number | undefined): void {
  try {
    if (value === undefined) {
      window.localStorage.removeItem(CODEBUDDY_DANGER_PCT_KEY)
    } else {
      window.localStorage.setItem(CODEBUDDY_DANGER_PCT_KEY, String(value))
    }
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
      || event.key === CODEBUDDY_CUSTOM_LIMIT_KEY
      || event.key === CODEBUDDY_DANGER_PCT_KEY
      || event.key === null) {
      emitUsagePref()
    }
  })
}
