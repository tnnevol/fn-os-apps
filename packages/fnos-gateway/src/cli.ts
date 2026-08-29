import { createGateway } from './server.js'
import { normalizePrefix } from './middleware/path-rewrite.js'
import { PathAllowlistStore } from './path-allowlist.js'
import { WebProcessController } from './web-process.js'

const SOCKET_PATH = process.env.GATEWAY_SOCKET || '/var/apps/fn-deepseek-harness/target/app.sock'
const UPSTREAM_HOST = process.env.DSH_UPSTREAM_HOST || '127.0.0.1'
const UPSTREAM_PORT = Number.parseInt(process.env.DSH_UPSTREAM_PORT || '3080', 10)
const GATEWAY_PREFIX = normalizePrefix(process.env.GATEWAY_PREFIX || '/app/fn-deepseek-harness')
const PATH_ALLOWLIST_FILE = process.env.GATEWAY_PATH_ALLOWLIST || '/var/apps/fn-deepseek-harness/var/gateway/path-allowlist.json'
const DSH_BIN = process.env.DSH_BIN
const DSH_CWD = process.env.DSH_CWD || process.cwd()
const DSH_PID_FILE = process.env.DSH_PID_FILE

const trustedHosts = (process.env.DSH_TRUSTED_HOSTS || '').split(',').map(value => value.trim()).filter(Boolean)
const dshArgs = ['web', '--host', process.env.DSH_WEB_HOST || '127.0.0.1', '--port', String(UPSTREAM_PORT)]
for (const host of trustedHosts) dshArgs.push('--trusted-host', host)
const webProcess = DSH_BIN && DSH_PID_FILE ? new WebProcessController({
  command: DSH_BIN,
  args: dshArgs,
  cwd: DSH_CWD,
  pidFile: DSH_PID_FILE,
  startingPidFile: `${DSH_PID_FILE}.starting`,
  lockFile: process.env.DSH_START_LOCK_FILE || `${DSH_PID_FILE}.lock`,
  healthUrl: `http://${UPSTREAM_HOST}:${String(UPSTREAM_PORT)}/`,
}) : undefined

if (!Number.isInteger(UPSTREAM_PORT) || UPSTREAM_PORT < 1 || UPSTREAM_PORT > 65535) {
  console.error('Invalid dsh upstream port: ' + (process.env.DSH_UPSTREAM_PORT || ''))
  process.exit(1)
}

const { close, server } = createGateway({
  socketPath: SOCKET_PATH,
  gatewayPrefix: GATEWAY_PREFIX,
  upstreamHost: UPSTREAM_HOST,
  upstreamPort: UPSTREAM_PORT,
  pathAllowlist: new PathAllowlistStore(PATH_ALLOWLIST_FILE),
  ...(webProcess === undefined ? {} : { webProcess }),
})

if (webProcess !== undefined) server.once('listening', () => {
  void webProcess.start().then(snapshot => console.log(`[fnos-gateway] DSH Web state: ${snapshot.state}`))
})

let shuttingDown = false
const shutdown = (exitCode = 0): void => {
  if (shuttingDown) return
  shuttingDown = true
  void close().catch(error => {
    console.error('[fnos-gateway] shutdown failed', error)
    exitCode = 1
  }).finally(() => process.exit(exitCode))
}

process.once('SIGTERM', () => shutdown())
process.once('SIGINT', () => shutdown())
process.once('uncaughtException', error => {
  console.error('[fnos-gateway] uncaught exception', error)
  shutdown(1)
})
process.once('unhandledRejection', reason => {
  console.error('[fnos-gateway] unhandled rejection', reason)
  shutdown(1)
})
