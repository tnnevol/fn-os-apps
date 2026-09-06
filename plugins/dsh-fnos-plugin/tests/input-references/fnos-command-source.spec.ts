import { describe, expect, it, vi } from 'vitest'
import { createFnosDirectorySource, parseFnosCommandQuery } from '../../src/client/input-references/fnos-command-source.ts'
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
    const source = createFnosDirectorySource(key => ({ fnDirectorySection: '授权文件与目录', fnDirectoryCommandSection: '指令', fnDirectoryRoot: '已授权目录' }[key]), list)
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

  it('publishes fn in the slash command list and enters the picker when selected', async () => {
    const source = createFnosDirectorySource(key => key === 'fnDirectoryCommandSection' ? '指令' : '授权文件与目录')
    const items = await source.candidates({ sessionId: 'session' as never }, {
      query: '', position: 'leading', drilled: false, signal: new AbortController().signal,
    })
    expect(items).toMatchObject([{ name: 'fn', section: '指令' }])
    const outcome = source.onPick({
      candidate: items[0]!, session: { sessionId: 'session' as never }, position: 'leading', via: 'menu', action: 'pick',
      span: { start: 0, end: 1, draftRev: 0 },
    })
    expect(outcome).toEqual({ text: '/fn', continue: true })
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
