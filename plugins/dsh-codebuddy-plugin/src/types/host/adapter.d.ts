
import type { CodeBuddySession } from '../../host/session.ts'
import type { ImageAttachmentAccess } from '@deepseek-ai/dsh-llm'
import type { AttachmentStore, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'

/** 注册插件解析、适配器信任的连接事实。 */
export interface CodeBuddyConnectionOptions {
  /** 聊天端点基址；后接 `/chat/completions`。 */
  baseURL: string
  /** 模型目录未给出模型大小时使用的上下文容量。 */
  defaultContextWindow: number
  /** 模型目录未给模型设上限时使用的单次请求输出上限。 */
  defaultMaxTokens: number
  /** 一次流读取未完成时允许的最大 provider 空闲时间。 */
  streamIdleTimeoutMs: number
}
/** 构造参数：会话加上每次操作取连接配置的 thunk。 */
export interface CodeBuddyAdapterOptions {
  session: CodeBuddySession
  options: () => CodeBuddyConnectionOptions
  /** 额度失败时是否允许自动切换当前活动账号。 */
  autoSwitch?: () => boolean
  /** 自动接管切号成功后回调（触发 harness 模型目录/用量即时刷新）。 */
  onAccountSwitched?: () => void
  /** 持久化附件服务（`ctx.attachments`）；仅图像输入时必需。 */
  resolveAttachments?: () => AttachmentStore | undefined
  /** 在可用时解析某个持久化图像句柄的当前工具访问权。 */
  resolveImageAccess?: (attachments: AttachmentStore, ref: ImageAttachmentRef) => ImageAttachmentAccess | undefined
}
