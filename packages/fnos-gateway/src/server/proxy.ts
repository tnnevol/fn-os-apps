import { createProxyMiddleware } from 'http-proxy-middleware'
import type { RequestHandler } from 'http-proxy-middleware'
import { request as httpRequest, type ServerResponse, type IncomingMessage } from 'node:http'
import type { GatewayOptions } from '../types/gateway.js'
import { applyProxyRequestHeaders, copyRequestHeaders } from '../middleware/request-headers.js'
import { copyResponseHeaders } from '../middleware/response-headers.js'
import { rewriteHtml, rewriteCss, rewriteJavaScript } from '../middleware/content-rewrite.js'
import { gatewayBridgeScript } from './bridge-script.js'
import { attachSseKeepalive } from '../middleware/sse-keepalive.js'
import { BAD_GATEWAY_MESSAGE } from '../constants/index.js'
import { recoveryPage } from './recovery-page.js'

function sendBadGateway(res: ServerResponse, error: unknown, options?: GatewayOptions, req?: IncomingMessage): void {
  if (res.headersSent || res.writableEnded || res.destroyed) {
    res.destroy()
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  if (options?.webProcess !== undefined && req?.method === 'GET' && String(req.headers.accept ?? '').includes('text/html')) {
    const html = recoveryPage(options.gatewayPrefix, message)
    res.writeHead(503, { 'content-type': 'text/html; charset=utf-8', 'content-length': String(Buffer.byteLength(html)) })
    res.end(html)
    return
  }
  res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(`${BAD_GATEWAY_MESSAGE}: ${message}`)
}

function isImageResourceRequest(req: IncomingMessage): boolean {
  const pathname = (req.url ?? '').split('?', 1)[0] ?? ''
  return /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp)$/iu.test(pathname)
}

/** Whether the request targets DSH's application index document. */
function isIndexRequest(req: IncomingMessage): boolean {
  if (req.method !== 'GET') return false
  const pathname = (req.url ?? '').split('?', 1)[0] ?? ''
  return pathname === '' || pathname === '/'
}

/** Whether the browser already returns a DSH browser-session cookie. */
function hasBrowserSessionCookie(req: IncomingMessage): boolean {
  return /(?:^|;\s*)dsh-auth-[^=;]+=/u.test(String(req.headers.cookie ?? ''))
}

function withLaunchToken(path: string | undefined, token: string | undefined): string | undefined {
  if (path === undefined || token === undefined || token === '') return path
  try {
    const url = new URL(path, 'http://fnos-gateway.invalid')
    url.searchParams.delete('token')
    url.searchParams.set('token', token)
    return `${url.pathname || '/'}${url.search}`
  } catch {
    return path
  }
}

function stripLaunchTokenFromLocation(value: string): string {
  try {
    const url = new URL(value, 'http://fnos-gateway.invalid')
    if (!url.searchParams.has('token')) return value
    url.searchParams.delete('token')
    return `${url.pathname || '/'}${url.search}${url.hash}`
  } catch {
    return value
  }
}

/**
 * Decide whether this upstream request must carry the launch token.
 *
 * DSH mints its browser-session cookie from a tokenized index request, but it
 * answers *every* tokenized index request with a 303 to the clean `/` — even
 * one that already carried a valid cookie. Injecting the token into every
 * request therefore turns the clean-URL redirect into an infinite loop
 * ("too many redirects"). Only the cookie-less index request bootstraps with a
 * token; every other request authenticates with the cookie the browser now
 * holds.
 */
function needsLaunchToken(req: IncomingMessage): boolean {
  return isIndexRequest(req) && !hasBrowserSessionCookie(req)
}

