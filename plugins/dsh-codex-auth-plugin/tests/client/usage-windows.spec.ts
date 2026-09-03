import { describe, expect, it } from 'vitest'
import {
  compactUsageWindow,
  FIVE_HOUR_WINDOW_SECONDS,
  fiveHourWindow,
  WEEKLY_WINDOW_SECONDS,
  weeklyWindow,
} from '../../src/client/services/usage-windows.ts'

describe('Codex usage window selection', () => {
  const fiveHour = { limitWindowSeconds: FIVE_HOUR_WINDOW_SECONDS, remainingPercent: 62 }
  const weekly = { limitWindowSeconds: WEEKLY_WINDOW_SECONDS, remainingPercent: 84 }

  it('finds windows by duration instead of primary or secondary position', () => {
    const usage = { primaryWindow: weekly, secondaryWindow: fiveHour }
    expect(fiveHourWindow(usage)).toBe(fiveHour)
    expect(weeklyWindow(usage)).toBe(weekly)
  })

  it('does not guess a window when the API omits its duration', () => {
    const usage = { primaryWindow: { remainingPercent: 50 }, secondaryWindow: { remainingPercent: 75 } }
    expect(fiveHourWindow(usage)).toBeUndefined()
    expect(weeklyWindow(usage)).toBeUndefined()
  })

  it('prefers the five-hour window for the compact composer status', () => {
    expect(compactUsageWindow({ primaryWindow: weekly, secondaryWindow: fiveHour })).toBe(fiveHour)
    expect(compactUsageWindow({ primaryWindow: weekly })).toBe(weekly)
  })
})
