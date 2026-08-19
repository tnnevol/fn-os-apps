import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface Handoff {
  id: string
  factory: (require: (specifier: string) => unknown) => Record<string, unknown>
}

describe('dsh-fnos client artifact', () => {
  it('registers the scoped ModuleLoader factory with the bundled theme bridge', () => {
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
    expect(handoff?.id).toBe('@tnnevol/dsh-fnos')
    expect(source).toContain('sdk.$on("os/theme"')
    expect(source).toContain('getPlatformConfig')
    expect(source).toContain('const fnosTheme = bridge.getTheme()')
    expect(source).not.toContain('/app/fn-deepseek-harness/trim-web-app.js')
    expect(source).not.toContain('__DSH_FNOS_THEME_BRIDGE__')
    expect(source).not.toContain('setInterval')
    expect(source).not.toContain('visibilitychange')
    const react = {
      useCallback: <T extends (...args: never[]) => unknown>(callback: T): T => callback,
      useEffect: () => {},
      useState: <T>(value: T): [T, (next: T) => void] => [value, () => {}],
    }
    const primitives = {
      IconBrowseOutline16: () => null,
      IconFolderOpen16: () => null,
    }
    const jsxRuntime = { jsx: () => null, jsxs: () => null, Fragment: Symbol('Fragment') }
    const exports = handoff?.factory(specifier => {
      if (specifier === 'react') return react
      if (specifier === 'react/jsx-runtime') return jsxRuntime
      if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return primitives
      throw new Error(`unexpected client external: ${specifier}`)
    })
    expect(typeof exports?.apply).toBe('function')
    expect(exports?.name).toBe('dsh-fnos-plugin-client')
  })
})
