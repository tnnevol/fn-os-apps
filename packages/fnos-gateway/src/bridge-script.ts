import bridgeSource from 'virtual:fnos-gateway-bridge'
import { serializeBridgeConfig } from './bridge-config.js'

export interface GatewayBridgeConfig {
  prefix: string
  customPaths: readonly string[]
  eventsPath: string
  webRestartPath: string
}

/** Inject the independently maintained browser bridge with JSON-safe config. */
export function gatewayBridgeScript(config: GatewayBridgeConfig): string {
  const serialized = serializeBridgeConfig(config)
  const body = `window.__FNOS_GATEWAY_CONFIG__=${serialized};\n${bridgeSource}\ntry{delete window.__FNOS_GATEWAY_CONFIG__;}catch(_){}`
  return '<script>\n' + body + '\n</' + 'script>'
}
