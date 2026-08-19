/** fnOS theme bridge used after the DSH theme service has initialized. */

import type { PlatformConfig } from '@trimjs/web-app'
import { createTrimApp } from './sdk.ts'

export type FnosTheme = 'light' | 'dark'

export interface ThemeBridge {
  getTheme(): FnosTheme | null
  subscribe(listener: (theme: FnosTheme | null) => void): () => void
  connect(): Promise<() => void | Promise<void>>
  disconnect(): void | Promise<void>
}

function normalizeTheme(value: unknown): FnosTheme | null {
  if (value === 'dark' || value === 'light') return value
  if (Array.isArray(value)) return normalizeTheme(value[0])
  if (!value || typeof value !== 'object') return null
  const config = value as Record<string, unknown>
  return normalizeTheme(
    config.theme
      ?? config.nightMode
      ?? config.mode
      ?? config.value
      ?? config.detail
      ?? config.data,
  )
}

function themeFromConfig(config: PlatformConfig): FnosTheme | null {
  return normalizeTheme(config)
}

/**
 * Create a bridge without changing the browser's native theme state during
 * module loading. DSH owns the first render; the plugin applies fnOS's theme
 * to the document only after the SDK connection has supplied its real state.
 */
export function createThemeBridge(): ThemeBridge {
  const themeSubscribers = new Set<(theme: FnosTheme | null) => void>()
  let activeTheme: FnosTheme | null = null
  let connectionStarted = false
  let connectionStop: (() => void | Promise<void>) | null = null
  let connectionGeneration = 0

  function setTheme(...values: unknown[]): boolean {
    const theme = values.map(normalizeTheme).find(Boolean) ?? null
    if (theme === null || activeTheme === theme) return theme !== null
    activeTheme = theme
    for (const listener of [...themeSubscribers]) listener(activeTheme)
    return true
  }

  async function connect(): Promise<() => void | Promise<void>> {
    if (connectionStarted) return connectionStop ?? (() => {})
    const generation = ++connectionGeneration
    connectionStarted = true

    try {
      const sdk = createTrimApp()
      await sdk.ready()
      if (!sdk.isWeb || sdk.isStandaloneWeb) {
        if (generation === connectionGeneration) connectionStarted = false
        return () => {}
      }

      const config = await sdk.getPlatformConfig()
      if (generation !== connectionGeneration) return () => {}
      setTheme(themeFromConfig(config))

      const handleThemeEvent = (...values: unknown[]): void => {
        if (generation === connectionGeneration) setTheme(...values)
      }
      await sdk.$on('os/theme', handleThemeEvent)
      if (generation !== connectionGeneration) {
        await sdk.$off('os/theme', handleThemeEvent)
        return () => {}
      }

      connectionStop = async () => {
        if (connectionStop === null) return
        connectionStop = null
        connectionStarted = false
        connectionGeneration += 1
        await sdk.$off('os/theme', handleThemeEvent)
      }
      return connectionStop
    } catch (error) {
      if (generation === connectionGeneration) connectionStarted = false
      console.debug('[dsh-fnos] fnOS theme bridge unavailable', error)
      return () => {}
    }
  }

  return {
    getTheme: () => activeTheme,
    subscribe(listener) {
      themeSubscribers.add(listener)
      return () => themeSubscribers.delete(listener)
    },
    connect,
    disconnect() {
      connectionGeneration += 1
      if (connectionStop !== null) return connectionStop()
      connectionStarted = false
      return Promise.resolve()
    },
  }
}
