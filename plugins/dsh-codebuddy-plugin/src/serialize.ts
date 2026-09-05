/**
 * Serialize harness messages into a CodeBuddy (OpenAI-compatible) chat request.
 *
 * User text is joined, assistant text becomes `content`, tool calls become
 * `tool_calls`, and each tool result becomes its own `role: 'tool'` message —
 * the harness carries tool results inside user messages, which this wire route
 * does not accept.
 *
 * @module dsh-codebuddy/serialize
 */

import { contentHasImage, LlmError } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions, Message } from '@deepseek-ai/dsh-llm'
import type { WireMessage, WireRequest, WireTool } from './types.ts'

/** Join the text blocks of one message. */
function flattenText(blocks: readonly ContentBlock[]): string {
  return blocks
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
}

/**
 * CodeBuddy's chat gateway rejects tool-call ids longer than 64 characters
 * (`Invalid 'input[n].call_id': string too long`). The harness replays durable
 * history verbatim, so a session that earlier ran a different adapter (whose
 * tool-call ids exceed 64 chars, e.g. the pi-ai/codex `call_...|fc_...` ids)
 * would otherwise 400 the moment a CodeBuddy custom model resumes it.
 *
 * Ids that already fit pass through untouched; longer ones are replaced with a
 * stable short alias derived from the original. Determinism matters twice:
 * the assistant `tool_calls[].id` and its matching `role: 'tool'` message's
 * `tool_call_id` both derive from the same harness id, so a pure function keeps
 * them paired on the wire regardless of ordering.
 * @param id - the harness tool-call id.
 * @returns the same id when it fits, otherwise a deterministic ≤64-char alias.
 */
function boundToolCallId(id: string): string {
  if (id.length <= 64) return id
  // FNV-1a 64-bit over the original, hex-encoded. `call_` + 16 hex chars is a
  // stable, collision-resistant short form that stays far below the cap.
  let hash = 0xcbf29ce484222325n
  for (let i = 0; i < id.length; i++) {
    hash ^= BigInt(id.charCodeAt(i))
    hash = (hash * 0x100000001b3n) & 0xFFFFFFFFFFFFFFFFn
  }
  return `call_${hash.toString(16).padStart(16, '0')}`
}

/**
 * Refuse image content before any text flattening could silently drop it.
 * @param blocks - the message content.
 * @param supportsImages - whether the selected model declared image input.
 */
function assertSupportedContent(blocks: readonly ContentBlock[], supportsImages: boolean): void {
  if (!supportsImages && contentHasImage(blocks)) {
    throw new LlmError(
      'The selected CodeBuddy model does not accept image content.',
      'UNSUPPORTED_CONTENT',
    )
  }
}

/** Serialize one assistant turn: text, replayed reasoning, and tool calls. */
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
    // Always a string, never null: a reasoning-only or pure tool-call turn
    // sits durably in the session log, and gateways that reject null content
    // would break every later turn of that session rather than just this one.
    content: text,
    // Reasoning is replayed only on tool-call turns, where providers that
    // support thinking-mode passback require it; elsewhere it is ignored and
    // would only cost tokens.
    ...toolCalls.length > 0 && reasoning.length > 0 ? { reasoning_content: reasoning } : {},
    ...toolCalls.length > 0 ? { tool_calls: toolCalls } : {},
  }
}

/**
 * Serialize the conversation in order.
 * @param messages - the harness conversation.
 * @param supportsImages - whether the selected model declared image input.
 * @returns the wire messages, each tool result expanded into its own entry.
 */
export function serializeMessages(
  messages: readonly Message[],
  supportsImages: boolean,
): WireMessage[] {
  const wire: WireMessage[] = []
  for (const message of messages) {
    assertSupportedContent(message.content, supportsImages)
    if (message.role === 'system') {
      wire.push({ role: 'system', content: flattenText(message.content) })
      continue
    }
    if (message.role === 'assistant') {
      wire.push(serializeAssistant(message))
      continue
    }
    const toolResults = message.content.filter(block => block.type === 'tool-result')
    const text = flattenText(message.content)
    if (text.length > 0 || toolResults.length === 0) {
      wire.push({ role: 'user', content: text })
    }
    for (const result of toolResults) {
      wire.push({
        role: 'tool',
        tool_call_id: boundToolCallId(result.toolCallId as unknown as string),
        // Empty output still needs some content on the wire.
        content: flattenText(result.content) || '(no output)',
      })
    }
  }
  return wire
}

/**
 * Build the chat-completions request body. Always streaming with usage
 * reporting; absent options are omitted rather than sent as null so the
 * provider's own defaults apply.
 * @param options - the assembled harness request.
 * @param supportsImages - whether the selected model declared image input.
 * @returns the request body.
 */
export function serializeRequest(
  options: GenerateOptions,
  supportsImages: boolean,
): WireRequest {
  const messages: WireMessage[] = []
  if (options.system !== undefined) {
    messages.push({ role: 'system', content: options.system })
  }
  messages.push(...serializeMessages(options.messages, supportsImages))

  const tools: WireTool[] | undefined = options.tools?.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))

  return {
    model: options.model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    ...tools !== undefined && tools.length > 0 ? { tools } : {},
    ...options.temperature === undefined ? {} : { temperature: options.temperature },
    ...options.maxTokens === undefined ? {} : { max_tokens: options.maxTokens },
    ...options.stop === undefined ? {} : { stop: options.stop },
    // The harness materializes a model's default effort into every request, so
    // this is normally set even when the caller chose nothing explicitly. The
    // id is CodeBuddy's own spelling, forwarded verbatim.
    ...options.reasoningEffort === undefined ? {} : { reasoning_effort: options.reasoningEffort },
  }
}
