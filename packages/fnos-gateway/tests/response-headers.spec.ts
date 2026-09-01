import type { IncomingHttpHeaders } from 'node:http'
import { describe, expect, it } from 'vitest'
import { copyResponseHeaders } from '../src/middleware/response-headers.ts'

const baseOptions = { gatewayPrefix: '/app/fn-deepseek-harness' }

describe('gateway response headers', () => {
  it('FNOS-002-TP-032-TC-001: removes hop-by-hop headers and rewrites same-origin Location', () => {
    const headers = copyResponseHeaders({
      connection: 'keep-alive',
      'content-type': 'application/json',
      location: '/login',
      'x-request-id': 'request-1',
    }, { ...baseOptions, rewriteBody: false, eventStream: false })

    expect(headers).toEqual({
      'content-type': 'application/json',
      location: '/app/fn-deepseek-harness/login',
      'x-request-id': 'request-1',
    })
  })

  it('FNOS-002-TP-032-TC-002: keeps image content headers and removes content length only for rewritten bodies', () => {
    const imageHeaders: IncomingHttpHeaders = {
      'content-type': 'image/png',
      'content-length': '42',
      etag: '"image"',
    }
    expect(copyResponseHeaders(imageHeaders, { ...baseOptions, rewriteBody: false, eventStream: false }))
      .toEqual(imageHeaders)
    expect(copyResponseHeaders(imageHeaders, { ...baseOptions, rewriteBody: true, eventStream: false }))
      .toEqual({ 'content-type': 'image/png', etag: '"image"' })
  })

  it('FNOS-002-TP-034-ETP-1-TC-002: applies non-buffering headers to event streams', () => {
    const headers = copyResponseHeaders({ 'content-length': '100', 'content-type': 'text/event-stream' }, {
      ...baseOptions,
      rewriteBody: false,
      eventStream: true,
    })

    expect(headers).toEqual({
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    })
  })
})
