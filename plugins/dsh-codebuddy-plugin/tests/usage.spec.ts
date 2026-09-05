import { describe, expect, it } from 'vitest'
import { parseUsage } from '../src/usage.ts'

describe('CodeBuddy usage parsing', () => {
  it('parses a personal get-user-resource reply', () => {
    const raw = {
      data: {
        Response: {
          Data: {
            Accounts: [
              {
                PackageCode: 'p_pro',
                CycleCapacitySizePrecise: 1000,
                CycleCapacityRemainPrecise: 400,
                CycleEndTime: '2025-12-31 23:59:59',
              },
            ],
          },
        },
      },
    }
    const snapshot = parseUsage(raw)
    expect(snapshot?.primary?.name).toBe('p_pro')
    expect(snapshot?.primary?.used).toBe(600)
    expect(snapshot?.primary?.limit).toBe(1000)
    expect(snapshot?.primary?.usedPercent).toBe(60)
    expect(snapshot?.primary?.resetsAt).toBe('2026-01-01 00:00:00')
  })

  it('parses an enterprise get-enterprise-user-usage reply', () => {
    const raw = {
      data: {
        limitNum: 5000,
        credit: 1500,
        cycleResetTime: '2025-12-31 00:00:00',
      },
    }
    const snapshot = parseUsage(raw)
    expect(snapshot?.primary?.name).toBe('enterprise')
    expect(snapshot?.primary?.used).toBe(1500)
    expect(snapshot?.primary?.limit).toBe(5000)
    expect(snapshot?.primary?.usedPercent).toBe(30)
  })

  it('returns undefined when the body carries nothing parseable', () => {
    expect(parseUsage({ data: {} })).toBeUndefined()
    expect(parseUsage({})).toBeUndefined()
  })
})
