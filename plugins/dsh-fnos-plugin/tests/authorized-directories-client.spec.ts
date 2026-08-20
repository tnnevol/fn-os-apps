import { afterEach, describe, expect, it, vi } from 'vitest'
import { directoriesFromResponse, readablePathsFromResponse, requestAuthorizedEntries } from '../src/client/authorized-directories-client.ts'

describe('fnOS authorized-directory client response', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps shared application paths display-only and defaults older entries to removable', () => {
    expect(directoriesFromResponse({
      directories: [
        { path: '/vol4/share', semanticPath: '存储空间4/share', removable: true },
        { path: '/vol4/app-share', semanticPath: '存储空间4/app-share', removable: false },
        { path: '/vol4/legacy', semanticPath: '存储空间4/legacy' },
      ],
    })).toEqual([
      { path: '/vol4/share', semanticPath: '存储空间4/share', removable: true },
      { path: '/vol4/app-share', semanticPath: '存储空间4/app-share', removable: false },
      { path: '/vol4/legacy', semanticPath: '存储空间4/legacy', removable: true },
    ])
  })

  it('normalizes readable path responses and ignores malformed duplicates', () => {
    expect(readablePathsFromResponse({
      paths: [
        { path: '/vol4/media', semanticPath: '存储空间4/media' },
        { path: '/vol4/media', semanticPath: 'duplicate' },
        { path: '/vol2/docs' },
        { path: '', semanticPath: 'invalid' },
      ],
    })).toEqual([
      { path: '/vol4/media', semanticPath: '存储空间4/media' },
      { path: '/vol2/docs', semanticPath: '/vol2/docs' },
    ])
  })

  it('loads a de-duplicated authorized file listing through the same-origin route', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      directory: { path: '/vol4/share', semanticPath: '存储空间4/share' },
      entries: [
        { path: '/vol4/share/a.txt', semanticPath: '存储空间4/share/a.txt', kind: 'file', size: 12 },
        { path: '/vol4/share/docs', semanticPath: '存储空间4/share/docs', kind: 'directory' },
        { path: '/vol4/share/a.txt', semanticPath: 'duplicate', kind: 'file' },
        { path: '/vol4/share/bad', semanticPath: 'invalid', kind: 'unknown' },
      ],
      truncated: true,
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)

    await expect(requestAuthorizedEntries('/vol4/share')).resolves.toEqual({
      directory: { path: '/vol4/share', semanticPath: '存储空间4/share' },
      entries: [
        { path: '/vol4/share/a.txt', semanticPath: '存储空间4/share/a.txt', kind: 'file', size: 12 },
        { path: '/vol4/share/docs', semanticPath: '存储空间4/share/docs', kind: 'directory' },
      ],
      truncated: true,
    })
    expect(fetch).toHaveBeenCalledWith('/plugins/dsh-fnos/authorized-directories/entries', expect.objectContaining({ method: 'POST' }))
  })
})
