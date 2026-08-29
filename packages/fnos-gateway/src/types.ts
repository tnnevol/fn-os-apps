import type { Server } from 'node:http'
import type { PathAllowlistStore } from './path-allowlist.js'
import type { WebProcessController } from './web-process.js'

export interface GatewayOptions {
  socketPath: string
  gatewayPrefix: string
  upstreamHost: string
  upstreamPort: number
  sseKeepaliveInterval?: number
  pathAllowlist?: PathAllowlistStore
  webProcess?: WebProcessController
}

export interface GatewayServer {
  server: Server
  close: () => Promise<void>
}
