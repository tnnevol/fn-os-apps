import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as React from 'react'
import * as ReactJsxRuntime from 'react/jsx-runtime'

interface Handoff {
  id: string
  factory: (require: (specifier: string) => unknown) => Record<string, unknown>
}

declare global {
  interface Window {
    __ModuleLoader__?: { load(handoff: Handoff): void }
  }
}

describe('dsh-codex-auth-plugin client artifact', () => {
  it('registers the client factory with the DSH module loader', () => {
    const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
    let handoff: Handoff | undefined
    const browserWindow = {} as Window
    Object.defineProperty(globalThis, 'window', { configurable: true, value: browserWindow })
    browserWindow.__ModuleLoader__ = { load: value => { handoff = value } }
    // The bundle is deliberately executed as a ModuleLoader registration script.
    new Function(source)()
    expect(handoff?.id).toBe('@tnnevol/dsh-codex-auth')
    const exports = handoff?.factory(specifier => {
      if (specifier === 'react') return React
      if (specifier === 'react-dom') return {}
      if (specifier === 'react/jsx-runtime') return ReactJsxRuntime
      if (specifier === '@deepseek-ai/dsh-client-ui-primitives') {
        return { IconChevronDownOutline14: () => null }
      }
      throw new Error(`unexpected client external: ${specifier}`)
    })
    expect(typeof exports?.apply).toBe('function')
    expect(exports?.name).toBe('dsh-codex-auth-plugin-client')
  })
})
