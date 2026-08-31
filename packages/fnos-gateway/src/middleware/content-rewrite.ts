import { addGatewayPrefix } from './path-rewrite.js'

export function gatewayBaseHref(gatewayPrefix: string): string {
  return gatewayPrefix ? gatewayPrefix + '/' : '/'
}

export function rewriteHtml(body: Buffer, gatewayPrefix: string, bridgeScript: string): string {
  let html = body.toString('utf8')
  html = html.replace(
    /(\b(?:src|href|action)=["'])(\/(?!\/)[^"']*)/gi,
    (_, prefix, path) => prefix + addGatewayPrefix(path, gatewayPrefix),
  )

  const base = '<base href="' + gatewayBaseHref(gatewayPrefix) + '">'
  if (!/<base\b[^>]*>/i.test(html)) {
    html = /<head\b[^>]*>/i.test(html)
      ? html.replace(/(<head\b[^>]*>)/i, '$1' + base)
      : base + html
  }

  return /<head\b[^>]*>/i.test(html)
    ? html.replace(/<head\b[^>]*>/i, (head) => head + bridgeScript)
    : bridgeScript + html
}

export function rewriteCss(body: Buffer, gatewayPrefix: string): string {
  const css = body.toString('utf8')
  return css.replace(
    /url\(\s*(["']?)(\/(?!\/)[^)"']+)\1\s*\)/gi,
    (match, quote, path) => 'url(' + quote + addGatewayPrefix(path, gatewayPrefix) + quote + ')',
  )
}

export function rewriteJavaScript(body: Buffer, upstreamPath: string, gatewayPrefix: string): string {
  let source = body.toString('utf8')
  if (!upstreamPath.startsWith('/assets/')) return source

  const lastSlash = upstreamPath.lastIndexOf('/')
  const currentDirectory = upstreamPath.slice(0, lastSlash + 1) || '/'
  const parentDirectory = currentDirectory.replace(/[^/]+\/$/, '') || '/'
  const currentImportBase = addGatewayPrefix(currentDirectory, gatewayPrefix)
  const parentImportBase = addGatewayPrefix(parentDirectory, gatewayPrefix)

  source = source.replace(
    /(["'])assets\/(?=(?:langs\/|vendor-|fonts\/))/g,
    (_, quote) => quote + addGatewayPrefix('/assets/', gatewayPrefix),
  )

  source = source.replace(
    /(\bfrom\s*["'])\.\.\//g,
    (_, prefix) => prefix + parentImportBase,
  )
  source = source.replace(
    /(\bfrom\s*["'])\.\//g,
    (_, prefix) => prefix + currentImportBase,
  )
  source = source.replace(
    /(\bimport\s*\(\s*["'])\.\//g,
    (_, prefix) => prefix + currentImportBase,
  )
  return source
}
