/**
 * 用量图标是否挂出：按当前选中模型的供应商判断。
 *
 * 单独成模块是为了可测：`CodexUsageStatus.tsx` 一旦被 import 就会拉起 Semi
 * 组件和浏览器服务，纯判断放在这里可以直接断言真值表。
 *
 * 判断依据是会话投影 `modelSelection` 的 `provider`，与选中模型同源；不用
 * 登录态、也不用用量请求是否成功来替代——那是两回事。读不到就当作不显示，
 * 不猜供应商。
 *
 * @module dsh-codex-auth/usage-visibility
 */

import { CODEX_PROVIDER } from '../../contracts/provider.ts'

/** 投影里一条模型选择里本模块关心的字段。 */
export interface ModelSelectionLike {
  provider?: string | null
}

/**
 * 会话投影 `modelSelection` 的结构子集。
 *
 * 只声明用到的一层，真实投影对象可以直接传进来；不 import session-controller
 * 的具体类型，是为了让这个判断不随上游类型的迁移而失效。
 */
export interface ModelSelectionProjectionLike {
  lastUsed?: ModelSelectionLike | null
  next?: ModelSelectionLike | null
}

/**
 * 读出当前选中模型的供应商标识。
 * @param projection - 会话投影 `modelSelection`，可能尚未送达。
 * @returns 供应商 id；投影缺失或两侧都为空时返回 undefined。
 */
export function readSelectedProvider(projection: ModelSelectionProjectionLike | undefined): string | undefined {
  const selection = projection?.next ?? projection?.lastUsed
  const provider = selection?.provider
  return typeof provider === 'string' && provider.length > 0 ? provider : undefined
}

/**
 * Codex 用量图标是否挂出。
 * @param projection - 会话投影 `modelSelection`。
 * @returns 选中模型属于 Codex 供应商时为 true。
 */
export function codexUsageVisible(projection: ModelSelectionProjectionLike | undefined): boolean {
  return readSelectedProvider(projection) === CODEX_PROVIDER
}
