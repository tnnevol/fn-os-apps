/**
 * 把 CodeBuddy 的 SSE 载荷翻译成 harness 的 `StreamChunk` 协议。
 *
 * 每个文本、推理、工具调用索引各对应一个打开的块，索引按首次出现顺序分配。
 * `block-end`、`usage`、`finish` 全部推迟到 `[DONE]` 哨兵处：正是这一点满足
 * 协议的两条硬性约束——usage 必须严格早于 finish，finish 之后不得再有任何
 * 内容——对会补发一个只含 usage 的尾块的提供方同样成立。
 *
 * @module dsh-codebuddy/translate
 */

import { EMPTY_RESPONSE_CODE, LlmError, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, FinishReason, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm'
import { DONE } from './sse.ts'
import type { WireChunk, WireUsage } from './types.ts'

/** 修复线缆参数时需要的 harness Tool 定义子集。 */
interface ToolDefinition {
  name: string
  parameters: Record<string, unknown>
}

/** JSON Schema 对象，仅收窄到足以做属性级检查的程度。 */
interface ObjectSchema {
  properties?: Record<string, unknown>
}

/** 返回某属性 schema 是否有意接受任意 JSON 值。 */
function acceptsAnyJsonValue(schema: unknown): boolean {
  if (schema === true) return true
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) return false
  const record = schema as Record<string, unknown>
  return !('type' in record)
    && !('$ref' in record)
    && !('const' in record)
    && !('enum' in record)
    && !('allOf' in record)
    && !('anyOf' in record)
    && !('oneOf' in record)
    && !('not' in record)
}

/** 解码 CodeBuddy 以 JSON 字符串形式发出的某个对象/数组值。 */
function decodeNestedComposite(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!(text.startsWith('{') && text.endsWith('}'))
    && !(text.startsWith('[') && text.endsWith(']'))) return value
  try {
    const decoded: unknown = JSON.parse(text)
    return decoded !== null && typeof decoded === 'object' ? decoded : value
  } catch {
    return value
  }
}

/**
 * 修复 CodeBuddy 对无约束 Tool 字段偶发的双重编码。
 *
 * 没有 `type` 的属性 schema 是合法 JSON Schema，含义是该属性的值可为任意 JSON
 * 类型。CodeBuddy 仍可能把为这类字段选出的对象或数组渲染成 JSON 字符串。只解码
 * 恰好这一形态；有类型或以其他方式受约束的字段、标量字符串、以及非法 JSON 都
 * 保持逐字节不变。
 */
export function normalizeToolArguments(
  name: string,
  argumentsText: string,
  tools: readonly ToolDefinition[],
): string {
  const tool = tools.find(candidate => candidate.name === name)
  const properties = (tool?.parameters as ObjectSchema | undefined)?.properties
  if (properties === undefined) return argumentsText

  let args: unknown
  try {
    args = JSON.parse(argumentsText)
  } catch {
    return argumentsText
  }
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return argumentsText

  const record = args as Record<string, unknown>
  let changed = false
  for (const [key, schema] of Object.entries(properties)) {
    if (!acceptsAnyJsonValue(schema) || !(key in record)) continue
    const decoded = decodeNestedComposite(record[key])
    if (decoded !== record[key]) {
      record[key] = decoded
      changed = true
    }
  }
  return changed ? JSON.stringify(record) : argumentsText
}

/** 组装过程中的一个已打开块。 */
interface OpenBlock {
  index: number
  kind: 'text' | 'reasoning' | 'tool-call'
  text: string
  callId?: string
  name?: string
}

/**
 * 把线缆的 `finish_reason` 词表映射到 harness 的词表。
 * @param reason - 线缆值。
 * @returns 映射后的原因；任何无法识别的值都变成携带大写线缆值作为 code 的
 *   error finish，于是提供方新出现的理由会以本来面目浮现，而不是被静默当成
 *   一次干净的停止上报。
 */
export function mapFinishReason(reason: string): FinishReason {
  switch (reason) {
    case 'stop': return { kind: 'stop' }
    case 'tool_calls': return { kind: 'tool-calls' }
    case 'length': return { kind: 'max-tokens' }
    default:
      return {
        kind: 'error',
        failure: { message: `model stopped: ${reason}`, code: reason.toUpperCase() },
      }
  }
}

/**
 * 把线缆的 usage 映射到 harness 的互斥计数。
 *
 * OpenAI 兼容的 `prompt_tokens` 包含缓存命中，而 harness 约定把未命中缓存的
 * 输入单独上报，因此要减去缓存读取量。
 * @param usage - 线缆的 usage 块。
 * @returns 互斥的 token 计数。
 */
export function mapUsage(usage: WireUsage): TokenUsage {
  const cacheRead = usage.prompt_tokens_details?.cached_tokens ?? usage.prompt_cache_hit_tokens
  const reasoning = usage.completion_tokens_details?.reasoning_tokens
  const prompt = usage.prompt_tokens ?? 0
  return {
    inputTokens: Math.max(0, prompt - (cacheRead ?? 0)),
    outputTokens: usage.completion_tokens ?? 0,
    ...cacheRead === undefined ? {} : { cacheReadTokens: cacheRead },
    ...reasoning === undefined ? {} : { reasoningTokens: reasoning },
  }
}

