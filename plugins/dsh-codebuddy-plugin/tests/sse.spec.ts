import { describe, expect, it, vi } from 'vitest'
import { parseSse } from '../src/host/sse.ts'

describe('parseSse', () => {
  it('propagates a reader failure instead of leaving the consumer parked', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"ok":true}\n\n'))
        queueMicrotask(() => controller.error(new Error('upstream reset')))
      },
    })
    const iterator = parseSse(stream)[Symbol.asyncIterator]()

    await expect(iterator.next()).resolves.toMatchObject({
      done: false,
      value: '{"ok":true}',
    })
    await expect(iterator.next()).rejects.toThrow('upstream reset')
  })

  it('does not leak the reader failure as an unhandled rejection', async () => {
    const unhandled = vi.fn()
    const onUnhandled = (reason: unknown): void => { unhandled(reason) }
    process.on('unhandledRejection', onUnhandled)
    try {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"ok":true}\n\n'))
          queueMicrotask(() => controller.error(new Error('socket reset')))
        },
      })
      const iterator = parseSse(stream)[Symbol.asyncIterator]()
      await iterator.next()
      await expect(iterator.next()).rejects.toThrow('socket reset')
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })
})
