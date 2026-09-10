import { describe, expect, it, vi } from 'vitest'
import { TokenStatsStore } from '../src/client/token-stats-store.ts'
import type { ConnectionRpc, RpcResult } from '../src/client/rpc.ts'

/**
 * Token 页每个面板都有自己的时间周期，若各自裸调 RPC，同一范围会被重复请求，
 * 而服务端每次都要重放全部会话（实测 200 会话约 50ms）。这一组测试守的就是
 * store 的按范围复用：同范围共享一份数据与同一个在途请求。
 */
function makeRpc(options: { fail?: boolean, delayMs?: number } = {}): { rpc: ConnectionRpc, calls: Array<{ days: number, allTime?: boolean }> } {
  const calls: Array<{ days: number, allTime?: boolean }> = []
  const rpc: ConnectionRpc = {
    call: async <T>(_channel: string, _endpoint: string, payload?: unknown): Promise<RpcResult<T>> => {
      const req = payload as { days: number, allTime?: boolean }
      calls.push(req)
      if (options.delayMs !== undefined) await new Promise(resolve => setTimeout(resolve, options.delayMs))
      if (options.fail === true) {
        return { ok: false, error: { code: 'transport', message: 'down', details: {} } }
      }
      return { ok: true, value: { rangeDays: req.days, allTime: req.allTime === true, tag: req.allTime === true ? 'all' : `d${req.days}` } as unknown as T }
    },
  }
  return { rpc, calls }
}

describe('TokenStatsStore', () => {
  it('同一范围只请求一次——多个面板共享同一份数据', async () => {
    const { rpc, calls } = makeRpc()
    const store = new TokenStatsStore(rpc)
    // 三个面板都用 30 天：只应产生一次请求。
    store.ensure('30d')
    store.ensure('30d')
    store.ensure('30d')
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
    expect(calls.map(c => c.days)).toEqual([30])
    expect(store.get('30d')).toMatchObject({ tag: 'd30' })
  })

  it('在途请求会被复用，不会因为并发 ensure 而重复发起', async () => {
    const { rpc, calls } = makeRpc({ delayMs: 20 })
    const store = new TokenStatsStore(rpc)
    store.ensure('90d')
    store.ensure('90d')
    expect(store.isLoading('90d')).toBe(true)
    await vi.waitFor(() => { expect(store.isLoading('90d')).toBe(false) })
    expect(calls.map(c => c.days)).toEqual([90])
  })

  it('不同范围各自请求一次——这是功能本身要求的', async () => {
    const { rpc, calls } = makeRpc()
    const store = new TokenStatsStore(rpc)
    store.ensure('7d')
    store.ensure('30d')
    store.ensure('90d')
    await vi.waitFor(() => { expect(store.isLoading('7d')).toBe(false) })
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
    await vi.waitFor(() => { expect(store.isLoading('90d')).toBe(false) })
    expect(calls.map(c => c.days).sort((a, b) => a - b)).toEqual([7, 30, 90])
  })

  it('切回已加载过的范围直接命中缓存，不再请求', async () => {
    const { rpc, calls } = makeRpc()
    const store = new TokenStatsStore(rpc)
    store.ensure('30d')
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
    // 模拟用户切到 7 天再切回 30 天。
    store.ensure('30d')
    expect(calls.map(c => c.days)).toEqual([30])
  })

  it('reload 只刷新自己这一范围', async () => {
    const { rpc, calls } = makeRpc()
    const store = new TokenStatsStore(rpc)
    store.ensure('30d')
    store.ensure('7d')
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
    await vi.waitFor(() => { expect(store.isLoading('7d')).toBe(false) })
    store.reload('30d')
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
    // 7 天没有被牵连重取。
    expect(calls.map(c => c.days)).toEqual([30, 7, 30])
  })

  it('请求失败会记录错误而不是留下永远 loading 的状态', async () => {
    const { rpc } = makeRpc({ fail: true })
    const store = new TokenStatsStore(rpc)
    store.ensure('30d')
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
    expect(store.get('30d')).toBeUndefined()
    expect(store.errorOf('30d')).toBe('unavailable')
  })

  it('传输异常（reject）也被兜住', async () => {
    const rpc = { call: async () => { throw new Error('boom') } } as unknown as ConnectionRpc
    const store = new TokenStatsStore(rpc)
    store.ensure('30d')
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
    expect(store.errorOf('30d')).toBe('unavailable')
  })

  it('reloadAll 刷新所有已加载范围，且不重复发起在途请求', async () => {
    const { rpc, calls } = makeRpc()
    const store = new TokenStatsStore(rpc)
    store.ensure('7d')
    store.ensure('30d')
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
    await vi.waitFor(() => { expect(store.isLoading('7d')).toBe(false) })
    store.reloadAll()
    await vi.waitFor(() => { expect(store.isLoading('7d')).toBe(false) })
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
    expect(calls.map(c => c.days).sort((a, b) => a - b)).toEqual([7, 7, 30, 30])
  })

  it('订阅者在数据到位时收到通知（面板据此重渲染）', async () => {
    const { rpc } = makeRpc()
    const store = new TokenStatsStore(rpc)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.ensure('30d')
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
    expect(listener).toHaveBeenCalled()
    unsubscribe()
    const before = listener.mock.calls.length
    store.ensure('7d')
    await vi.waitFor(() => { expect(store.isLoading('7d')).toBe(false) })
    expect(listener.mock.calls.length).toBe(before)
  })
})

