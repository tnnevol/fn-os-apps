/**
 * 把 harness 消息序列化为 CodeBuddy（OpenAI 兼容）聊天请求。
 *
 * 用户文本被拼接，assistant 文本成为 `content`，工具调用成为 `tool_calls`，
 * 每个工具结果各自成为一条 `role: 'tool'` 消息——harness 把工具结果装在 user
 * 消息里，而这条线缆路由不接受那种形式。
 *
 * @module dsh-codebuddy/serialize
 */

import { contentHasImage, LlmError } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions, Message } from '@deepseek-ai/dsh-llm'
import type { WireMessage, WireRequest, WireTool } from './types.ts'

/** 拼接一条消息的文本块。 */
export function flattenText(blocks: readonly ContentBlock[]): string {
  return blocks
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
}

/**
 * CodeBuddy 的聊天网关拒绝超过 64 字符的工具调用 id
 * （`Invalid 'input[n].call_id': string too long`）。harness 会逐字重放持久
 * 历史，因此一个早前用其他 adapter 跑过的会话（其工具调用 id 超过 64 字符，
 * 例如 pi-ai/codex 的 `call_...|fc_...` 形式）会在换用 CodeBuddy 自定义模型
 * 恢复的那一刻收到 400。
 *
 * 已符合长度的 id 原样通过；超长的被替换为由原 id 推导出的稳定短别名。确定性
 * 有两处重要：assistant 的 `tool_calls[].id` 与对应 `role: 'tool'` 消息的
 * `tool_call_id` 都从同一个 harness id 推导，纯函数保证它们在线缆上始终配对，
 * 与顺序无关。
 * @param id - harness 的工具调用 id。
 * @returns 符合长度时是原 id；否则是确定性的 ≤64 字符别名。
 */
/** 以确定性的方式把线缆工具调用 id 限制在 CodeBuddy 的 64 字符上限内。 */
export function boundToolCallId(id: string): string {
  if (id.length <= 64) return id
  // 对原 id 做 FNV-1a 64 位散列，十六进制编码。`call_` + 16 个十六进制字符是
  // 一个稳定、抗碰撞的短形式，远低于上限。
  let hash = 0xCBF29CE484222325n
  for (let i = 0; i < id.length; i++) {
    hash ^= BigInt(id.charCodeAt(i))
    hash = (hash * 0x100000001B3n) & 0xFFFFFFFFFFFFFFFFn
  }
  return `call_${hash.toString(16).padStart(16, '0')}`
}

/**
 * 在任何文本扁平化可能静默丢掉图像内容之前，先拒绝它。
 * @param blocks - 消息内容。
 * @param supportsImages - 所选模型是否声明支持图像输入。
 */
function assertSupportedContent(blocks: readonly ContentBlock[], supportsImages: boolean): void {
  if (!supportsImages && contentHasImage(blocks)) {
    throw new LlmError(
      'The selected CodeBuddy model does not accept image content.',
      'UNSUPPORTED_CONTENT',
    )
  }
}

/** 序列化一条 assistant 回合：文本、重放的推理与工具调用。 */
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
    // 始终是字符串，绝不取 null：只含推理或纯工具调用的回合会持久存在于会话
    // 日志中，而拒绝 null content 的网关会把该会话后续的每个回合都弄坏，
    // 而不只是这一回合。
    content: text,
    // 推理只在工具调用回合上重放：支持思考模式回传的提供方在那里要求它；
    // 其他场合它会被忽略，只会白花 token。
    ...toolCalls.length > 0 && reasoning.length > 0 ? { reasoning_content: reasoning } : {},
    ...toolCalls.length > 0 ? { tool_calls: toolCalls } : {},
  }
}

/**
 * 按顺序序列化整个会话。
 * @param messages - harness 的会话消息。
 * @param supportsImages - 所选模型是否声明支持图像输入。
 * @returns 线缆消息；每个工具结果各自展开成一条独立条目。
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
        // 空输出在线缆上也需要一些内容。
        content: flattenText(result.content) || '(no output)',
      })
    }
  }
  return wire
}

/**
 * 构造 chat-completions 请求体。始终流式并上报 usage；缺失的选项被省略而不是
 * 以 null 发送，从而让提供方自己的默认值生效。
 * @param options - 组装好的 harness 请求。
 * @param supportsImages - 所选模型是否声明支持图像输入。
 * @returns 请求体。
 */
export function serializeRequest(
  options: GenerateOptions,
  supportsImages: boolean,
): WireRequest {
  return buildWireRequest(serializeMessages(options.messages, supportsImages), options)
}

/** 把一条已序列化的消息列表包装成完整的 chat-completions 请求。 */
export function buildWireRequest(messages: WireMessage[], options: GenerateOptions): WireRequest {
  const tools: WireTool[] | undefined = options.tools?.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))

  const wireMessages: WireMessage[] = []
  if (options.system !== undefined) {
    wireMessages.push({ role: 'system', content: options.system })
  }
  wireMessages.push(...messages)

  return {
    model: options.model,
    messages: wireMessages,
    stream: true,
    stream_options: { include_usage: true },
    ...tools !== undefined && tools.length > 0 ? { tools } : {},
    ...options.temperature === undefined ? {} : { temperature: options.temperature },
    ...options.maxTokens === undefined ? {} : { max_tokens: options.maxTokens },
    ...options.stop === undefined ? {} : { stop: options.stop },
    // harness 会把模型的默认 effort 具体化进每个请求，因此即使调用方没有显式
    // 选择，这里通常也是有值的。id 用 CodeBuddy 自己的拼写，原样转发。
    ...options.reasoningEffort === undefined ? {} : { reasoning_effort: options.reasoningEffort },
  }
}
