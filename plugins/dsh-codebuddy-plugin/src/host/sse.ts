/**
 * 把 SSE 字节流解码为事件的 `data` 载荷。
 *
 * 帧解析用 `eventsource-parser` 的 `createParser` 回调 API 配合手动 reader，
 * 避开了 `TextDecoderStream`/`EventSourceParserStream` 的 DOM 类型耦合，并且在
 * Node 宿主上行为一致。字面量 `[DONE]` 哨兵会被产出，让调用方掌握最终冲刷；
 * 在它之前遇到 EOF 即是截断，而不是一个可完成的响应。
 *
 * @module dsh-codebuddy/sse
 */

import { createParser } from 'eventsource-parser'
import { LlmError } from '@deepseek-ai/dsh-llm'

/** OpenAI 兼容流在最后一个块之后发送的终结载荷。 */
export const DONE = '[DONE]'

/**
 * 把 SSE 字节流解析为 data 载荷。
 * @param stream - 原始 SSE 字节分块；读取可能在任意位置切分。
 * @param onComment - 传输活动回调；注释永远不会进入载荷流。
 * @returns 按到达顺序产出每个载荷，`[DONE]` 在最后。
 * @throws LlmError 流未以 `[DONE]` 结束时抛 `STREAM_CLOSED`。
 */
export async function* parseSse(
  stream: ReadableStream<Uint8Array>,
  onComment?: (comment: string) => void,
): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  const reader = stream.getReader()

  // 解析器把 data 载荷推进这个队列；生成器迭代时将其排空，让循环的控制流
  // 保持直观。
  const queue: string[] = []
  let ended = false
  let pumpFailed = false
  let pumpError: unknown
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

  // Observe pump failures immediately. Waiting until the generator's `finally`
  // would leave a rejected promise unhandled while the consumer is asleep in
  // the wake promise, which is fatal under dsh's fail-loud rejection policy.
  const pumping = pump().catch(error => {
    pumpFailed = true
    pumpError = error
    ended = true
    resolveWake?.()
  })

  try {
    while (true) {
      while (queue.length > 0) {
        const data = queue.shift() as string
        yield data
        if (data === DONE) return
      }
      if (pumpFailed) throw pumpError
      if (ended) {
        throw new LlmError('CodeBuddy SSE stream ended without [DONE]', 'STREAM_CLOSED')
      }
      // 等待更多数据，而不忙轮询。
      await new Promise<void>((resolve) => {
        resolveWake = resolve
      })
    }
  } finally {
    ended = true
    await reader.cancel().catch(() => {
      // 流可能已经关闭；取消尽力而为。
    })
    // `pumping` has an attached rejection handler above and therefore always
    // settles here after recording the reader failure for the consumer loop.
    await pumping
  }
}
