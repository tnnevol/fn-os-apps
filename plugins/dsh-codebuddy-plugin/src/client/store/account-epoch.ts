/**
 * 账号代际计数：当前账号（或凭据）每切换一次 +1。
 *
 * 模型目录的 harness 事件 `llm/adapters-updated` 在我们账号切换后由 host 广播
 * （adapter replace 触发）。浏览器端所有依赖当前账号数据的 UI（用量指示器、
 * 管理面板各页）都订阅本模块的 epoch，变化即重新拉取——无需刷新页面。
 *
 * @module dsh-codebuddy/account-epoch
 */

const listeners = new Set<() => void>()
let epoch = 0

/** 当前代际；依赖它的 UI 应在其变化后重拉账号相关数据。 */
export function accountEpoch(): number {
  return epoch
}

/** 订阅账号切换；返回取消订阅函数。 */
export function subscribeAccountEpoch(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** 推进代际（由账号切换事件的宿主订阅者调用）。 */
export function bumpAccountEpoch(): void {
  epoch += 1
  for (const listener of listeners) listener()
}
