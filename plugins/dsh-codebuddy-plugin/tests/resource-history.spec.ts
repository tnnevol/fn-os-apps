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

  it('keeps a usable package ahead of an expired one so the card shows the usable one first', () => {
    // 卡片只取前两条，顺序错了就会把还能用的套餐挤出概览。
    const ledger = [ledgerRow('old@2020', 'old', 5, '2020-01-01 00:00:00')]
    const rows = classifyResources(ledger, [{ name: 'live', total: 100, remaining: 1, resetsAt: '2099-01-01 00:00:00' }])
    expect(rows.slice(0, 2).map(row => row.name)).toEqual(['live', 'old'])
  })
})

describe('台账持久化（迁移到 nanostores 后）', () => {
  it('写入后能读回，且存储键与迁移前一致', async () => {
    const { useTestStorageEngine, getTestStorage } = await import('@nanostores/persistent')
    useTestStorageEngine()
    const { recordResources, readResources } = await import('../src/client/resource-history.ts')
    const rows = recordResources('acct-1', [{ name: '体验版', total: 100, remaining: 40, resetsAt: '2099-01-01 00:00:00' }])
    expect(rows).toHaveLength(1)
    // 键名不变：老用户已写入的台账不会被读丢。
    expect(getTestStorage()['dsh-codebuddy:resource-history']).toBeDefined()
    expect(readResources('acct-1')).toHaveLength(1)
  })

  it('存储里的脏数据被逐行过滤，而不是让渲染层拿到残缺行', async () => {
    const { useTestStorageEngine, setTestStorageKey } = await import('@nanostores/persistent')
    useTestStorageEngine()
    // 形状不对：缺 key/name 的行、非数组的账号、非对象的条目都要被丢掉。
    setTestStorageKey('dsh-codebuddy:resource-history', JSON.stringify({
      'acct-2': [
        { key: 'ok@x', name: '正常', total: 1, remaining: 1, resetsAt: null, lastSeenAt: 1 },
        { name: '缺 key' },
        null,
        'not-an-object',
      ],
      'acct-3': 'not-an-array',
    }))
    const { readResources } = await import('../src/client/resource-history.ts')
    const rows = readResources('acct-2')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.name).toBe('正常')
    expect(readResources('acct-3')).toEqual([])
  })

  it('存储值不是合法 JSON 时回落到空台账，不抛错', async () => {
    const { useTestStorageEngine, setTestStorageKey } = await import('@nanostores/persistent')
    useTestStorageEngine()
    setTestStorageKey('dsh-codebuddy:resource-history', '{ 不是 JSON')
    const { readResources } = await import('../src/client/resource-history.ts')
    expect(readResources('acct-4')).toEqual([])
  })

  it('forgetResources 只删该账号的台账', async () => {
    const { useTestStorageEngine } = await import('@nanostores/persistent')
    useTestStorageEngine()
    const { recordResources, readResources, forgetResources } = await import('../src/client/resource-history.ts')
    recordResources('a', [{ name: 'x', total: 1, remaining: 1, resetsAt: null }])
    recordResources('b', [{ name: 'y', total: 1, remaining: 1, resetsAt: null }])
    forgetResources('a')
    expect(readResources('a')).toEqual([])
    expect(readResources('b')).toHaveLength(1)
  })
})
