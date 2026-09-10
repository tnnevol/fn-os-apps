import { describe, expect, it } from 'vitest'
import { classifyResources } from '../src/client/resource-history.ts'
import type { ResourceSnapshot } from '../src/client/resource-history.ts'

const now = Date.now()

function ledgerRow(key: string, name: string, remaining: number | null, resetsAt: string | null, lastSeenAt = now - 1000): ResourceSnapshot {
  return { key, name, total: 100, remaining, resetsAt, lastSeenAt }
}

describe('resource package lifecycle classification', () => {
  it('groups a live package with allowance as usable', () => {
    const rows = classifyResources([], [{ name: '体验版', total: 100, remaining: 40, resetsAt: '2099-01-01 00:00:00' }])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.lifecycle).toBe('usable')
    expect(rows[0]!.live).toBe(true)
  })

  it('groups a live package with no allowance left as depleted', () => {
    const rows = classifyResources([], [{ name: '裂变包', total: 100, remaining: 0, resetsAt: '2099-01-01 00:00:00' }])
    expect(rows[0]!.lifecycle).toBe('depleted')
  })

  it('groups a remembered package the plane no longer returns as expired', () => {
    const ledger = [ledgerRow('旧包@2026-01-01 00:00:00', '旧包', 50, '2026-01-01 00:00:00')]
    const rows = classifyResources(ledger, [])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.lifecycle).toBe('expired')
    expect(rows[0]!.live).toBe(false)
  })

  it('treats a live package whose cycle end already passed as expired', () => {
    const rows = classifyResources([], [{ name: '过期包', total: 100, remaining: 80, resetsAt: '2020-01-01 00:00:00' }])
    expect(rows[0]!.lifecycle).toBe('expired')
    expect(rows[0]!.live).toBe(true)
  })

  it('orders usable, then depleted, then expired', () => {
    const ledger = [ledgerRow('gone@x', 'gone', 10, '2020-01-01 00:00:00')]
    const rows = classifyResources(ledger, [
      { name: 'empty', total: 100, remaining: 0, resetsAt: '2099-01-01 00:00:00' },
      { name: 'ok', total: 100, remaining: 10, resetsAt: '2099-01-01 00:00:00' },
    ])
    expect(rows.map(row => row.lifecycle)).toEqual(['usable', 'depleted', 'expired'])
  })
})
