import { describe, expect, it } from 'vitest'
import { normalizeGatewayProxyPaths, validateGatewayProxyPaths } from '../../src/contracts/gateway-proxy-contract.ts'
import { gatewayProxyPathsFile } from '../../src/host/gateway-proxy-routes.ts'

describe('fnOS gateway proxy configuration', () => {
  it('normalizes a full submitted snapshot', () => {
    expect(normalizeGatewayProxyPaths({ paths: ['/store/', ' /alpha ', '/store'] })).toEqual(['/alpha', '/store'])
  })
  it('removes invalid and reserved paths', () => {
    expect(normalizeGatewayProxyPaths({ paths: ['/api/x', '/plugins/x', '/__fnos-gateway/x', '//host', '/a/../b', '/a%2fb'] })).toEqual([])
  })
  it('rejects a submitted snapshot containing an invalid path', () => {
    expect(validateGatewayProxyPaths({ paths: ['/valid/path', 'not-an-absolute-path'] })).toBeUndefined()
    expect(validateGatewayProxyPaths({ paths: ['/api/private'] })).toBeUndefined()
  })
  it('accepts normalized absolute path prefixes and blank lines', () => {
    expect(validateGatewayProxyPaths({ paths: ['/store/', ' ', '/alpha'] })).toEqual(['/alpha', '/store'])
  })
  it('writes under the persistent fnOS package variable directory', () => {
    expect(gatewayProxyPathsFile({ TRIM_PKGVAR: '/vol4/@appdata/fn-deepseek-harness' } as NodeJS.ProcessEnv)).toBe('/vol4/@appdata/fn-deepseek-harness/gateway/path-allowlist.json')
  })
})
