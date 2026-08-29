import type { ClientRequest, IncomingMessage } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { applyProxyRequestHeaders } from '../src/middleware/request-headers.ts'

describe('proxy request headers', () => {
  it('normalizes browser trust headers for the loopback hop', () => {
    const setHeader = vi.fn()
    const removeHeader = vi.fn()
    const proxyRequest = { setHeader, removeHeader } as unknown as ClientRequest
    const request = {
      headers: {
        host: '192.168.119.6:5666',
        origin: 'http://192.168.119.6:5666',
        'sec-fetch-site': 'same-origin',
        cookie: 'dsh-session=test',
      },
    } as IncomingMessage

    applyProxyRequestHeaders(proxyRequest, request, { host: '127.0.0.1', port: 3080 })

    expect(removeHeader).toHaveBeenCalledWith('origin')
    expect(removeHeader).toHaveBeenCalledWith('sec-fetch-site')
    expect(setHeader).toHaveBeenCalledWith('host', '127.0.0.1:3080')
    expect(setHeader).toHaveBeenCalledWith('cookie', 'dsh-session=test')
    expect(setHeader).toHaveBeenCalledWith('origin', 'http://127.0.0.1:3080')
    expect(setHeader).toHaveBeenCalledWith('sec-fetch-site', 'same-origin')
  })

  it('keeps cross-site markers so the DSH trust fence can reject them', () => {
    const setHeader = vi.fn()
    const removeHeader = vi.fn()
    const proxyRequest = { setHeader, removeHeader } as unknown as ClientRequest
    const request = { headers: { host: '192.168.119.6:5666', origin: 'http://evil.example', 'sec-fetch-site': 'cross-site' } } as IncomingMessage

    applyProxyRequestHeaders(proxyRequest, request, { host: '127.0.0.1', port: 3080 })

    expect(setHeader).toHaveBeenCalledWith('origin', 'http://127.0.0.1:3080')
    expect(setHeader).toHaveBeenCalledWith('sec-fetch-site', 'cross-site')
  })
})
