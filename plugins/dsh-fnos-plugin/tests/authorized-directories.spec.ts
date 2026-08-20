import { describe, expect, it } from 'vitest'
import {
  accessiblePathsFromEnvironment,
  buildAuthorizedDirectories,
  dataSharePathsFromEnvironment,
  mergeAuthorizedPaths,
  normalizeAuthorizedPath,
  normalizeAuthorizedPaths,
  normalizePathForAuthorization,
  isPathWithinAuthorizedDirectory,
} from '../src/authorized-directories.ts'

describe('fnOS authorized-directory contract', () => {
  it('normalizes volume paths and keeps the API order without duplicates', () => {
    expect(normalizeAuthorizedPaths([
      '/vol4/share/',
      '/vol4/share',
      ' /vol2/media ',
      null,
      'relative/path',
      '/',
    ])).toEqual(['/vol4/share', '/vol2/media', '/'])
  })

  it('rejects malformed paths before an ACL delete can be sent', () => {
    expect(normalizeAuthorizedPath('')).toBeUndefined()
    expect(normalizeAuthorizedPath('relative')).toBeUndefined()
    expect(normalizeAuthorizedPath('/vol1/a\0b')).toBeUndefined()
    expect(normalizeAuthorizedPath('/vol1/a///')).toBe('/vol1/a')
  })

  it('shows semantic fnOS paths while retaining normalized paths for deletion', () => {
    expect(buildAuthorizedDirectories(
      ['/vol4/share/', '/vol2/media'],
      {
        status: 0,
        result: [
          { path: '/vol4/share', semanticPath: '存储空间4/share' },
          { path: '/vol2/media/', semanticPath: '存储空间2/media' },
        ],
      },
    )).toEqual([
      { path: '/vol4/share', semanticPath: '存储空间4/share', removable: true },
      { path: '/vol2/media', semanticPath: '存储空间2/media', removable: true },
    ])
  })

  it('keeps a readable storage label if fnOS cannot convert one entry', () => {
    expect(buildAuthorizedDirectories(
      ['/vol4/share'],
      { result: [{ path: '/vol2/other', semanticPath: '存储空间2/other' }] },
    )).toEqual([{ path: '/vol4/share', semanticPath: 'Storage 4/share', removable: true }])
  })

  it('marks TRIM_DATA_SHARE_PATHS entries as display-only', () => {
    expect(buildAuthorizedDirectories(
      ['/vol4/share', '/vol4/app-share'],
      { result: [] },
      'zh-CN',
      ['/vol4/app-share'],
    )).toEqual([
      { path: '/vol4/share', semanticPath: '存储空间4/share', removable: true },
      { path: '/vol4/app-share', semanticPath: '存储空间4/app-share', removable: false },
    ])
  })

  it('reads and de-duplicates fnOS path environment variables', () => {
    const env = {
      TRIM_DATA_ACCESSIBLE_PATHS: '/vol4/share/:/vol4/share:/vol2/media',
      TRIM_DATA_SHARE_PATHS: '/vol4/app-share:/vol4/app-share',
    }
    expect(accessiblePathsFromEnvironment(env)).toEqual(['/vol4/share', '/vol2/media'])
    expect(dataSharePathsFromEnvironment(env)).toEqual(['/vol4/app-share'])
    expect(mergeAuthorizedPaths(['/vol4/share'], env.TRIM_DATA_ACCESSIBLE_PATHS, ['/vol2/media'])).toEqual([
      '/vol4/share',
      '/vol2/media',
    ])
  })

  it('normalizes path traversal before checking an authorized root boundary', () => {
    expect(normalizePathForAuthorization('/vol4/share/./nested/../file')).toBe('/vol4/share/file')
    expect(isPathWithinAuthorizedDirectory('/vol4/share/file.txt', ['/vol4/share'])).toBe(true)
    expect(isPathWithinAuthorizedDirectory('/vol4/share-archive/file.txt', ['/vol4/share'])).toBe(false)
    expect(isPathWithinAuthorizedDirectory('/vol4/share/../private/file.txt', ['/vol4/share'])).toBe(false)
    expect(isPathWithinAuthorizedDirectory('/vol4/share/file.txt', ['/'])).toBe(true)
  })
})
