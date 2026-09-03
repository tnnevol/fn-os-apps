import { describe, expect, it } from 'vitest'
import { EventEmitter } from 'node:events'
import { trustedRequest } from '../../src/host/auth-routes.ts'

function request(headers: Record<string, string>, remoteAddress = '192.0.2.10') {
  const socket = Object.assign(new EventEmitter(), { remoteAddress, encrypted: false })
  return { headers, socket } as never
}

describe('Codex auth request boundary', () => {
  it('allows same-origin requests through the NAS proxy', () => {
    expect(trustedRequest(request({ host: 'nas.example.test', origin: 'https://nas.example.test', 'x-forwarded-proto': 'https' }))).toBe(true)
  })

  it('allows the local DSH reverse proxy even when it preserves the external host', () => {
    expect(trustedRequest(request({ host: 'nas.example.test' }, '127.0.0.1'))).toBe(true)
  })

  it('rejects cross-site requests', () => {
    expect(trustedRequest(request({ host: 'nas.example.test', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }, '127.0.0.1'))).toBe(false)
  })

  it('does not let a local proxy bypass a mismatched browser origin', () => {
    expect(trustedRequest(request({ host: 'nas.example.test', origin: 'https://evil.example' }, '127.0.0.1'))).toBe(false)
  })
})
