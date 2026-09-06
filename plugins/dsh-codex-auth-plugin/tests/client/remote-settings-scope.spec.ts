import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodexAuthRemoteSettingsScope } from '../../src/client/services/remote-settings-scope.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Codex Auth remote settings scope', () => {
  it('loads and persists image capability settings through the plugin route', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      const method = init?.method ?? 'GET'
      const settings = method === 'PUT'
        ? JSON.parse(String(init?.body)) as Record<string, boolean>
        : { enableImageTool: true, enableImageUpload: true }
      return new Response(JSON.stringify(settings), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const scope = new CodexAuthRemoteSettingsScope()
    await scope.load()
    expect(scope.getSnapshot()).toMatchObject({
      status: 'ready',
      writable: true,
      mode: 'host',
      value: { enableImageTool: true, enableImageUpload: true },
    })

    await scope.set('enableImageTool', true)
    expect(scope.getSnapshot().value?.enableImageTool).toBe(true)
    expect(fetchMock).toHaveBeenLastCalledWith('/plugins/dsh-codex-auth-plugin/auth/settings', expect.objectContaining({ method: 'PUT' }))
    await scope.dispose()
  })

  it('marks the scope unavailable when the NAS proxy cannot reach the route', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response('<html />', { status: 404 })))
    const scope = new CodexAuthRemoteSettingsScope()
    await scope.load()
    expect(scope.getSnapshot()).toMatchObject({ status: 'unavailable', writable: false })
    await scope.dispose()
  })
})
