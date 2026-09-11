/**
 * CodeBuddy 聊天图像序列化。
 *
 * CodeBuddy 的聊天平面与 OpenAI 兼容：携带持久图像块的用户内容以有序内容数组
 * 发送，其中每张图像成为 `{ type: 'image_url', image_url: { url: <data URI> } }`，
 * 并在其前面放一个小的文本把手（与 harness 给纯文本模型展示的是同一份稳定
 * 文本，因此重放读起来一致）。工具结果里的图像跟在其纯字符串工具消息之后，
 * 装在一条单独的 user 消息里。
 *
 * 持久字节不进入会话消息：本模块通过附件存储（`ctx.attachments`）读取归一化
 * 的请求版本，与 DeepSeek 和 pi-ai adapter 的做法完全一致。
 *
 * @module dsh-codebuddy/serialize-image
 */

import { LlmError, requestImageHandleText } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions, ImageAttachmentAccessResolver, Message } from '@deepseek-ai/dsh-llm'
import type { AttachmentStore, ImageAttachmentRef, ImageRequestPolicy, RequestImageAttachment } from '@deepseek-ai/dsh-attachment'
import { boundToolCallId, buildWireRequest, flattenText } from './serialize.ts'
import type { WireContent, WireMessage, WirePart, WireRequest } from './types.ts'

/** 供 adapter 调用方重导出的线缆请求类型。 */
export type { WireRequest }

/** 聊天路由使用的确切请求图像策略（字节/像素）。 */
const REQUEST_IMAGE_POLICY: ImageRequestPolicy = {
  // 保持 harness 默认的保守限制，避免超大截图把请求撑到超过 CodeBuddy 自己的
  // IDE 客户端会发送的规模。
  maxPixels: 4_000_000,
  maxBytes: 8 * 1024 * 1024,
}

/** 任一块列表在任意嵌套深度携带持久图像时为 true。 */
function listHasImage(blocks: readonly ContentBlock[]): boolean {
  return blocks.some(block => block.type === 'image'
    || block.type === 'tool-result' && listHasImage(block.content))
}

/** 单条消息是否在任意嵌套深度携带图像。 */
function messageHasImage(message: Message): boolean {
  return listHasImage(message.content)
}

/** 按顺序收集所有持久图像引用（递归进工具结果）。 */
function collectRefs(blocks: readonly ContentBlock[], refs: ImageAttachmentRef[]): void {
  for (const block of blocks) {
    if (block.type === 'image') refs.push(block.attachment)
    else if (block.type === 'tool-result') collectRefs(block.content, refs)
  }
}

