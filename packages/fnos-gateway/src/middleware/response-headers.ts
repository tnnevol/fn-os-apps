import type { IncomingHttpHeaders } from 'node:http'
import { HOP_BY_HOP_HEADERS } from '../constants/index.js'
import { rewriteLocation } from './path-rewrite.js'

export interface ResponseHeaderOptions {
  rewriteBody: boolean
  eventStream: boolean
  gatewayPrefix: string
}

export function copyResponseHeaders(headers: IncomingHttpHeaders, options: ResponseHeaderOptions): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {}
  for (const [name, value] of Object.entries(headers)) {
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) continue
    if (name.toLowerCase() === 'content-length' && (options.rewriteBody || options.eventStream)) continue
    if (name.toLowerCase() === 'location' && typeof value === 'string') {
      result[name] = rewriteLocation(value, options.gatewayPrefix) as string
    } else if (value !== undefined) {
      result[name] = value as string | string[]
    }
  }
  if (options.eventStream) {
    result['cache-control'] = 'no-cache, no-transform'
    result['x-accel-buffering'] = 'no'
  }
  return result
}
