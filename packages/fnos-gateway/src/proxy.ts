import { createProxyMiddleware } from 'http-proxy-middleware'
import type { RequestHandler } from 'http-proxy-middleware'
import type { ServerResponse, IncomingMessage } from 'node:http'
import type { GatewayOptions } from './types.js'
import { copyRequestHeaders } from './middleware/request-headers.js'
import { copyResponseHeaders } from './middleware/response-headers.js'
import { rewriteHtml, rewriteCss, rewriteJavaScript } from './middleware/content-rewrite.js'
import { gatewayBridgeScript } from './bridge-script.js'
import { attachSseKeepalive } from './middleware/sse-keepalive.js'
import { BAD_GATEWAY_MESSAGE } from './constants.js'

function sendBadGateway(res: ServerResponse, error: unknown): void {
  if (res.headersSent) {
    res.destroy()
    return
  }
  res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
  const message = error instanceof Error ? error.message : String(error)
  res.end(`${BAD_GATEWAY_MESSAGE}: ${message}`)
}

export function createProxyHandler(options: GatewayOptions): RequestHandler {
  const { upstreamHost, upstreamPort, gatewayPrefix, sseKeepaliveInterval = 15_000 } = options
  const bridgeScript = gatewayBridgeScript(gatewayPrefix)

  return createProxyMiddleware({
    target: `http://${upstreamHost}:${upstreamPort}`,
    ws: true,
    changeOrigin: false,
    selfHandleResponse: true,
    on: {
      proxyReq: (proxyReq, req) => {
        const headers = copyRequestHeaders(req, { host: upstreamHost, port: upstreamPort })
        for (const [name, value] of Object.entries(headers)) {
          if (value === undefined) continue
          if (Array.isArray(value)) {
            for (const item of value) proxyReq.appendHeader(name, item)
          } else {
            proxyReq.setHeader(name, value)
          }
        }
      },
      proxyRes: (proxyRes, req, res) => {
        const contentType = String(proxyRes.headers['content-type'] || '').toLowerCase()
        const eventStream = contentType.startsWith('text/event-stream')
        const rewriteBody = !eventStream && (
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
          sendBadGateway(target, err)
        }
      },
    },
  })
}
