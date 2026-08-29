import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
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
  it('re-wraps the live module loader after create replaces load', () => {
    expect(source).toContain('var create = loader.create')
    expect(source).toContain('wrapLoader(this)')
    expect(source).toContain('connection.isLoopback = true')
  })
  it('maps a plugin custom API path after the allowlist event arrives', async () => {
    const requests: string[] = []
    const eventSources: Array<{ emit(event: string, data: string): void }> = []
    const window: Record<string, unknown> = {
      location: { href: 'http://nas.example/app/fn-deepseek-harness/', origin: 'http://nas.example' },
      fetch(input: unknown) {
        requests.push(String(input))
        return Promise.resolve()
      },
      EventSource: function (this: { addEventListener(event: string, listener: (value: { data: string }) => void): void }, _url: string) {
        const listeners = new Map<string, (value: { data: string }) => void>()
        this.addEventListener = (event, listener) => { listeners.set(event, listener) }
        eventSources.push({ emit: (event, data) => listeners.get(event)?.({ data }) })
      },
    }
    function Xhr(): void {}
    Xhr.prototype.open = function (): void {}
    function Node(): void {}
    Node.prototype.appendChild = function (node: unknown): unknown { return node }
    Node.prototype.insertBefore = function (node: unknown): unknown { return node }
    function Element(): void {}
    Element.prototype.append = function (): void {}

    runInNewContext(`window.__FNOS_GATEWAY_CONFIG__ = ${JSON.stringify({ prefix: '/app/fn-deepseek-harness', customPaths: ['/dsh-market'], eventsPath: '/__fnos-gateway/path-allowlist/events' })};${source}`, {
      window,
      XMLHttpRequest: Xhr,
      Node,
      Element,
      EventSource: window.EventSource,
      URL,
    })

    const sourceEvent = eventSources[0]
    if (sourceEvent === undefined) throw new Error('bridge did not create its path event source')
    sourceEvent.emit('paths', JSON.stringify({ version: 1, paths: ['/dsh-market'] }))
    await (window.fetch as (input: unknown) => Promise<void>)('/dsh-market/registry')

    expect(requests).toEqual(['http://nas.example/app/fn-deepseek-harness/dsh-market/registry'])
  })
  it('cannot close the containing script through a configured path', () => {
    const serialized = serializeBridgeConfig({ paths: ['/<\/script>'] })
    expect(serialized).not.toContain('</script>')
    expect(serialized).toContain('\\u003c')
  })
})
