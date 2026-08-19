import { describe, expect, it } from 'vitest'
import { directoriesFromResponse, readablePathsFromResponse } from '../src/client/authorized-directories-client.ts'

describe('fnOS authorized-directory client response', () => {
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
})
