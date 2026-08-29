import type { ClientRequest, IncomingMessage } from 'node:http'
import { HOP_BY_HOP_HEADERS } from '../constants.js'

const LOOPBACK_ORIGIN_SCHEMES = new Set(['http:', 'https:'])

export interface LoopbackContext {
  host: string
  port: number
}

export function applyLoopbackHeaders(headers: Record<string, string | string[] | undefined>, ctx: LoopbackContext): Record<string, string | string[] | undefined> {
  headers.host = `${ctx.host}:${ctx.port}`
  // DSH and plugin routes see the loopback authority on the second hop. Keep
  // the browser's same-site marker, but translate a normal Origin to the same
  // authority so strict same-origin plugin endpoints remain valid. Opaque or
  // malformed origins are intentionally retained and rejected by DSH.
  const origin = headers.origin
  if (typeof origin === 'string') {
    try {
      const parsed = new URL(origin)
      if (LOOPBACK_ORIGIN_SCHEMES.has(parsed.protocol)) headers.origin = `http://${headers.host}`
    } catch {}
  }
  return headers
}

export function copyRequestHeaders(req: IncomingMessage, ctx: LoopbackContext): Record<string, string | string[] | undefined> {
  const headers: Record<string, string | string[] | undefined> = { ...req.headers }
  for (const header of HOP_BY_HOP_HEADERS) delete headers[header]
  headers['accept-encoding'] = 'identity'
  return applyLoopbackHeaders(headers, ctx)
}

/** Apply the sanitized request headers to a request already initialized by http-proxy. */
export function applyProxyRequestHeaders(proxyReq: ClientRequest, req: IncomingMessage, ctx: LoopbackContext): void {
  const headers = copyRequestHeaders(req, ctx)
  proxyReq.removeHeader('origin')
  proxyReq.removeHeader('sec-fetch-site')
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      proxyReq.setHeader(name, value)
    } else {
      proxyReq.setHeader(name, value)
    }
  }
}
