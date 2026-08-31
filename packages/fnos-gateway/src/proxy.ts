import { createProxyMiddleware } from 'http-proxy-middleware'
import type { RequestHandler } from 'http-proxy-middleware'
import type { ServerResponse, IncomingMessage } from 'node:http'
import type { GatewayOptions } from './types.js'
import { applyProxyRequestHeaders } from './middleware/request-headers.js'
import { copyResponseHeaders } from './middleware/response-headers.js'
import { rewriteHtml, rewriteCss, rewriteJavaScript } from './middleware/content-rewrite.js'
import { gatewayBridgeScript } from './bridge-script.js'
import { attachSseKeepalive } from './middleware/sse-keepalive.js'
import { BAD_GATEWAY_MESSAGE } from './constants.js'
import { recoveryPage } from './recovery-page.js'

function sendBadGateway(res: ServerResponse, error: unknown, options?: GatewayOptions, req?: IncomingMessage): void {
  if (res.headersSent) {
    res.destroy()
    return
  }
  res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
  const message = error instanceof Error ? error.message : String(error)
  if (options?.webProcess !== undefined && req?.method === 'GET' && String(req.headers.accept ?? '').includes('text/html')) {
    const html = recoveryPage(options.gatewayPrefix, message)
    res.writeHead(503, { 'content-type': 'text/html; charset=utf-8', 'content-length': String(Buffer.byteLength(html)) })
    res.end(html)
    return
  }
  res.end(`${BAD_GATEWAY_MESSAGE}: ${message}`)
}

function isImageResourceRequest(req: IncomingMessage): boolean {
  const pathname = (req.url ?? '').split('?', 1)[0] ?? ''
  return /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp)$/iu.test(pathname)
}

export function createProxyHandler(options: GatewayOptions): RequestHandler {
  const { upstreamHost, upstreamPort, gatewayPrefix, sseKeepaliveInterval = 15_000 } = options

  return createProxyMiddleware({
    target: `http://${upstreamHost}:${upstreamPort}`,
    ws: true,
    changeOrigin: false,
    selfHandleResponse: true,
    on: {
      proxyReq: (proxyReq, req) => applyProxyRequestHeaders(proxyReq, req, { host: upstreamHost, port: upstreamPort }),
      proxyReqWs: (proxyReq, req) => applyProxyRequestHeaders(proxyReq, req, { host: upstreamHost, port: upstreamPort }),
      proxyRes: (proxyRes, req, res) => {
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