describe('刷新不得让面板退回「初次加载」状态', () => {
  /**
   * 这条守的是一个真实回归：reload 曾经先 `cache.delete(days)`，于是
   * `get(days)` 返回 undefined，面板据此判定「还没数据」而整页换成初次加载
   * 占位——表现就是「刷新总览变成了全局刷新」。
   *
   * 不变式：刷新期间旧数据必须一直在，只有 isLoading 变化。
   */
  it('reload 期间旧数据保持可见（不会短暂变成 undefined）', async () => {
    const { rpc } = makeRpc({ delayMs: 20 })
    const store = new TokenStatsStore(rpc)
    store.ensure('30d')
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
    const before = store.get('30d')
    expect(before).toBeDefined()

    store.reload('30d')
    // 关键：请求在途时，数据依然可读。
    expect(store.isLoading('30d')).toBe(true)
    expect(store.get('30d')).toBe(before)
    // 而且不能处于「从未加载过」的状态。
    expect(store.get('30d')).toBeDefined()

    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
  })

  it('reload 后拿到的是新数据，而不是沿用旧值', async () => {
    let round = 0
    const rpc: ConnectionRpc = {
      call: async <T>(_c: string, _e: string, payload?: unknown): Promise<RpcResult<T>> => {
        round += 1
        return { ok: true, value: { rangeDays: (payload as { days: number }).days, tag: `round-${round}` } as unknown as T }
      },
    }
    const store = new TokenStatsStore(rpc)
    store.ensure('30d')
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
    expect(store.get('30d')).toMatchObject({ tag: 'round-1' })

    store.reload('30d')
    await vi.waitFor(() => { expect(store.get('30d')).toMatchObject({ tag: 'round-2' }) })
  })

  it('reloadAll 同样保留旧数据', async () => {
    const { rpc } = makeRpc({ delayMs: 15 })
    const store = new TokenStatsStore(rpc)
    store.ensure('7d')
    store.ensure('30d')
    await vi.waitFor(() => { expect(store.isLoading('7d')).toBe(false) })
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
    const before7 = store.get('7d')
    const before30 = store.get('30d')

    store.reloadAll()
    expect(store.get('7d')).toBe(before7)
    expect(store.get('30d')).toBe(before30)
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
    await vi.waitFor(() => { expect(store.isLoading('7d')).toBe(false) })
  })

  it('刷新失败时保留旧数据并标记错误（供 UI 提示），而不是清空', async () => {
    let fail = false
    const rpc: ConnectionRpc = {
      call: async <T>(_c: string, _e: string, payload?: unknown): Promise<RpcResult<T>> => {
        if (fail) return { ok: false, error: { code: 'transport', message: 'down', details: {} } }
        return { ok: true, value: { rangeDays: (payload as { days: number }).days, tag: 'ok' } as unknown as T }
      },
    }
    const store = new TokenStatsStore(rpc)
    store.ensure('30d')
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })

    fail = true
    store.reload('30d')
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
    // 旧数据仍在（界面不闪），同时有错误可提示。
    expect(store.get('30d')).toMatchObject({ tag: 'ok' })
    expect(store.errorOf('30d')).toBe('unavailable')

    // 下次成功要清掉错误标记。
    fail = false
    store.reload('30d')
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
    expect(store.errorOf('30d')).toBeUndefined()
  })
})

describe('加载指示按面板隔离', () => {
  /**
   * 五个面板默认都停在 30 天。数据按范围共享是对的（同范围只该取一次），
   * 但若 loading 也按范围共享，刷新总览会让另外四个同范围的面板一起转圈
   * ——看起来仍然像全局刷新。因此加载指示必须只属于发起刷新的面板。
   */
  it('刷新某范围时，同范围的其他面板不显示加载', async () => {
    const { rpc } = makeRpc({ delayMs: 20 })
    const store = new TokenStatsStore(rpc)
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
    store.ensure('30d')
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })

    const overview = Symbol('overview')
    const trend = Symbol('trend')
    store.reload('30d', overview)

    // 发起者看到加载；同范围的其他面板不受影响。
    expect(store.isLoading('30d', overview)).toBe(true)
    expect(store.isLoading('30d', trend)).toBe(false)

    await vi.waitFor(() => { expect(store.isLoading('30d', overview)).toBe(false) })
    expect(store.isLoading('30d', trend)).toBe(false)
  })

  it('首次填充（无发起者）时，同范围的面板都应显示等待', async () => {
    const { rpc } = makeRpc({ delayMs: 20 })
    const store = new TokenStatsStore(rpc)
    store.ensure('30d')
    // ensure 不指定发起者：此时还没有人是「刷新发起方」，同范围面板都该等待。
    expect(store.isLoading('30d', Symbol('a'))).toBe(true)
    expect(store.isLoading('30d', Symbol('b'))).toBe(true)
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
  })

  it('不传 owner 时退化为按范围判断（兼容既有调用）', async () => {
    const { rpc } = makeRpc({ delayMs: 20 })
    const store = new TokenStatsStore(rpc)
    store.ensure('30d')
    expect(store.isLoading('30d')).toBe(true)
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })
  })

  it('加载结束后发起者标记被清理，不会污染后续刷新', async () => {
    const { rpc } = makeRpc({ delayMs: 10 })
    const store = new TokenStatsStore(rpc)
    const a = Symbol('a')
    const b = Symbol('b')
    store.ensure('30d')
    await vi.waitFor(() => { expect(store.isLoading('30d')).toBe(false) })

    store.reload('30d', a)
    await vi.waitFor(() => { expect(store.isLoading('30d', a)).toBe(false) })
    // a 的刷新结束后，b 发起刷新应当只让 b 看到加载。
    store.reload('30d', b)
    expect(store.isLoading('30d', b)).toBe(true)
    expect(store.isLoading('30d', a)).toBe(false)
    await vi.waitFor(() => { expect(store.isLoading('30d', b)).toBe(false) })
  })
})
