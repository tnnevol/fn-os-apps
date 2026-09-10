import { describe, expect, it, vi } from 'vitest'
import { TokenStatsStore } from '../src/client/token-stats-store.ts'
import type { ConnectionRpc, RpcResult } from '../src/client/rpc.ts'

/**
 * Token 页每个面板都有自己的时间周期，若各自裸调 RPC，同一范围会被重复请求，
 * 而服务端每次都要重放全部会话（实测 200 会话约 50ms）。这一组测试守的就是
 * store 的按范围复用：同范围共享一份数据与同一个在途请求。
 */
function makeRpc(options: { fail?: boolean, delayMs?: number } = {}): { rpc: ConnectionRpc, calls: number[] } {
  const calls: number[] = []
  const rpc: ConnectionRpc = {
    call: async <T>(_channel: string, _endpoint: string, payload?: unknown): Promise<RpcResult<T>> => {
      const days = (payload as { days: number }).days
      calls.push(days)
      if (options.delayMs !== undefined) await new Promise(resolve => setTimeout(resolve, options.delayMs))
      if (options.fail === true) {
        return { ok: false, error: { code: 'transport', message: 'down', details: {} } }
      }
      return { ok: true, value: { rangeDays: days, tag: `d${days}` } as unknown as T }
    },
  }
  return { rpc, calls }
}

describe('TokenStatsStore', () => {
  it('同一范围只请求一次——多个面板共享同一份数据', async () => {
    const { rpc, calls } = makeRpc()
    const store = new TokenStatsStore(rpc)
    // 三个面板都用 30 天：只应产生一次请求。
    store.ensure(30)
    store.ensure(30)
    store.ensure(30)
    await vi.waitFor(() => { expect(store.isLoading(30)).toBe(false) })
    expect(calls).toEqual([30])
    expect(store.get(30)).toMatchObject({ tag: 'd30' })
  })

  it('在途请求会被复用，不会因为并发 ensure 而重复发起', async () => {
    const { rpc, calls } = makeRpc({ delayMs: 20 })
    const store = new TokenStatsStore(rpc)
    store.ensure(90)
    store.ensure(90)
    expect(store.isLoading(90)).toBe(true)
    await vi.waitFor(() => { expect(store.isLoading(90)).toBe(false) })
    expect(calls).toEqual([90])
  })

  it('不同范围各自请求一次——这是功能本身要求的', async () => {
    const { rpc, calls } = makeRpc()
    const store = new TokenStatsStore(rpc)
    store.ensure(7)
    store.ensure(30)
    store.ensure(90)
    await vi.waitFor(() => { expect(store.isLoading(7)).toBe(false) })
    await vi.waitFor(() => { expect(store.isLoading(30)).toBe(false) })
    await vi.waitFor(() => { expect(store.isLoading(90)).toBe(false) })
    expect(calls.sort((a, b) => a - b)).toEqual([7, 30, 90])
  })

  it('切回已加载过的范围直接命中缓存，不再请求', async () => {
    const { rpc, calls } = makeRpc()
    const store = new TokenStatsStore(rpc)
    store.ensure(30)
    await vi.waitFor(() => { expect(store.isLoading(30)).toBe(false) })
    // 模拟用户切到 7 天再切回 30 天。
    store.ensure(30)
    expect(calls).toEqual([30])
  })

  it('reload 只刷新自己这一范围', async () => {
    const { rpc, calls } = makeRpc()
    const store = new TokenStatsStore(rpc)
    store.ensure(30)
    store.ensure(7)
    await vi.waitFor(() => { expect(store.isLoading(30)).toBe(false) })
    await vi.waitFor(() => { expect(store.isLoading(7)).toBe(false) })
    store.reload(30)
    await vi.waitFor(() => { expect(store.isLoading(30)).toBe(false) })
    // 7 天没有被牵连重取。
    expect(calls).toEqual([30, 7, 30])
  })

  it('请求失败会记录错误而不是留下永远 loading 的状态', async () => {
    const { rpc } = makeRpc({ fail: true })
    const store = new TokenStatsStore(rpc)
    store.ensure(30)
    await vi.waitFor(() => { expect(store.isLoading(30)).toBe(false) })
    expect(store.get(30)).toBeUndefined()
    expect(store.errorOf(30)).toBe('unavailable')
  })

  it('传输异常（reject）也被兜住', async () => {
    const rpc = { call: async () => { throw new Error('boom') } } as unknown as ConnectionRpc
    const store = new TokenStatsStore(rpc)
    store.ensure(30)
    await vi.waitFor(() => { expect(store.isLoading(30)).toBe(false) })
    expect(store.errorOf(30)).toBe('unavailable')
  })

  it('reloadAll 刷新所有已加载范围，且不重复发起在途请求', async () => {
    const { rpc, calls } = makeRpc()
    const store = new TokenStatsStore(rpc)
    store.ensure(7)
    store.ensure(30)
    await vi.waitFor(() => { expect(store.isLoading(30)).toBe(false) })
    await vi.waitFor(() => { expect(store.isLoading(7)).toBe(false) })
    store.reloadAll()
    await vi.waitFor(() => { expect(store.isLoading(7)).toBe(false) })
    await vi.waitFor(() => { expect(store.isLoading(30)).toBe(false) })
    expect(calls.sort((a, b) => a - b)).toEqual([7, 7, 30, 30])
  })

  it('订阅者在数据到位时收到通知（面板据此重渲染）', async () => {
    const { rpc } = makeRpc()
    const store = new TokenStatsStore(rpc)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.ensure(30)
    await vi.waitFor(() => { expect(store.isLoading(30)).toBe(false) })
    expect(listener).toHaveBeenCalled()
    unsubscribe()
    const before = listener.mock.calls.length
    store.ensure(7)
    await vi.waitFor(() => { expect(store.isLoading(7)).toBe(false) })
    expect(listener.mock.calls.length).toBe(before)
  })
})
