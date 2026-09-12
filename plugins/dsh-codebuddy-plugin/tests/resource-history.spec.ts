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

/**
 * 台账的**订阅语义**：这是 `panel.tsx` 里「台账更新后卡片要重新分类」的依据。
 *
 * 背景：`readResources(id)` 每次调用都去 `$history.get()` 取当前值，那是 React
 * 看不见的外部可变状态——组件里 `useMemo(() => readResources(id), [rows])` 在
 * 台账更新后不会重算（`rows` 没变），分类会一直停在旧值。
 *
 * 旧实现靠一个手工 state（`ledgerTick`）在写完台账后自增来触发重算，还要压制
 * 「lint 认为该依赖多余」的告警。现在改为 `useStore` 订阅 atom + 纯函数
 * `resourcesFrom(snapshot, id)` 读取，依赖变成真实可校验的。
 * 这组测试把「订阅确实会被通知、快照引用确实会变」固定下来——否则那次重构的
 * 前提（atom 可订阅、且写操作改变引用）只是口耳相传。
 */
describe('台账 atom 的订阅语义（订阅式依赖的前提）', () => {
  it('recordResources 通知订阅者，且快照引用发生变化', async () => {
    const { useTestStorageEngine } = await import('@nanostores/persistent')
    useTestStorageEngine()
    const { resourceHistoryStore, recordResources } = await import('../src/client/resource-history.ts')

    let notified = 0
    const unsubscribe = resourceHistoryStore.subscribe(() => { notified += 1 })
    const before = resourceHistoryStore.get()
    recordResources('sub-acct', [{ name: 'P', total: 10, remaining: 5, resetsAt: null }])
    const after = resourceHistoryStore.get()
    unsubscribe()

    // useStore 依赖「有通知」才会重渲染；useMemo 依赖「引用变化」才会重算。
    expect(notified).toBeGreaterThan(0)
    expect(before).not.toBe(after)
  })

  it('resourcesFrom 从给定快照读取：旧快照读不到新写入的行', async () => {
    const { useTestStorageEngine } = await import('@nanostores/persistent')
    useTestStorageEngine()
    const { resourceHistoryStore, recordResources, resourcesFrom } = await import('../src/client/resource-history.ts')

    const before = resourceHistoryStore.get()
    recordResources('snap-acct', [{ name: 'P', total: 10, remaining: 5, resetsAt: null }])
    const after = resourceHistoryStore.get()

    // 纯函数的语义：结果只取决于传入的快照 —— 这正是依赖可校验的原因。
    expect(resourcesFrom(before, 'snap-acct')).toEqual([])
    expect(resourcesFrom(after, 'snap-acct')).toHaveLength(1)
  })

  it('未知账号、或快照形状不对时退回空数组（不抛错）', async () => {
    const { useTestStorageEngine } = await import('@nanostores/persistent')
    useTestStorageEngine()
    const { resourcesFrom } = await import('../src/client/resource-history.ts')
    expect(resourcesFrom({}, 'nobody')).toEqual([])
    // 历史版本或手工改动过的数据可能形状不对，必须逐行过滤而不是交给渲染层。
    expect(resourcesFrom(null, 'x')).toEqual([])
    expect(resourcesFrom({ x: 'not-an-array' }, 'x')).toEqual([])
    expect(resourcesFrom({ x: [null, 42, { key: 'k', name: 'n', total: 1, remaining: 1, resetsAt: null }] }, 'x')).toHaveLength(1)
  })
})
