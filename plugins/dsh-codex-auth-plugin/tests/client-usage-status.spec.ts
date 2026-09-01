import { afterEach, describe, expect, it, vi } from 'vitest'
import { readSignedInUsage } from '../src/client/usage-status-data.ts'
import { CODEX_AUTH_STATUS_PATH, CODEX_USAGE_PATH } from '../src/auth-paths.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('composer Codex usage status', () => {
  it('does not request or expose usage while signed out', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ status: 'signed-out' })))
    vi.stubGlobal('fetch', fetch)

    await expect(readSignedInUsage()).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(CODEX_AUTH_STATUS_PATH, expect.any(Object))
  })

  it('reads usage only after the Host confirms the account is signed in', async () => {
    const usage = { primaryWindow: { limitWindowSeconds: 18_000, remainingPercent: 73 } }
    const fetch = vi.fn(async (path: string) => path === CODEX_AUTH_STATUS_PATH
      ? new Response(JSON.stringify({ status: 'signed-in' }))
      : new Response(JSON.stringify(usage)))
    vi.stubGlobal('fetch', fetch)

    await expect(readSignedInUsage()).resolves.toEqual(usage)
    expect(fetch.mock.calls.map(call => call[0])).toEqual([CODEX_AUTH_STATUS_PATH, CODEX_USAGE_PATH])
  })

  it('hides usage when auth status cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    await expect(readSignedInUsage()).resolves.toBeUndefined()
  })

  it('FNOS-002-TP-006-TC-003: reports a usage request failure after signed-in status succeeds', async () => {
    const fetch = vi.fn(async (path: string) => path === CODEX_AUTH_STATUS_PATH
      ? new Response(JSON.stringify({ status: 'signed-in' }))
      : new Response(JSON.stringify({ error: 'upstream unavailable' }), { status: 503 }))
    vi.stubGlobal('fetch', fetch)

    await expect(readSignedInUsage()).rejects.toThrow('HTTP 503')
    expect(fetch.mock.calls.map(call => call[0])).toEqual([CODEX_AUTH_STATUS_PATH, CODEX_USAGE_PATH])
  })

  it('RISK-001-ETP-1-TC-002: does not expose a stale usage snapshot when the usage route returns 401', async () => {
    const fetch = vi.fn(async (path: string) => path === CODEX_AUTH_STATUS_PATH
      ? new Response(JSON.stringify({ status: 'signed-in' }))
      : new Response(null, { status: 401 }))
    vi.stubGlobal('fetch', fetch)

    await expect(readSignedInUsage()).rejects.toThrow('Codex usage is unavailable')
  })
})
