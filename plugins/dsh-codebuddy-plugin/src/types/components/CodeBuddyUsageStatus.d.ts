
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: 拉入 ui-session 对 SessionStandardProps 的合并（含 useProjection），
// 否则会话作用域座位的标准套件解析成空对象。
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { Translate } from '../client/panel-types'
export type { Translate } from '../client/panel-types'
import type { ConnectionRpc } from '../../client/rpc.ts'

export type TimerService = {
  interval(callback: () => void, delay: number): () => void
}
/**
 * 注册方注入的业务面：翻译、计时器和 RPC。
 */
export interface CodeBuddyUsageStatusInjected {
  t: Translate
  timer: TimerService
  rpc: ConnectionRpc
}

/**
 * 完整的座位道具：会话作用域标准套件（含 `useProjection`）加上注册方注入的
 * 业务面。`useProjection` 由渲染器提供，不能走 `inject`——`inject` 在 React
 * 之外执行，传不了 hook。
 */
export type CodeBuddyUsageStatusProps =
  PropsRuntime<'conversation.input.right'>
  & InjectFace<CodeBuddyUsageStatusInjected>