/** 为一个已打开块组装出最终块。 */
function closeBlock(block: OpenBlock, tools: readonly ToolDefinition[]): ContentBlock {
  switch (block.kind) {
    case 'text':
      return { type: 'text', text: block.text }
    case 'reasoning':
      return { type: 'reasoning', text: block.text }
    case 'tool-call':
      return {
        type: 'tool-call',
        id: ToolCallId(block.callId ?? ''),
        name: block.name ?? '',
        arguments: normalizeToolArguments(block.name ?? '', block.text, tools),
      }
  }
}

/**
 * 消费以 `[DONE]` 结尾的 SSE 载荷并产出 harness 块。
 * @param payloads - 来自 `parseSse` 的载荷。
 * @param tools - 原始 Tool schema，用于修复 CodeBuddy 的线缆参数。
 * @returns 到达即产出的增量；块结束、usage 与 finish 在 `[DONE]` 处冲刷。
 * @throws LlmError JSON 无法解析时抛 `MALFORMED_RESPONSE`；载荷源未以哨兵
 *   结束即终止时抛 `STREAM_CLOSED`。
 */
export async function* translate(
  payloads: AsyncIterable<string>,
  tools: readonly ToolDefinition[] = [],
): AsyncGenerator<StreamChunk> {
  let nextIndex = 0
  let textBlock: OpenBlock | undefined
  let reasoningBlock: OpenBlock | undefined
  const toolBlocks = new Map<number, OpenBlock>()
  const order: OpenBlock[] = []
  let pendingFinish: FinishReason | undefined
  let pendingUsage: TokenUsage | undefined

  const open = (kind: OpenBlock['kind']): OpenBlock => {
    const block: OpenBlock = { index: nextIndex++, kind, text: '' }
    order.push(block)
    return block
  }

  for await (const payload of payloads) {
    if (payload === DONE) {
      for (const block of order) {
        yield { type: 'block-end', index: block.index, block: closeBlock(block, tools) }
      }
      if (pendingUsage !== undefined) yield { type: 'usage', usage: pendingUsage }
      const reason = pendingFinish ?? { kind: 'stop' as const }
      yield {
        type: 'finish',
        // 一次没有产出任何内容的干净停止是退化的补全，不是合法的空回答：
        // 把它当成功上报，等于递给主循环一个空无一物的回合。
        reason: reason.kind === 'stop' && order.length === 0
          ? {
              kind: 'error',
              failure: {
                message: 'model returned a completed response with no content',
                code: EMPTY_RESPONSE_CODE,
              },
            }
          : reason,
      }
      return
    }

    let chunk: WireChunk
    try {
      chunk = JSON.parse(payload) as WireChunk
    } catch {
      throw new LlmError(
        `malformed CodeBuddy SSE payload: ${payload.slice(0, 120)}`,
        'MALFORMED_RESPONSE',
      )
    }

    for (const choice of chunk.choices ?? []) {
      const delta = choice.delta

      // 推理放在前面：思考型模型会让推理先于可见文本交错出现。
      // CodeBuddy 各模型使用的字段不一，因此两种拼写都接受。
      // 首个空 delta 绝不能开块。
      const reasoning = delta?.reasoning_content ?? delta?.reasoning
      if (typeof reasoning === 'string' && reasoning.length > 0) {
        if (reasoningBlock === undefined) {
          reasoningBlock = open('reasoning')
          yield { type: 'block-start', index: reasoningBlock.index, blockType: 'reasoning' }
        }
        reasoningBlock.text += reasoning
        yield { type: 'reasoning-delta', index: reasoningBlock.index, text: reasoning }
      }

      const content = delta?.content
      if (typeof content === 'string' && content.length > 0) {
        if (textBlock === undefined) {
          textBlock = open('text')
          yield { type: 'block-start', index: textBlock.index, blockType: 'text' }
        }
        textBlock.text += content
        yield { type: 'text-delta', index: textBlock.index, text: content }
      }

      for (const call of delta?.tool_calls ?? []) {
        let block = toolBlocks.get(call.index)
        if (block === undefined) {
          block = open('tool-call')
          toolBlocks.set(call.index, block)
          yield { type: 'block-start', index: block.index, blockType: 'tool-call' }
        }
        // 只有首个 delta 携带 name 与 id；CodeBuddy 在同一 index 的每个后续
        // 帧里把两者重复为 `""`。把它们当值处理会抹掉已学到的内容，并递给
        // harness 一个无名调用——harness 会以 UNKNOWN_TOOL 拒绝它。因此覆盖
        // 要求非空值，而不仅仅是「有定义」。
        if (call.id !== undefined && call.id.length > 0) block.callId = call.id
        const name = call.function?.name
        if (name !== undefined && name.length > 0) block.name = name
        const fragment = call.function?.arguments ?? ''
        block.text += fragment
        yield {
          type: 'tool-call-delta',
          index: block.index,
          id: ToolCallId(block.callId ?? ''),
          ...block.name === undefined ? {} : { name: block.name },
          argumentsDelta: fragment,
        }
      }

      if (typeof choice.finish_reason === 'string') {
        pendingFinish = mapFinishReason(choice.finish_reason)
      }
    }

    // usage 可能搭在 finish 块上，也可能作为只含 usage 的尾块到达；以最新
    // 一次为准。CodeBuddy 在每个非最终块上都发送显式的 `usage: null`，因此
    // 这里必须是容忍 null 的判断：`!== undefined` 守卫会让 null 直接穿透
    // 并导致崩溃。
    if (chunk.usage !== undefined && chunk.usage !== null) {
      pendingUsage = mapUsage(chunk.usage)
    }
  }

  throw new LlmError('CodeBuddy SSE payload stream ended without [DONE]', 'STREAM_CLOSED')
}
