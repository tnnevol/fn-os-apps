import type { ServerResponse } from 'node:http'

export interface SseKeepaliveOptions {
  interval: number
  comment?: string
}

export function attachSseKeepalive(res: ServerResponse, options: SseKeepaliveOptions): () => void {
  const comment = options.comment ?? 'fn-deepseek-harness keep-alive'
  const keepAlive = setInterval(() => {
    if (!res.destroyed && !res.writableEnded) {
      res.write(`: ${comment}\n\n`)
    }
  }, options.interval)
  const clearKeepAlive = (): void => clearInterval(keepAlive)
  res.once('close', clearKeepAlive)
  res.once('error', clearKeepAlive)
  return clearKeepAlive
}
