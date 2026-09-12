
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
  /** 调用方在下方展示等待卡时，已发起登录的文案。 */
  onLoginStart?: (start: { authUrl: string, state: string }) => void
  onCancel: () => void
  /** 已发起的登录结束（或出错）后调用一次，供调用方刷新。 */
  onFinished?: (ok: boolean, text?: string) => void
  /** 主操作按钮文案；缺省为共享的「打开登录」文案。 */
  submitLabel?: string
}
