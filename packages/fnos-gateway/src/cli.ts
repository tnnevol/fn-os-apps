import { createGateway } from './server.js'
import { normalizePrefix } from './middleware/path-rewrite.js'

const SOCKET_PATH = process.env.GATEWAY_SOCKET || '/var/apps/fn-deepseek-harness/target/app.sock'
const UPSTREAM_HOST = process.env.DSH_UPSTREAM_HOST || '127.0.0.1'
const UPSTREAM_PORT = Number.parseInt(process.env.DSH_UPSTREAM_PORT || '3080', 10)
const GATEWAY_PREFIX = normalizePrefix(process.env.GATEWAY_PREFIX || '/app/fn-deepseek-harness')

if (!Number.isInteger(UPSTREAM_PORT) || UPSTREAM_PORT < 1 || UPSTREAM_PORT > 65535) {
  console.error('Invalid dsh upstream port: ' + (process.env.DSH_UPSTREAM_PORT || ''))
  process.exit(1)
}

const { close } = createGateway({
  socketPath: SOCKET_PATH,
  gatewayPrefix: GATEWAY_PREFIX,
  upstreamHost: UPSTREAM_HOST,
  upstreamPort: UPSTREAM_PORT,
})

const shutdown = (): void => {
  void close().then(() => process.exit(0))
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
