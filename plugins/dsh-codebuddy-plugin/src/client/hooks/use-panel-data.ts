/**
 * 面板级数据 hook：每个 hook 接一个 RPC endpoint + payload + 重取依赖，
 * 暴露 `{ data, loading, reload }`。调用方按需解构，不直接看实现细节。
 *
 * 业务上的「登录/删除/改名后重拉列表」「设置页改动后重取账号」都是通过传
 * deps 数组（一般是 `rosterTick` / `accountEpoch`）触发，不引入一个全局事件
 * 总线——hooks 之间的依赖明确写在 props 上。
 *
 * @module dsh-codebuddy/hooks/use-panel-data
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CODEBUDDY_AUTH_CHANNEL } from '../../contracts/constants.ts'
import type { ConnectionRpc } from '../rpc.ts'
import type { TokenStats } from '../../types/client/panel-types'
import type { TokenRangeKey } from '../token-range.ts'
import type { TokenStatsStore } from '../store/token-stats.ts'

/**
 * 通用面板数据 hook。
 *
 * - `rpc` / `endpoint` / `payload` 三者决定请求本身；
 * - `deps` 数组变化时自动重取，便于 `rosterTick` 之类的计数器参与；
 * - `reload()` 返回一个 setter，调用时立即触发新一轮请求。
 *
 * `active` 状态防止组件在 `await` 拿到响应前卸载仍写入状态——`active` 在
 * cleanup 时被改 false，旧响应忽略，避免 setState-on-unmounted-component。
 */
export function usePanelData<T>(
  rpc: ConnectionRpc,
  endpoint: string,
  payload: unknown,
  deps: unknown[],
): { data: T | undefined, loading: boolean, reload: () => void } {
  const [data, setData] = useState<T | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const reload = (): void => { setTick(v => v + 1) }
  useEffect(() => {
    let active = true
    setLoading(true)
    void rpc.call<T>(CODEBUDDY_AUTH_CHANNEL, endpoint, payload).then(result => {
      if (!active) return
      setData(result.ok ? result.value : undefined)
      setLoading(false)
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpc, endpoint, tick, ...deps])
  return { data, loading, reload }
}

/**
 * 订阅 Token 统计缓存。每个面板用**自己的** range 调用本 hook：
 * 范围相同的面板共享同一份数据与同一个在途请求，范围不同才各自取一次。
 *
 * 返回两个不同的加载态，用途严格区分：
 * - `initialLoading`：从未取到过数据 → 该面板/整页需要占位。
 * - `loading`：请求在途（可能已有陈旧数据）→ 只叠遮罩。
 *
 * 混用这两者会导致「刷新时整页回到初次加载占位」，即所谓的全局刷新。
 */
export function useTokenStats(store: TokenStatsStore, range: TokenRangeKey): {
  data: TokenStats | undefined
  loading: boolean
  initialLoading: boolean
  error: string | undefined
  reload: () => void
} {
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  // 每个面板一份稳定令牌：数据按范围共享，但加载指示只属于发起刷新的面板，
  // 否则停在同范围上的其他面板会一起转圈（看起来还是全局刷新）。
  const owner = useRef<symbol>(Symbol('token-panel'))
  useEffect(() => { store.ensure(range) }, [store, range])
  const data = store.get(range) as TokenStats | undefined
  const inFlight = store.isLoading(range, owner.current)
  const reload = useCallback(() => { store.reload(range, owner.current) }, [store, range])
  return {
    data,
    loading: inFlight,
    initialLoading: data === undefined && inFlight,
    error: store.errorOf(range),
    reload,
  }
}
