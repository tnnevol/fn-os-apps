import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { serializeBridgeConfig } from '../src/bridge-config.ts'

describe('browser bridge source', () => {
  const source = readFileSync(new URL('../src/client/bridge.js', import.meta.url), 'utf8')
  it('is independent source with one runtime config handoff', () => {
    expect(source.match(/window\.__FNOS_GATEWAY_CONFIG__/gu)).toHaveLength(1)
    expect(source).toContain('XMLHttpRequest.prototype.open')
    expect(source).toContain('window.EventSource')
    expect(source).toContain('window.WebSocket')
  })
  it('cannot close the containing script through a configured path', () => {
    const serialized = serializeBridgeConfig({ paths: ['/<\/script>'] })
    expect(serialized).not.toContain('</script>')
    expect(serialized).toContain('\\u003c')
  })
})
