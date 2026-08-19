import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface Handoff {
  id: string
  factory: (require: (specifier: string) => unknown) => Record<string, unknown>
}

describe('dsh-fnos client artifact', () => {
  it('runs the prelude before registering the scoped ModuleLoader factory', () => {
    const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
    let handoff: Handoff | undefined
    const browserWindow = {
      matchMedia: () => ({ matches: false }),
      addEventListener() {},
      removeEventListener() {},
      __ModuleLoader__: { load(value: Handoff) { handoff = value } },
    } as unknown as Window
    Object.defineProperty(globalThis, 'window', { configurable: true, value: browserWindow })
    new Function(source)()
    expect((globalThis as typeof globalThis & { __DSH_FNOS_THEME_BRIDGE__?: unknown }).__DSH_FNOS_THEME_BRIDGE__).toBeDefined()
    expect(handoff?.id).toBe('@tnnevol/dsh-fnos')
    expect(source).toContain('sdk.$on("os/theme"')
    expect(source).not.toContain('setInterval')
    expect(source).not.toContain('visibilitychange')
    const exports = handoff?.factory(() => { throw new Error('unexpected client external') })
    expect(typeof exports?.apply).toBe('function')
    expect(exports?.name).toBe('dsh-fnos-plugin-client')
  })
})
