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

  it('FNOS-002-TP-006-TC-002: ignores invalid numeric fields without inventing a percentage', () => {
    const usage = normalizeCodexUsagePayload({
      rate_limit: {
        primary_window: { used_percent: 'not-a-number', limit_window_seconds: 18_000 },
        secondary_window: { remaining_percent: null, reset_after_seconds: 'invalid' },
      },
    })

    expect(usage.primaryWindow).toEqual({ limitWindowSeconds: 18_000 })
    expect(usage.secondaryWindow).toBeUndefined()
  })

  it('RISK-003-ETP-1-TC-002/003: clamps both percentage boundaries before the UI consumes them', () => {
    const usage = normalizeCodexUsagePayload({
      rate_limit: {
        primary_window: { remaining_percent: -10 },
        secondary_window: { used_percent: -10 },
      },
    })

    expect(usage.primaryWindow?.remainingPercent).toBe(0)
    expect(usage.secondaryWindow?.remainingPercent).toBe(100)

    const overLimit = normalizeCodexUsagePayload({
      rate_limit: { primary_window: { remaining_percent: 101 } },
    })
    expect(overLimit.primaryWindow?.remainingPercent).toBe(100)
  })

  it('RISK-001-ETP-1-TC-001: rejects a non-object upstream response instead of exposing unsafe data', () => {
    expect(() => normalizeCodexUsagePayload(null)).toThrow('Codex usage response was not an object')
    expect(() => normalizeCodexUsagePayload([])).toThrow('Codex usage response was not an object')
  })
})
