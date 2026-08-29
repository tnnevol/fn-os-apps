export const FNOS_GATEWAY_PROXY_PATHS_ROUTE = '/plugins/dsh-fnos/gateway/proxy-paths'
export const FNOS_GATEWAY_PROXY_PATHS_FILE = 'gateway/path-allowlist.json'
export interface GatewayProxyPathsDocument { version: 1, paths: string[] }

export function normalizeGatewayProxyPaths(value: unknown): string[] | undefined {
  const paths = Array.isArray(value) ? value : typeof value === 'object' && value !== null ? (value as { paths?: unknown }).paths : undefined
  if (!Array.isArray(paths)) return undefined
  const normalized = paths.flatMap(item => {
    if (typeof item !== 'string') return []
    const path = item.trim().replace(/\/+$/u, '')
    if (!path.startsWith('/') || path.startsWith('//') || path === '' || path.includes('\0') || path.includes('?') || path.includes('#') || /%2f|%5c/iu.test(path)) return []
    if (path.split('/').some(segment => segment === '.' || segment === '..')) return []
    if (path === '/api' || path.startsWith('/api/') || path === '/plugins' || path.startsWith('/plugins/')) return []
    if (path === '/__fnos-gateway' || path.startsWith('/__fnos-gateway/')) return []
    return [path]
  })
  return [...new Set(normalized)].sort()
}
