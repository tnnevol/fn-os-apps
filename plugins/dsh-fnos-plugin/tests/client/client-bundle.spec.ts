import { readFileSync } from 'node:fs'
import * as React from 'react'
import * as ReactDom from 'react-dom'
import * as ReactDomClient from 'react-dom/client'
import { describe, expect, it } from 'vitest'

interface Handoff {
  id: string
  factory: (require: (specifier: string) => unknown) => Record<string, unknown>
}

describe('dsh-fnos client artifact', () => {
  it('registers the scoped ModuleLoader factory with the bundled theme bridge', () => {
    const source = readFileSync(new URL('../../lib/client.js', import.meta.url), 'utf8')
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
    expect(source).toContain('fnOS path opener')
    expect(source).toContain('openFile')
    expect(source).not.toContain('/app/fn-deepseek-harness/trim-web-app.js')
    expect(source).not.toContain('__DSH_FNOS_THEME_BRIDGE__')
    // Semi TreeSelect bundles its own timer utilities. Check the plugin
    // sources for the no-polling contract instead of scanning third-party UI
    // code that is intentionally included in the client artifact.
    const pluginSource = [
      'src/client/index.ts',
      'src/client/services/theme-bridge.ts',
      'src/client/services/sdk.ts',
      'src/components/FnosAuthorizedPathPicker.tsx',
    ].map(path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')).join('\n')
    expect(pluginSource).toContain('useInput((state: InputState) => state)')
    expect(pluginSource).not.toContain('setInterval')
    expect(pluginSource).not.toContain('visibilitychange')
    const primitives = {
      IconBrowseOutline16: () => null,
      IconFolderOpen16: () => null,
    }
    const jsxRuntime = { jsx: () => null, jsxs: () => null, Fragment: Symbol('Fragment') }
    const exports = handoff?.factory(specifier => {
      if (specifier === 'react') return React
      if (specifier === 'react/jsx-runtime') return jsxRuntime
      if (specifier === 'react-dom') return ReactDom
      if (specifier === 'react-dom/client') return ReactDomClient
      if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return primitives
      throw new Error(`unexpected client external: ${specifier}`)
    })
    expect(typeof exports?.apply).toBe('function')
    expect(exports?.name).toBe('dsh-fnos-plugin-client')
  })
})
