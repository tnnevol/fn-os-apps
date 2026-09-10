/**
 * Decode an SSE byte stream into event `data` payloads.
 *
 * Framing uses `eventsource-parser`'s `createParser` callback API over a
 * manual reader, which avoids the `TextDecoderStream`/`EventSourceParserStream`
 * DOM type coupling and works identically on the Node host. The literal
 * `[DONE]` sentinel is yielded so the caller owns final flushing, and EOF
 * before it is truncation rather than a completable response.
 *
 * @module dsh-codebuddy/sse
 */

import { createParser } from 'eventsource-parser'
import { LlmError } from '@deepseek-ai/dsh-llm'

/** The terminal payload an OpenAI-compatible stream sends after the last chunk. */
export const DONE = '[DONE]'

/**
 * Parse an SSE byte stream into data payloads.
 * @param stream - raw SSE byte chunks; reads may split anywhere.
 * @param onComment - transport-activity callback; comments never enter the payload stream.
 * @returns each payload in arrival order, `[DONE]` last.
 * @throws LlmError `STREAM_CLOSED` when the stream ends without `[DONE]`.
 */
export async function* parseSse(
  stream: ReadableStream<Uint8Array>,
  onComment?: (comment: string) => void,
): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  const reader = stream.getReader()

  // Data payloads are pushed into this queue by the parser; the generator
  // drains it as it iterates, keeping the loop's flow straightforward.
  const queue: string[] = []
  let ended = false
  let resolveWake: (() => void) | undefined

  const parser = createParser({
    onEvent(event) {
      queue.push(event.data)
      resolveWake?.()
    },
    ...(onComment === undefined ? {} : { onComment }),
  })

  const pump = async (): Promise<void> => {
    while (!ended) {
      const { done, value } = await reader.read()
      if (done) {
        ended = true
        resolveWake?.()
        return
      }
      parser.feed(decoder.decode(value, { stream: true }))
      resolveWake?.()
    }
  }

  const pumping = pump()

  try {
    while (true) {
      while (queue.length > 0) {
        const data = queue.shift() as string
        yield data
        if (data === DONE) return
      }
      if (ended) {
        throw new LlmError('CodeBuddy SSE stream ended without [DONE]', 'STREAM_CLOSED')
      }
      // Wait for more data without busy-polling.
      await new Promise<void>((resolve) => {
        resolveWake = resolve
      })
    }
  } finally {
    ended = true
    await reader.cancel().catch(() => {
      // The stream may already be closed; cancellation is best-effort.
    })
    await pumping.catch(() => {
      // A read error surfaces through `pumping`; the generator already threw.
    })
  }
}
