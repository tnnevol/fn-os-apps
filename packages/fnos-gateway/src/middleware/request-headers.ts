import type { ClientRequest, IncomingMessage } from 'node:http'
import { HOP_BY_HOP_HEADERS } from '../constants.js'

const REMOVED_BROWSER_HEADERS = ['origin', 'sec-fetch-site'] as const

export interface LoopbackContext {
  host: string
  port: number
}

export function applyLoopbackHeaders(headers: Record<string, string | string[] | undefined>, ctx: LoopbackContext): Record<string, string | string[] | undefined> {
  headers.host = `${ctx.host}:${ctx.port}`
  delete headers.origin
  delete headers['sec-fetch-site']
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
  for (const header of REMOVED_BROWSER_HEADERS) proxyReq.removeHeader(header)
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      proxyReq.setHeader(name, value)
    } else {
      proxyReq.setHeader(name, value)
    }
  }
}
