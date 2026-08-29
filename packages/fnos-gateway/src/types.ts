import type { Server } from 'node:http'

export interface GatewayOptions {
  socketPath: string
  gatewayPrefix: string
  upstreamHost: string
  upstreamPort: number
  sseKeepaliveInterval?: number
}

export interface GatewayServer {
  server: Server
  close: () => Promise<void>
}
