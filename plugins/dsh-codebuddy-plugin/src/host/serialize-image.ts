/**
 * CodeBuddy chat image serialization.
 *
 * CodeBuddy's chat plane is OpenAI-compatible: user content that carries a
 * durable image block is sent as an ordered content array in which each image
 * becomes `{ type: 'image_url', image_url: { url: <data URI> } }` with a small
 * text handle before it (the same stable text the harness shows text-only
 * models, so replays read consistently). Tool-result images follow their
 * string-only tool message in a separate user message.
 *
 * Durable bytes stay out of the session messages: this module reads the
 * normalized request version through the attachment store (`ctx.attachments`)
 * exactly like the DeepSeek and pi-ai adapters do.
 *
 * @module dsh-codebuddy/serialize-image
 */

import { LlmError, requestImageHandleText } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions, ImageAttachmentAccessResolver, Message } from '@deepseek-ai/dsh-llm'
import type { AttachmentStore, ImageAttachmentRef, ImageRequestPolicy, RequestImageAttachment } from '@deepseek-ai/dsh-attachment'
import { boundToolCallId, buildWireRequest, flattenText } from './serialize.ts'
import type { WireContent, WireMessage, WirePart, WireRequest } from './types.ts'

/** Re-exported wire request type for adapter callers. */
export type { WireRequest }

/** Exact request-image policy used for the chat route (bytes/pixels). */
const REQUEST_IMAGE_POLICY: ImageRequestPolicy = {
  // Keep the harness default conservative so very large screenshots do not
  // inflate the request beyond what CodeBuddy's own IDE client would send.
  maxPixels: 4_000_000,
  maxBytes: 8 * 1024 * 1024,
}

/** True when one block list carries a durable image at any nesting depth. */
function listHasImage(blocks: readonly ContentBlock[]): boolean {
  return blocks.some(block => block.type === 'image'
    || block.type === 'tool-result' && listHasImage(block.content))
}

/** Whether one message carries an image at any nesting depth. */
function messageHasImage(message: Message): boolean {
  return listHasImage(message.content)
}

/** Collect every durable image ref (recursing tool results) in order. */
function collectRefs(blocks: readonly ContentBlock[], refs: ImageAttachmentRef[]): void {
  for (const block of blocks) {
    if (block.type === 'image') refs.push(block.attachment)
    else if (block.type === 'tool-result') collectRefs(block.content, refs)
  }
}

/** Build ordered content parts from one block list (text + inline images). */
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

/** Compact all-text content arrays back to the plain string wire form. */
function compactParts(parts: WirePart[]): WireContent {
  if (parts.every(part => part.type === 'text')) return parts.map(part => (part as { type: 'text', text: string }).text).join('')
  return parts
}

/** Serialize one assistant turn (replayed tool calls use the shared id bound). */
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
 * Serialize a conversation that contains image content into OpenAI-compatible
 * wire messages. Tool results stay string-only `role: 'tool'` entries; any
 * image nested in a tool result is carried by the following `role: 'user'`
 * message (with a "tool result image" text marker, mirroring the DeepSeek and
 * pi-ai adapters).
 *
 * @param messages - transient request history after request-size offloading.
 * @param attachments - durable attachment service (`ctx.attachments`).
 * @param resolveImageAccess - optional current execution-world access for text handles.
 * @returns ordered wire messages with inline `image_url` parts.
 */
export async function serializeMessagesWithImages(
  messages: readonly Message[],
  attachments: AttachmentStore,
  resolveImageAccess: ImageAttachmentAccessResolver | undefined,
): Promise<WireMessage[]> {
  // Reject image roles the OpenAI-compatible history cannot carry.
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
    // Images nested inside tool results are deferred into one user message so
    // the `role: 'tool'` entries stay string-only (OpenAI wire constraint).
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

/** True when the request carries at least one durable image block. */
export function hasRequestImages(messages: readonly Message[]): boolean {
  return messages.some(message => messageHasImage(message))
}

/**
 * Build the full chat-completions request for image-bearing history.
 *
 * @param options - harness request (model, history, system, tools, sampling).
 * @param attachments - durable attachment service.
 * @param resolveImageAccess - optional current tool access for text handles.
 * @returns the fully materialized request body.
 */
export async function serializeRequestWithImages(
  options: GenerateOptions,
  attachments: AttachmentStore,
  resolveImageAccess: ImageAttachmentAccessResolver | undefined,
): Promise<WireRequest> {
  const messages = await serializeMessagesWithImages(options.messages, attachments, resolveImageAccess)
  return buildWireRequest(messages, options)
}
