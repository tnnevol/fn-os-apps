/**
 * 已发起登录的轮询循环。
 *
 * 独立成模块（而非留在 AddAccountModal.tsx 里）的原因有两条：
 *  1. 它与 UI 无关——只用 rpc 与定时器，弹框、设置区块都在用；
 *  2. 组件文件会引入 Semi 的 CJS 图标包，node 环境下的单测无法解析它，
 *     导致这段纯逻辑当初只能靠文本扫描间接验证。拆出来后可以直接驱动它做
 *     真实的行为测试（成功/失败/超时/中止）。
 *
 * @module dsh-codebuddy/login-polling
 */

import type { ConnectionRpc, LoginPoll, RpcResult } from '../client/rpc.ts'
import { CODEBUDDY_AUTH_CHANNEL } from '../contracts/constants.ts'

/** 轮询已发起登录的间隔（ms）。 */
export const POLL_INTERVAL_MS = 1500
/** 放弃前的最长轮询时长（ms）。 */
export const POLL_DEADLINE_MS = 10 * 60 * 1000

/**
 * 轮询一次已发起的登录直至完成。
 *
 * @param rpc - 客户端 RPC 通道。
 * @param state - `startLogin` 返回的握手 id。
 * @param onDone - 登录成功。
 * @param onTimeout - 超过 {@link POLL_DEADLINE_MS} 仍未完成；未提供 `onFailed`
 *   时也用于承接宿主判定的失败。
 * @param onFailed - 宿主已判定失败，携带原因。
 * @returns 中止轮询的 disposer；调用后不再发请求、不再回调。
 */
export function startLoginPolling(
  rpc: ConnectionRpc,
  state: string,
  onDone: () => void,
  onTimeout: () => void,
  onFailed?: (reason: string) => void,
): () => void {
  const startedAt = Date.now()
  let stopped = false
  const tick = async (): Promise<void> => {
    if (stopped) return
    const result: RpcResult<LoginPoll> = await rpc.call<LoginPoll>(CODEBUDDY_AUTH_CHANNEL, 'pollLogin', { state })
    if (stopped) return
    if (result.ok && result.value.done) {
      onDone()
      return
    }
    // 宿主已判定失败：立即停止轮询并上报原因，不必等到超时——继续等待不会有结果。
    if (result.ok && result.value.error !== undefined && result.value.error.length > 0) {
      if (onFailed === undefined) onTimeout()
      else onFailed(result.value.error)
      return
    }
    if (Date.now() - startedAt >= POLL_DEADLINE_MS) {
      onTimeout()
      return
    }
    window.setTimeout(tick, POLL_INTERVAL_MS)
  }
  void tick()
  return () => { stopped = true }
}
