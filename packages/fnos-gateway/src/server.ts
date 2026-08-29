import { createServer, type Server } from 'node:http'
import { unlinkSync } from 'node:fs'
import connect from 'connect'
import type { GatewayOptions, GatewayServer } from './types.js'
import { pathRewriteMiddleware } from './middleware/path-rewrite.js'
import { createProxyHandler } from './proxy.js'
import { PATH_ALLOWLIST_EVENTS_PATH } from './path-allowlist.js'
import { WEB_CONTROL_START_PATH, WEB_CONTROL_STATUS_PATH } from './web-process.js'

function webControl(options: GatewayOptions): connect.NextHandleFunction {
  return (req, res, next) => {
    const path = req.url?.split('?', 1)[0]
    if (path !== WEB_CONTROL_STATUS_PATH && path !== WEB_CONTROL_START_PATH) return next()
    res.setHeader('content-type', 'application/json; charset=utf-8')
    if (options.webProcess === undefined) { res.statusCode = 404; res.end(JSON.stringify({ error: 'web-control-unavailable' })); return }
    if (path === WEB_CONTROL_STATUS_PATH && req.method === 'GET') { void options.webProcess.snapshot().then(value => res.end(JSON.stringify(value))); return }
    if (path === WEB_CONTROL_START_PATH && req.method === 'POST') {
      const administrator = req.headers['x-requested-with'] === 'fetch' && String(req.headers['x-trim-isadmin'] ?? '').toLowerCase() === 'true'
      if (!administrator) { res.statusCode = 403; res.end(JSON.stringify({ error: 'administrator-required' })); return }
      void options.webProcess.start().then(value => { res.statusCode = value.state === 'error' ? 503 : 200; res.end(JSON.stringify(value)) })
      return
    }
    res.statusCode = 405; res.end(JSON.stringify({ error: 'method-not-allowed' }))
  }
}

function pathAllowlistEvents(options: GatewayOptions): connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.url?.split('?', 1)[0] !== PATH_ALLOWLIST_EVENTS_PATH) return next()
    if (req.method !== 'GET' || options.pathAllowlist === undefined) { res.statusCode = 404; res.end(); return }
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive' })
    const unsubscribe = options.pathAllowlist.subscribe(snapshot => {
      res.write(`event: paths\ndata: ${JSON.stringify(snapshot)}\n\n`)
    })
    req.once('close', unsubscribe)
  }
}

function removeSocket(socketPath: string): void {
  try {
    unlinkSync(socketPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error
  }
}

export function createGateway(options: GatewayOptions): GatewayServer {
  const { socketPath, gatewayPrefix } = options

  const app = connect()
  app.use(pathRewriteMiddleware(gatewayPrefix))
  app.use(webControl(options))
  app.use(pathAllowlistEvents(options))
  app.use(createProxyHandler(options))

  const openSockets = new Set<import('node:net').Socket>()
  let stopping = false

  const server: Server = createServer(app)
  server.on('connection', (socket) => {
    openSockets.add(socket)
    socket.once('close', () => openSockets.delete(socket))
  })
  server.on('clientError', (_err, socket) => socket.destroy())

  const close = async (): Promise<void> => {
    if (stopping) {
      return
    }
    stopping = true
    for (const socket of openSockets) socket.destroy()
    options.pathAllowlist?.close()
    await options.webProcess?.stop()
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
      setTimeout(resolve, 5000).unref()
    })
    removeSocket(socketPath)
  }

  removeSocket(socketPath)
  const listen = (): void => {
    server.listen(socketPath, () => { console.log(`fnOS gateway listening on ${socketPath}`) })
  }
  if (options.pathAllowlist === undefined) listen()
  else void options.pathAllowlist.start().then(listen).catch(error => {
    console.error('[fnos-gateway] path allowlist watcher failed', error)
    server.emit('error', error)
  })

  return { server, close }
}
