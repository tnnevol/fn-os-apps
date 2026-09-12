
import type { CodeBuddyClientId } from '../../contracts/constants.ts'
import type { ConnectionRpc } from '../../client/rpc.ts'
import type { Translate } from '../client/panel-types'
export type { Translate } from '../client/panel-types'

export interface AddAccountOptions {
  /** 本地展示备注名；省略 → 回落到昵称。 */
  label?: string
  /** 客户端身份：决定登录页与后续请求所用的服务地址。 */
  client?: CodeBuddyClientId
  /** 网络环境 id；缺省为插件默认值。 */
  environment: string
  /** 显式服务根，cloudhosted/selfhosted 时必填。 */
  endpoint: string
  /** 企业账号开关（保留以与设置表单对齐）。 */
  enterprise: boolean
}
export interface AddAccountModalProps {
  rpc: ConnectionRpc
  t: Translate
  visible: boolean
  initial?: AddAccountOptions
  /**
   * 握手成功、登录已发起。宿主据此打开浏览器并标记「登录中」。
   *
   * 轮询与结果提示由弹框自己负责，宿主不要再对同一个 state 起第二个轮询——
   * 那会对 `pollLogin` 发双份请求，并让提示出现两次。
   */
  onLoginStart?: (start: { authUrl: string, state: string }) => void
  onCancel: () => void
  /**
   * 登录彻底落定后调用一次：成功、失败或超时。
   *
   * `ok` 为真时宿主应刷新名册；提示文案已由弹框给出，宿主不必重复提示。
   */
  onFinished?: (ok: boolean, text?: string) => void
  /** 主操作按钮文案；缺省为共享的「打开登录」文案。 */
  submitLabel?: string
}