/** 由一个块列表构造有序内容分片（文本 + 内联图像）。 */
async function contentParts(
  blocks: readonly ContentBlock[],
  versions: ReadonlyMap<ImageAttachmentRef['attachmentId'], RequestImageAttachment>,
  resolveImageAccess: ImageAttachmentAccessResolver | undefined,
): Promise<WirePart[]> {
  const parts: WirePart[] = []
  for (const block of blocks) {
    if (block.type === 'text') {
      if (block.text.length > 0) parts.push({ type: 'text', text: block.text })
      continue
    }
    if (block.type === 'image') {
      const version = versions.get(block.attachment.attachmentId)
      if (version === undefined) {
        throw new LlmError(`CodeBuddy request image ${block.attachment.attachmentId} was not prepared.`, 'INVALID_REQUEST')
      }
      const access = resolveImageAccess?.(block.attachment)
      const handle = requestImageHandleText(block.attachment, version, access)
      if (parts.length > 0) parts.push({ type: 'text', text: `\n${handle}` })
      else parts.push({ type: 'text', text: handle })
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${version.mediaType};base64,${Buffer.from(version.data).toString('base64')}` },
      })
      continue
    }
    if (block.type === 'tool-result') {
      parts.push(...await contentParts(block.content, versions, resolveImageAccess))
    }
  }
  return parts
}

/** 把全文本的内容数组压缩回纯字符串的线缆形式。 */
function compactParts(parts: WirePart[]): WireContent {
  if (parts.every(part => part.type === 'text')) return parts.map(part => (part as { type: 'text', text: string }).text).join('')
  return parts
}

/** 序列化一条 assistant 回合（重放的工具调用共用同一个 id 绑定）。 */
function serializeAssistant(message: Message): WireMessage {
  const text = flattenText(message.content)
  const reasoning = message.content
    .filter(block => block.type === 'reasoning')
    .map(block => block.text)
    .join('')
  const toolCalls = message.content
    .filter(block => block.type === 'tool-call')
    .map(block => ({
      id: boundToolCallId(block.id as unknown as string),
      type: 'function' as const,
      function: { name: block.name, arguments: block.arguments },
    }))
  return {
    role: 'assistant',
    content: text,
    ...toolCalls.length > 0 && reasoning.length > 0 ? { reasoning_content: reasoning } : {},
    ...toolCalls.length > 0 ? { tool_calls: toolCalls } : {},
  }
}

/**
 * 把包含图像内容的会话序列化为 OpenAI 兼容的线缆消息。工具结果保持纯字符串的
 * `role: 'tool'` 条目；嵌在工具结果里的任何图像由紧随其后的 `role: 'user'`
 * 消息携带（带「工具结果图像」文本标记，与 DeepSeek 和 pi-ai adapter 一致）。
 *
 * @param messages - 请求尺寸卸载后的临时请求历史。
 * @param attachments - 持久附件服务（`ctx.attachments`）。
 * @param resolveImageAccess - 可选的当前执行世界访问权限，用于文本把手。
 * @returns 带内联 `image_url` 分片的有序线缆消息。
 */
export async function serializeMessagesWithImages(
  messages: readonly Message[],
  attachments: AttachmentStore,
  resolveImageAccess: ImageAttachmentAccessResolver | undefined,
): Promise<WireMessage[]> {
  // 拒绝 OpenAI 兼容历史无法承载的图像角色。
  for (const message of messages) {
    if (message.role !== 'user' && messageHasImage(message)) {
      throw new LlmError(
        `CodeBuddy cannot represent an image in an in-history ${message.role} message`,
        'UNSUPPORTED_CONTENT',
      )
    }
  }

  const refs: ImageAttachmentRef[] = []
  for (const message of messages) {
    if (messageHasImage(message)) collectRefs(message.content, refs)
  }
  const versions = new Map<ImageAttachmentRef['attachmentId'], RequestImageAttachment>()
  await Promise.all(refs.map(async ref => {
    versions.set(ref.attachmentId, await attachments.readImageRequest(ref, REQUEST_IMAGE_POLICY))
  }))

  const wire: WireMessage[] = []
  let pendingToolImages: WirePart[] = []
  const flushToolImages = (): void => {
    if (pendingToolImages.length === 0) return
    wire.push({
      role: 'user',
      content: [{ type: 'text', text: '[Image included from the previous tool result]' }, ...pendingToolImages],
    })
    pendingToolImages = []
  }

  for (const message of messages) {
    if (message.role === 'system') {
      flushToolImages()
      wire.push({ role: 'system', content: flattenText(message.content) })
      continue
    }
    if (message.role === 'assistant') {
      flushToolImages()
      wire.push(serializeAssistant(message))
      continue
    }
    const regular = message.content.filter(block => block.type !== 'tool-result')
    const toolResults = message.content.filter(block => block.type === 'tool-result')
    const regularParts = await contentParts(regular, versions, resolveImageAccess)
    const content = compactParts(regularParts)
    const contentEmpty = typeof content === 'string' ? content.length === 0 : content.length === 0
    if (!contentEmpty || toolResults.length === 0) {
      flushToolImages()
      wire.push({ role: 'user', content })
    }
    // 嵌在工具结果里的图像被推迟进一条 user 消息，使 `role: 'tool'` 条目保持
    // 纯字符串（OpenAI 线缆约束）。
    const toolImageParts: WirePart[] = []
    for (const result of toolResults) {
      const resultParts = await contentParts(result.content, versions, resolveImageAccess)
      const resultText = resultParts.filter(part => part.type === 'text')
        .map(part => (part as { type: 'text', text: string }).text).join('')
      const hasToolImage = resultParts.some(part => part.type === 'image_url')
      if (hasToolImage) {
        toolImageParts.push(...resultParts.filter(part => part.type === 'image_url'))
      }
      wire.push({
        role: 'tool',
        tool_call_id: boundToolCallId(result.toolCallId as unknown as string),
        content: resultText.length > 0 ? resultText : '(no output)',
      })
    }
    if (toolImageParts.length > 0) pendingToolImages = toolImageParts
  }
  flushToolImages()
  return wire
}

/** 请求至少携带一个持久图像块时为 true。 */
export function hasRequestImages(messages: readonly Message[]): boolean {
  return messages.some(message => messageHasImage(message))
}

/**
 * 为含图像的历史构造完整的 chat-completions 请求。
 *
 * @param options - harness 请求（模型、历史、system、工具、采样）。
 * @param attachments - 持久附件服务。
 * @param resolveImageAccess - 可选的当前工具访问权限，用于文本把手。
 * @returns 完全具体化的请求体。
 */
export async function serializeRequestWithImages(
  options: GenerateOptions,
  attachments: AttachmentStore,
  resolveImageAccess: ImageAttachmentAccessResolver | undefined,
): Promise<WireRequest> {
  const messages = await serializeMessagesWithImages(options.messages, attachments, resolveImageAccess)
  return buildWireRequest(messages, options)
}
