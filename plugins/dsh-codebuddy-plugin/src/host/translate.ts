/**
 * Translate CodeBuddy SSE payloads into the harness `StreamChunk` protocol.
 *
 * One open block per text, reasoning, and tool-call index, with indexes
 * allocated in first-seen order. `block-end`, `usage`, and `finish` are all
 * deferred to the `[DONE]` sentinel: that is what satisfies the protocol's two
 * hard obligations — usage strictly before finish, and nothing at all after
 * finish — including for providers that send a trailing usage-only chunk.
 *
 * @module dsh-codebuddy/translate
 */

import { EMPTY_RESPONSE_CODE, LlmError, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, FinishReason, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm'
import { DONE } from './sse.ts'
import type { WireChunk, WireUsage } from './types.ts'

/** The subset of a harness Tool definition needed to repair wire arguments. */
interface ToolDefinition {
  name: string
  parameters: Record<string, unknown>
}

/** JSON Schema object, narrowed only enough for property-level inspection. */
interface ObjectSchema {
  properties?: Record<string, unknown>
}

/** Return whether a property schema intentionally accepts any JSON value. */
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

/** Decode one object/array value that CodeBuddy emitted as a JSON string. */
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
 * Repair CodeBuddy's occasional double encoding of unconstrained Tool fields.
 *
 * A property schema with no `type` is valid JSON Schema and means that its
 * value may have any JSON type. CodeBuddy can nevertheless render an object or
 * array chosen for such a field as a JSON string. Decode exactly that shape;
 * typed and otherwise constrained fields, scalar strings, and malformed JSON
 * remain byte-for-byte untouched.
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

/** One block under assembly. */
interface OpenBlock {
  index: number
  kind: 'text' | 'reasoning' | 'tool-call'
  text: string
  callId?: string
  name?: string
}

/**
 * Map the wire `finish_reason` vocabulary onto the harness one.
 * @param reason - the wire value.
 * @returns the mapped reason; anything unrecognized becomes an error finish
 *   carrying the uppercased wire value as its code, so a new provider reason
 *   surfaces as itself instead of being silently reported as a clean stop.
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
 * Map wire usage onto the harness's disjoint counts.
 *
 * OpenAI-compatible `prompt_tokens` includes cache hits, while the harness
 * convention reports uncached input separately, so cache reads are subtracted.
 * @param usage - the wire usage block.
 * @returns disjoint token counts.
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

/** Assemble the final block for one open block. */
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
 * Consume `[DONE]`-terminated SSE payloads and yield harness chunks.
 * @param payloads - payloads from `parseSse`.
 * @param tools - original Tool schemas used to repair CodeBuddy wire arguments.
 * @returns deltas as they arrive, with block ends, usage, and finish flushed at `[DONE]`.
 * @throws LlmError `MALFORMED_RESPONSE` on unparseable JSON, `STREAM_CLOSED`
 *   when the payload source ends without the sentinel.
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
        // A clean stop that produced no content at all is a degenerate
        // completion, not a valid empty answer: reporting it as success would
        // hand the loop a turn with nothing in it.
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

      // Reasoning first: thinking models interleave it ahead of visible text.
      // CodeBuddy models vary in which field they use, so both spellings are
      // accepted. An empty first delta must not open a block.
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
        // Only the opening delta carries the name and id; CodeBuddy repeats
        // both as `""` on every continuation frame for the same index. Treating
        // those as values would erase what was already learned and hand the
        // harness a nameless call, which it rejects as UNKNOWN_TOOL. So a
        // non-empty value is required to overwrite, not merely a defined one.
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

    // Usage may ride the finish chunk or arrive as a trailing usage-only
    // chunk; the latest wins. CodeBuddy sends an explicit `usage: null` on
    // every non-final chunk, so this must be a null-tolerant test: an
    // `!== undefined` guard passes null straight through and crashes.
    if (chunk.usage !== undefined && chunk.usage !== null) {
      pendingUsage = mapUsage(chunk.usage)
    }
  }

  throw new LlmError('CodeBuddy SSE payload stream ended without [DONE]', 'STREAM_CLOSED')
}
