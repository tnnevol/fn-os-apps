import { describe, expect, it } from 'vitest'
import { normalizeGatewayProxyPaths } from '../src/gateway-proxy-contract.ts'
import { gatewayProxyPathsFile } from '../src/gateway-proxy-routes.ts'

describe('fnOS gateway proxy configuration', () => {
  it('normalizes a full submitted snapshot', () => {
    expect(normalizeGatewayProxyPaths({ paths: ['/store/', ' /alpha ', '/store'] })).toEqual(['/alpha', '/store'])
  })
  it('removes invalid and reserved paths', () => {
    expect(normalizeGatewayProxyPaths({ paths: ['/api/x', '/plugins/x', '/__fnos-gateway/x', '//host', '/a/../b', '/a%2fb'] })).toEqual([])
  })
  it('writes under the persistent fnOS package variable directory', () => {
    expect(gatewayProxyPathsFile({ TRIM_PKGVAR: '/vol4/@appdata/fn-deepseek-harness' } as NodeJS.ProcessEnv)).toBe('/vol4/@appdata/fn-deepseek-harness/gateway/path-allowlist.json')
  })
})
