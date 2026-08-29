import type { IncomingMessage } from 'node:http'
import { HOP_BY_HOP_HEADERS } from '../constants.js'

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
