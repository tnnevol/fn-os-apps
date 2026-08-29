import { createServer, type Server } from 'node:http'
import { unlinkSync } from 'node:fs'
import connect from 'connect'
import type { GatewayOptions, GatewayServer } from './types.js'
import { pathRewriteMiddleware } from './middleware/path-rewrite.js'
import { createProxyHandler } from './proxy.js'

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
  app.use(createProxyHandler(options))

  const openSockets = new Set<import('node:net').Socket>()
  let stopping = false

  const server: Server = createServer(app)
  server.on('connection', (socket) => {
    openSockets.add(socket)
    socket.once('close', () => openSockets.delete(socket))
  })
  server.on('clientError', (_err, socket) => socket.destroy())

  const close = (): Promise<void> => new Promise((resolve) => {
    if (stopping) {
      resolve()
      return
    }
    stopping = true
    for (const socket of openSockets) socket.destroy()
    server.close(() => {
      removeSocket(socketPath)
      resolve()
    })
    setTimeout(() => {
      removeSocket(socketPath)
      resolve()
    }, 5000).unref()
  })

  removeSocket(socketPath)
  server.listen(socketPath, () => {
    console.log(`fnOS gateway listening on ${socketPath}`)
  })

  return { server, close }
}