export function createProxyHandler(options: GatewayOptions): RequestHandler {
  const { upstreamHost, upstreamPort, gatewayPrefix, sseKeepaliveInterval = 15_000 } = options

  const writeUpstreamResponse = (proxyRes: IncomingMessage, req: IncomingMessage, res: ServerResponse): void => {
    const contentType = String(proxyRes.headers['content-type'] || '').toLowerCase()
    const eventStream = contentType.startsWith('text/event-stream')
    // A plugin may return a fallback HTML document for a missing asset.
    // Never run that response through the HTML rewriter for an image URL;
    // preserve the upstream status, body, and headers for the browser.
    const imageResource = isImageResourceRequest(req)
    const rewriteBody = !eventStream
      && !imageResource
      && (
      contentType.includes('text/html')
      || contentType.includes('text/css')
      || contentType.includes('javascript')
      )
    const headers = copyResponseHeaders(proxyRes.headers, {
      rewriteBody,
      eventStream,
      gatewayPrefix,
    })
    if (typeof headers.location === 'string') headers.location = stripLaunchTokenFromLocation(headers.location)

    if (!rewriteBody) {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.statusMessage, headers)
      if (eventStream) {
        res.flushHeaders()
        attachSseKeepalive(res, { interval: sseKeepaliveInterval })
      }
      proxyRes.pipe(res)
      return
    }

    const chunks: Buffer[] = []
    proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk))
    proxyRes.on('error', (error: unknown) => sendBadGateway(res, error))
    proxyRes.on('end', () => {
      const rawBody = Buffer.concat(chunks)
      let rewrittenBody: string
      if (contentType.includes('text/html')) {
        const bridgeScript = gatewayBridgeScript({
          prefix: gatewayPrefix,
          customPaths: options.pathAllowlist?.snapshot().paths ?? [],
          eventsPath: '/__fnos-gateway/path-allowlist/events',
        })
        rewrittenBody = rewriteHtml(rawBody, gatewayPrefix, bridgeScript)
      } else if (contentType.includes('text/css')) {
        rewrittenBody = rewriteCss(rawBody, gatewayPrefix)
      } else {
        rewrittenBody = rewriteJavaScript(rawBody, req.url || '/', gatewayPrefix)
      }
      const body = Buffer.from(rewrittenBody)
      headers['content-length'] = String(body.length)
      res.writeHead(proxyRes.statusCode || 502, proxyRes.statusMessage, headers)
      res.end(body)
    })
  }

  /**
   * Re-request the index with the current launch token after DSH rejected a
   * stale browser cookie. DSH answers that request with a fresh cookie and a
   * 303 to the clean URL, so the browser recovers without reopening the app.
   */
  const replayIndexWithLaunchToken = (req: IncomingMessage, res: ServerResponse, token: string): void => {
    const headers = copyRequestHeaders(req, { host: upstreamHost, port: upstreamPort })
    const request = httpRequest({
      host: upstreamHost,
      port: upstreamPort,
      method: 'GET',
      path: withLaunchToken('/', token),
      headers,
    }, upstreamResponse => {
      writeUpstreamResponse(upstreamResponse, req, res)
    })
    request.on('error', error => sendBadGateway(res, error, options, req))
    request.end()
  }

  return createProxyMiddleware({
    target: `http://${upstreamHost}:${upstreamPort}`,
    ws: true,
    changeOrigin: false,
    selfHandleResponse: true,
    on: {
      proxyReq: (proxyReq, req) => {
        applyProxyRequestHeaders(proxyReq, req, { host: upstreamHost, port: upstreamPort })
        if (!needsLaunchToken(req)) return
        proxyReq.path = withLaunchToken(proxyReq.path, options.webProcess?.getLaunchToken?.()) ?? proxyReq.path
      },
      proxyReqWs: (proxyReq, req) => {
        applyProxyRequestHeaders(proxyReq, req, { host: upstreamHost, port: upstreamPort })
        if (!needsLaunchToken(req)) return
        proxyReq.path = withLaunchToken(proxyReq.path, options.webProcess?.getLaunchToken?.()) ?? proxyReq.path
      },
      proxyRes: (proxyRes, req, res) => {
        if (proxyRes.statusCode === 401 && isIndexRequest(req) && hasBrowserSessionCookie(req)) {
          const token = options.webProcess?.getLaunchToken?.()
          if (token !== undefined && token !== '') {
            proxyRes.resume()
            replayIndexWithLaunchToken(req, res, token)
            return
          }
        }
        writeUpstreamResponse(proxyRes, req, res)
      },
      error: (err, _req, res) => {
        const target = res as ServerResponse | undefined
        if (target && typeof target.writeHead === 'function') {
          sendBadGateway(target, err, options, _req)
        }
      },
    },
  })
}
