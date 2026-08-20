import { describe, expect, it } from 'vitest'
import { DirectoryRequestError } from '../src/client/authorized-directories-client.ts'
import { installFnosPathOpener, type PathOpenerSdk } from '../src/client/path-opener.ts'

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
    const validated: string[] = []
    const workspaces = {
      openPath: async (path: string) => { original.push(path) },
    }
    const dispose = installFnosPathOpener(workspaces, {
      createSdk: () => sdk({ openFile: async path => { opened.push(path) } }),
      validatePath: async path => { validated.push(path) },
    })

    await workspaces.openPath('/vol4/project/report.md')

    expect(validated).toEqual(['/vol4/project/report.md'])
    expect(opened).toEqual(['/vol4/project/report.md'])
    expect(original).toEqual([])
    dispose()
  })

  it('keeps the original DSH opener in a standalone browser', async () => {
    const original: string[] = []
    let validated = false
    const workspaces = {
      openPath: async (path: string) => { original.push(path) },
    }
    const dispose = installFnosPathOpener(workspaces, {
      createSdk: () => sdk({ isStandaloneWeb: true }),
      validatePath: async () => { validated = true },
    })

    await workspaces.openPath('/tmp/report.md')

    expect(original).toEqual(['/tmp/report.md'])
    expect(validated).toBe(false)
    dispose()
  })

  it('returns a readable authorization error and restores the service', async () => {
    const original: string[] = []
    const workspaces = {
      openPath: async (path: string) => { original.push(path) },
    }
    const dispose = installFnosPathOpener(workspaces, {
      createSdk: () => sdk(),
      validatePath: async () => {
        throw new DirectoryRequestError('fnos-path-not-authorized')
      },
      message: key => key === 'pathNotAuthorized' ? '请先授权目录' : '无法打开路径',
    })

    await expect(workspaces.openPath('/vol4/private/report.md')).rejects.toThrow('请先授权目录')
    dispose()
    await workspaces.openPath('/vol4/private/report.md')
    expect(original).toEqual(['/vol4/private/report.md'])
  })
})
