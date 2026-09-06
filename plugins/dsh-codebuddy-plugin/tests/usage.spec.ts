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
                CycleEndTime: '2099-12-31 23:59:59',
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
    expect(snapshot?.primary?.resetsAt).toBe('2100-01-01 00:00:00')
  })

  it('prefers the human-readable PackageName over the id code', () => {
    const raw = {
      data: {
        Response: {
          Data: {
            Accounts: [
              {
                PackageCode: 'TCACA_code_008_cfWoLwvjU4',
                PackageName: 'CodeBuddy个人体验版',
                CycleCapacitySizePrecise: 500,
                CycleCapacityRemainPrecise: 260,
              },
            ],
          },
        },
      },
    }
    const snapshot = parseUsage(raw)
    expect(snapshot?.primary?.name).toBe('CodeBuddy个人体验版')
  })

  it('falls back to PackageCode when no PackageName is disclosed', () => {
    const raw = {
      data: {
        Response: {
          Data: {
            Accounts: [
              {
                PackageCode: 'TCACA_code_007_nzdH5h4Nl0',
                CycleCapacitySizePrecise: 1500,
                CycleCapacityRemainPrecise: 1500,
              },
            ],
          },
        },
      },
    }
    const snapshot = parseUsage(raw)
    expect(snapshot?.primary?.name).toBe('TCACA_code_007_nzdH5h4Nl0')
  })

  it('excludes packages whose cycle has already ended', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const pad = (n: number): string => n < 10 ? `0${n}` : String(n)
    const pastEnd = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())} 23:59:59`
    const raw = {
      data: {
        Response: {
          Data: {
            Accounts: [
              {
                PackageName: '过期套餐',
                CycleCapacitySizePrecise: 800,
                CycleCapacityRemainPrecise: 100,
                CycleEndTime: pastEnd,
              },
              {
                PackageName: '有效套餐',
                CycleCapacitySizePrecise: 500,
                CycleCapacityRemainPrecise: 250,
                CycleEndTime: '2099-12-31 23:59:59',
              },
            ],
          },
        },
      },
    }
    const snapshot = parseUsage(raw)
    expect(snapshot?.windows).toHaveLength(1)
    expect(snapshot?.primary?.name).toBe('有效套餐')
    expect(snapshot?.primary?.used).toBe(250)
    expect(snapshot?.primary?.limit).toBe(500)
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
