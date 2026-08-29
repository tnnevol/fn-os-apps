import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const VIRTUAL_ID = 'virtual:fnos-gateway-bridge'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

export function bridgeSourcePlugin() {
  return {
    name: 'fnos-gateway-bridge-source',
    resolveId(id: string) { return id === VIRTUAL_ID ? RESOLVED_ID : null },
    async load(id: string) {
      if (id !== RESOLVED_ID) return null
      const source = await readFile(fileURLToPath(new URL('../src/client/bridge.js', import.meta.url)), 'utf8')
      if (!source.includes('window.__FNOS_GATEWAY_CONFIG__')) throw new Error('bridge.js is missing its config handoff')
      return `export default ${JSON.stringify(source)}`
    },
  }
}
