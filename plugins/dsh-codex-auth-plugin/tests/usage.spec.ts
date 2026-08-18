import { describe, expect, it } from 'vitest'
import { normalizeCodexUsagePayload } from '../src/usage.ts'

describe('Codex usage normalization', () => {
  it('exposes remaining percentage instead of the upstream used percentage', () => {
    const usage = normalizeCodexUsagePayload({
      plan_type: 'plus',
      rate_limit: {
        primary_window: { used_percent: 57, limit_window_seconds: 18_000 },
        secondary_window: { used_percent: 57, limit_window_seconds: 604_800 },
      },
    })

    expect(usage.primaryWindow?.remainingPercent).toBe(43)
    expect(usage.secondaryWindow?.remainingPercent).toBe(43)
    expect(usage.primaryWindow).not.toHaveProperty('usedPercent')
  })

  it('prefers an explicit remaining percentage and keeps it in range', () => {
    const usage = normalizeCodexUsagePayload({
      rate_limit: {
        secondary_window: { used_percent: 20, remaining_percent: 140 },
      },
    })

    expect(usage.secondaryWindow?.remainingPercent).toBe(100)
  })
})
