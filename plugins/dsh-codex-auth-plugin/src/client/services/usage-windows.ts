/** Shared Codex usage-window selection for settings and composer status. */

export const FIVE_HOUR_WINDOW_SECONDS = 5 * 60 * 60
export const WEEKLY_WINDOW_SECONDS = 7 * 24 * 60 * 60

export interface CodexUsageWindow {
  remainingPercent?: number
  limitWindowSeconds?: number
  resetAfterSeconds?: number
  resetAt?: number
}

export interface CodexUsageWindows {
  primaryWindow?: CodexUsageWindow
  secondaryWindow?: CodexUsageWindow
}

function windowByDuration(usage: CodexUsageWindows, duration: number): CodexUsageWindow | undefined {
  return [usage.primaryWindow, usage.secondaryWindow]
    .find(window => window?.limitWindowSeconds === duration)
}

/** Return the five-hour window only when the API explicitly declares it. */
export function fiveHourWindow(usage: CodexUsageWindows): CodexUsageWindow | undefined {
  return windowByDuration(usage, FIVE_HOUR_WINDOW_SECONDS)
}

/** Return the weekly window only when the API explicitly declares it. */
export function weeklyWindow(usage: CodexUsageWindows): CodexUsageWindow | undefined {
  return windowByDuration(usage, WEEKLY_WINDOW_SECONDS)
}

/** The compact composer status favors the nearest five-hour limit. */
export function compactUsageWindow(usage: CodexUsageWindows): CodexUsageWindow | undefined {
  return fiveHourWindow(usage) ?? weeklyWindow(usage)
}
