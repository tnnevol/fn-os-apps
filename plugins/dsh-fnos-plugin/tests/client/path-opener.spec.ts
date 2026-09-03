import { describe, expect, it } from 'vitest'
import { installFnosPathOpener, installFnosRemotePathOpener, type PathOpenerSdk } from '../../src/client/services/path-opener.ts'

function sdk(options: Partial<PathOpenerSdk> = {}): PathOpenerSdk {
  return {
    isWeb: true,
    isStandaloneWeb: false,
    ready: async () => undefined,
    openFile: async () => undefined,
    ...options,
  }
}

describe('fnOS path opener', () => {
  it('opens an authorized path through the fnOS iframe bridge', async () => {
    const original: string[] = []
    const opened: string[] = []
    const workspaces = {
      openPath: async (path: string) => { original.push(path) },
    }
    const dispose = installFnosPathOpener(workspaces, {
      createSdk: () => sdk({ openFile: async path => { opened.push(path) } }),
    })

    await workspaces.openPath('/vol4/project/report.md')

    expect(opened).toEqual(['/vol4/project/report.md'])
    expect(original).toEqual([])
    dispose()
  })

  it('keeps the original DSH opener in a standalone browser', async () => {
    const original: string[] = []
    const workspaces = {
      openPath: async (path: string) => { original.push(path) },
    }
    const dispose = installFnosPathOpener(workspaces, {
      createSdk: () => sdk({ isStandaloneWeb: true }),
    })

    await workspaces.openPath('/tmp/report.md')

    expect(original).toEqual(['/tmp/report.md'])
    dispose()
  })

  it('uses the fnOS bridge inside an iframe even when the SDK reports standalone', async () => {
    const original: string[] = []
    const opened: string[] = []
    const previousWindow = (globalThis as { window?: unknown }).window
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { parent: {} },
    })
    try {
      const workspaces = {
        openPath: async (path: string) => { original.push(path) },
      }
      const dispose = installFnosPathOpener(workspaces, {
        createSdk: () => sdk({
          isStandaloneWeb: true,
          openFile: async path => { opened.push(path) },
        }),
      })

      await workspaces.openPath('/vol4/project/report.md')

      expect(opened).toEqual(['/vol4/project/report.md'])
      expect(original).toEqual([])
      dispose()
    } finally {
      if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window
      else Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow })
    }
  })

  it('lets fnOS decide authorization instead of preflighting the plugin directory list', async () => {
    const original: string[] = []
    const opened: string[] = []
    const workspaces = {
      openPath: async (path: string) => { original.push(path) },
    }
    const dispose = installFnosPathOpener(workspaces, {
      createSdk: () => sdk({ openFile: async path => { opened.push(path) } }),
    })

    await workspaces.openPath('/vol4/private/report.md')
    expect(opened).toEqual(['/vol4/private/report.md'])
    expect(original).toEqual([])
    dispose()
    await workspaces.openPath('/vol4/private/report.md')
    expect(original).toEqual(['/vol4/private/report.md'])
  })

  it('converts fnOS bridge failures into a readable error', async () => {
    const workspaces = {
      openPath: async (_path: string) => undefined,
    }
    const dispose = installFnosPathOpener(workspaces, {
      createSdk: () => sdk({
        openFile: async () => { throw new Error('openFile unavailable') },
      }),
      message: () => '无法通过 fnOS 打开该路径',
    })

    await expect(workspaces.openPath('/vol4/share/report.md')).rejects.toThrow('无法通过 fnOS 打开该路径')
    dispose()
  })
})
