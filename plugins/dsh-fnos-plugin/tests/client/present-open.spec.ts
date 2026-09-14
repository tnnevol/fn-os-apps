import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFnosPresentedOpen } from '../../src/client/services/present-open.ts'

const originalFetch = globalThis.fetch

function embedFrame(): void {
  vi.stubGlobal('window', { parent: {} })
  vi.stubGlobal('location', { href: 'http://nas.example/app/fn-deepseek-harness/' })
}

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.unstubAllGlobals()
})

describe('fnOS presented-file opener', () => {
  it('reports the fnOS file actions as available instead of the NAS desktop probe', async () => {
    embedFrame()
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    const dispose = installFnosPresentedOpen(() => ({
      ready: async () => undefined,
      openFile: async () => undefined,
      openFileManager: async () => undefined,
    }))

    const response = await globalThis.fetch('/api/present.host', { method: 'GET' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ name: 'fnOS', available: true, fileManager: 'directory' })
    expect(fetcher).not.toHaveBeenCalled()
    dispose()
  })

  it('resolves present coordinates through the gateway and opens the verified path with fnOS', async () => {
    embedFrame()
    const original = vi.fn<typeof fetch>(async (input) => {
      expect(input).toBe('/fnos-plugins/present/resolve')
      return Response.json({ path: '/vol1/@appdata/project/report.md' })
    })
    vi.stubGlobal('fetch', original)
    const opened: string[] = []
    const dispose = installFnosPresentedOpen(() => ({
      ready: async () => undefined,
      openFile: async path => { opened.push(path) },
      openFileManager: async () => undefined,
    }))

    const response = await globalThis.fetch('/api/present.open?sessionId=session-1&seq=110&index=0', { method: 'POST' })

    expect(response.status).toBe(204)
    expect(opened).toEqual(['/vol1/@appdata/project/report.md'])
    expect(original).toHaveBeenCalledWith('/fnos-plugins/present/resolve', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      body: JSON.stringify({ sessionId: 'session-1', seq: 110, index: 0 }),
    }))
    dispose()
  })

  it('uses the fnOS file manager for the reveal action', async () => {
    embedFrame()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => Response.json({ path: '/vol1/project' })))
    const managerOpened: string[] = []
    const dispose = installFnosPresentedOpen(() => ({
      ready: async () => undefined,
      openFile: async () => undefined,
      openFileManager: async path => { managerOpened.push(path) },
    }))

    const response = await globalThis.fetch('/api/present.open?sessionId=session-1&seq=110&index=0&action=reveal', { method: 'POST' })

    expect(response.status).toBe(204)
    expect(managerOpened).toEqual(['/vol1/project'])
    dispose()
  })

  it('restores fetch and leaves non-present requests untouched', async () => {
    embedFrame()
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetcher)
    const dispose = installFnosPresentedOpen(() => ({
      ready: async () => undefined,
      openFile: async () => undefined,
      openFileManager: async () => undefined,
    }))

    await globalThis.fetch('/api/session.export?sessionId=session-1')
    expect(fetcher).toHaveBeenCalledOnce()
    dispose()
    expect(globalThis.fetch).toBe(fetcher)
  })
})
