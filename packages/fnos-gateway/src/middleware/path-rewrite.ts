import type { IncomingMessage } from 'node:http'

export function normalizePrefix(value: string): string {
  const prefix = String(value || '').trim()
  if (prefix === '' || prefix === '/') return ''
  return '/' + prefix.replace(/^\/+|\/+$/g, '')
}

export function rewritePath(rawUrl: string | undefined, gatewayPrefix: string): string {
  if (!rawUrl || rawUrl === '*') return rawUrl || '/'

  let parsed: URL
  try {
    parsed = new URL(rawUrl, 'http://dsh-gateway.invalid')
  } catch {
    return rawUrl
  }

  const pathname = parsed.pathname || '/'
  if (gatewayPrefix && (pathname === gatewayPrefix || pathname === gatewayPrefix + '/')) {
    parsed.pathname = '/'
  } else if (gatewayPrefix && pathname.startsWith(gatewayPrefix + '/')) {
    parsed.pathname = pathname.slice(gatewayPrefix.length) || '/'
  }

  return (parsed.pathname || '/') + parsed.search
}

export function addGatewayPrefix(path: string, gatewayPrefix: string): string {
  if (!gatewayPrefix || !path || !path.startsWith('/') || path.startsWith('//')) return path
  if (path === gatewayPrefix || path.startsWith(gatewayPrefix + '/')) return path
  return gatewayPrefix + path
}

export function rewriteLocation(value: unknown, gatewayPrefix: string): unknown {
  if (typeof value !== 'string') return value
  return value.startsWith('/') && !value.startsWith('//') ? addGatewayPrefix(value, gatewayPrefix) : value
}

export function pathRewriteMiddleware(gatewayPrefix: string) {
  return (req: IncomingMessage, _res: unknown, next: () => void): void => {
    if (req.url) {
      req.url = rewritePath(req.url, gatewayPrefix)
    }
    next()
  }
}
