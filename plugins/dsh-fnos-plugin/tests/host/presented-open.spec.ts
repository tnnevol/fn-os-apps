import { describe, expect, it, vi } from 'vitest'
import { resolvePresentedPath } from '../../src/host/presented-open.ts'

function context(options: {
  target?: unknown
  cwd?: string
  absolutePath?: string
  mapped?: string | null
  resolved?: string
} = {}): any {
  const absolutePath = options.absolutePath ?? '/vol1/project/report.md'
  const mapped = options.mapped === null ? undefined : options.mapped ?? '/project/report.md'
  const resolved = options.resolved ?? absolutePath
  const services = new Map<string, unknown>([
    ['sessionQuery', {
      readEvent: vi.fn(async () => ({
        session: { cwd: options.cwd ?? '/vol1/project' },
        target: options.target ?? {
          type: 'deliverables/presented',
          data: { files: [{ path: 'report.md' }] },
        },
      })),
    }],
    ['workspaceFiles', {
      stat: vi.fn(async () => ({ absolutePath })),
    }],
    ['fs', {
      processPathFromHostPath: vi.fn(() => mapped),
      resolve: vi.fn(async () => resolved),
      processPath: vi.fn(path => path),
    }],
    ['sandboxPolicy', { workspaceRoot: '/vol1/workspace' }],
  ])
  return { get: (name: string) => services.get(name) }
}

describe('fnOS presented path resolver', () => {
  it('resolves and verifies the Host path for a presented file', async () => {
    await expect(resolvePresentedPath(context() as never, {
      sessionId: 'session-1', seq: 110, index: 0,
    }, new AbortController().signal)).resolves.toBe('/vol1/project/report.md')
  })

  it('rejects a coordinate that does not point to a presented file', async () => {
    await expect(resolvePresentedPath(context({ target: { type: 'turn/start' } }) as never, {
      sessionId: 'session-1', seq: 110, index: 0,
    }, new AbortController().signal)).rejects.toMatchObject({ code: 'not-found' })
  })

  it('rejects a Host path that cannot be verified by the DSH filesystem', async () => {
    await expect(resolvePresentedPath(context({ mapped: null }) as never, {
      sessionId: 'session-1', seq: 110, index: 0,
    }, new AbortController().signal)).rejects.toMatchObject({ code: 'unverified' })
  })
})
