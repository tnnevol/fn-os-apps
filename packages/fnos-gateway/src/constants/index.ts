export const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

export const DEFAULT_SSE_KEEPALIVE_INTERVAL = 15_000

export const BAD_GATEWAY_MESSAGE = 'DeepSeek Harness gateway proxy error'
