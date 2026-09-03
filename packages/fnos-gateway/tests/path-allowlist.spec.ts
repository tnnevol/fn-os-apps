import { describe, expect, it } from 'vitest'
import { normalizeProxyPaths } from '../src/server/path-allowlist.ts'

describe('gateway API URL proxy paths', () => {
  it('normalizes, de-duplicates and sorts custom absolute paths', () => {
    expect(normalizeProxyPaths({ version: 1, paths: ['/store/api/', ' /alpha ', '/store/api'] })).toEqual(['/alpha', '/store/api'])
  })
  it('keeps built-in routes out of user configuration', () => {
    expect(normalizeProxyPaths({ version: 1, paths: ['/api/private', '/plugins/x', '/', 'relative'] })).toEqual([])
  })
  it('rejects a damaged document without replacing the active snapshot', () => {
    expect(normalizeProxyPaths({ version: 2, paths: ['/x'] })).toBeUndefined()
    expect(normalizeProxyPaths({ version: 1, paths: 'bad' })).toBeUndefined()
  })
})
