/**
 * 用量图标是否挂出：按当前选中模型的供应商判断。
 *
 * 两个用量插件都挂在 `conversation.input.right`，各自只看自己的登录态或偏好，
 * 于是选中一家模型时另一家的图标照样显示。显隐条件收敛到这里，按会话投影
 * `modelSelection` 的 `provider` 判断，与选中模型同源。
 *
 * 单独成模块是为了可测：`CodeBuddyUsageStatus.tsx` 一旦被 import 就会拉起
 * Semi 组件和 RPC，纯判断放在这里可以直接断言真值表。
 *
 * @module dsh-codebuddy/usage-visibility
 */

import { CODEBUDDY_PROVIDER } from '../contracts/constants.ts'

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
 * CodeBuddy 用量图标是否挂出。
 *
 * `showUsage` 是更前置的开关：用户关掉「显示额度余量」时不显示，供应商条件
 * 是在该偏好之上的额外条件，两者取与。
 *
 * @param projection - 会话投影 `modelSelection`。
 * @param showUsage - 用户的「显示额度余量」偏好。
 * @returns 偏好开启且选中模型属于 CodeBuddy 供应商时为 true。
 */
export function codebuddyUsageVisible(
  projection: ModelSelectionProjectionLike | undefined,
  showUsage: boolean,
): boolean {
  return showUsage && readSelectedProvider(projection) === CODEBUDDY_PROVIDER
}
