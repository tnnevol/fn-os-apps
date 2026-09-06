import { describe, expect, it, vi } from 'vitest'
import { createFnosCommandContribution, createFnosDirectorySource, listFnosCommandEntries, parseFnosCommandQuery } from '../../src/client/input-references/fnos-command-source.ts'
import type { AuthorizedEntriesResult } from '../../src/client/services/authorized-directories-client.ts'

const rootResult: AuthorizedEntriesResult = {
  entries: [
    { path: '/vol1/apps', semanticPath: '存储空间1/apps', kind: 'directory' },
    { path: '/vol1/readme.md', semanticPath: '存储空间1/readme.md', kind: 'file' },
  ],
  truncated: false,
}

describe('fnOS /fn input trigger source', () => {
  it('parses only the fn command and keeps the internal path', () => {
    expect(parseFnosCommandQuery('fn')).toEqual({ path: '/' })
    expect(parseFnosCommandQuery('fn /vol1/apps/')).toEqual({ path: '/vol1/apps' })
    expect(parseFnosCommandQuery('format')).toBeUndefined()
    expect(parseFnosCommandQuery('fn relative')).toBeUndefined()
  })

  it('lists authorized files and directories and marks directories drillable', async () => {
    const list = vi.fn(async () => rootResult)
    const source = createFnosDirectorySource(key => ({ fnDirectorySection: '授权文件与目录', fnDirectoryCommandDescription: '选择授权路径', fnDirectoryRoot: '已授权目录' }[key]), list)
    const signal = new AbortController().signal
    const items = await source.candidates({ sessionId: 'session' as never }, {
      query: 'fn', position: 'leading', drilled: false, signal,
    })

    expect(list).toHaveBeenCalledWith(undefined)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ name: 'apps/', icon: 'folder', drill: true, section: '授权文件与目录' })
    expect(items[1]).toMatchObject({ name: 'readme.md', icon: 'file' })
    expect(items[1]).not.toHaveProperty('drill')
  })

  it('registers fn through the unified command contribution', async () => {
    const insert = vi.fn(() => true)
    const list = vi.fn(async (path?: string) => path === undefined ? rootResult : path === '/vol1/apps' ? {
      directory: { path, semanticPath: '存储空间1/apps' },
      entries: [
        { path: '/vol1/apps/src', semanticPath: '存储空间1/apps/src', kind: 'directory' as const },
        { path: '/vol1/apps/readme.md', semanticPath: '存储空间1/apps/readme.md', kind: 'file' as const },
      ],
      truncated: false,
    } : { entries: [], truncated: false })
    const command = createFnosCommandContribution(
      key => ({ fnDirectorySection: '授权文件与目录', fnDirectoryCommandDescription: '选择授权路径', fnDirectoryRoot: '已授权目录' }[key]),
      insert,
      list,
    )
    expect(command.name).toBe('fn')
    expect(command.description).toBe('选择授权路径')
    const options = await command.ui.options({ sessionId: 'session' as never }, new AbortController().signal)
    expect(options[0]).toMatchObject({ label: 'apps/', detail: '存储空间1/apps' })
    expect(options).toHaveLength(4)
    expect(options[2]).toMatchObject({ label: 'src/', detail: '存储空间1/apps/src' })
    expect(list).toHaveBeenCalledWith('/vol1/apps')
    await command.ui.onSelect(options[0]!, { sessionId: 'session' as never })
    expect(insert).toHaveBeenCalledWith('session', expect.objectContaining({ path: '/vol1/apps', kind: 'directory' }))
  })

  it('stops loading command options when the popup is aborted', async () => {
    const controller = new AbortController()
    const list = vi.fn(async () => rootResult)
    controller.abort()
    await expect(listFnosCommandEntries(list, controller.signal)).resolves.toEqual([])
    expect(list).not.toHaveBeenCalled()
  })

  it('drills into a directory with Tab and inserts a structured reference on pick', async () => {
    const source = createFnosDirectorySource(key => key === 'fnDirectoryRoot' ? '已授权目录' : '授权文件与目录', async path => path === undefined ? rootResult : {
      directory: { path, semanticPath: '存储空间1/apps' },
      entries: [{ path: '/vol1/apps/src', semanticPath: '存储空间1/apps/src', kind: 'directory' }],
      truncated: false,
    })
    const signal = new AbortController().signal
    const items = await source.candidates({ sessionId: 'session' as never }, {
      query: 'fn', position: 'leading', drilled: false, signal,
    })
    const drill = source.onPick({
      candidate: items[0]!, session: { sessionId: 'session' as never }, position: 'leading', via: 'menu', action: 'drill',
      span: { start: 0, end: 3, draftRev: 0 },
    })
    expect(drill).toEqual({ text: '/fn/vol1/apps/', continue: true })

    const nested = await source.candidates({ sessionId: 'session' as never }, {
      query: 'fn/vol1/apps/', position: 'leading', drilled: true, signal,
    })
    expect(nested[0]).toMatchObject({ name: 'src/', drill: true })
    const crumbs = source.header?.({ sessionId: 'session' as never }, {
      query: 'fn/vol1/apps/', drilled: true,
    })
    expect(crumbs?.[0]).toMatchObject({ label: '已授权目录' })
    expect(crumbs?.at(-1)).toMatchObject({ label: 'apps', current: true })

    const insert = source.onPick({
      candidate: nested[0]!, session: { sessionId: 'session' as never }, position: 'leading', via: 'menu', action: 'pick',
      span: { start: 0, end: 16, draftRev: 0 },
    })
    expect(insert).toMatchObject({ insert: { source: 'fnos-file', appearance: 'folder', label: 'src/' } })
  })
})
