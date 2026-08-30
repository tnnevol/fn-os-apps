/** Persist the resolved fnOS theme without changing DSH's theme preference. */

import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { DshThemePreference } from '../theme-bootstrap.ts'
import { FNOS_SYSTEM_THEME_FIELD, type FnosSettings, type FnosTheme } from '../theme-contract.ts'

export function createThemePersistence(scope: SettingsScope<FnosSettings>) {
  let pendingOperation: string | undefined
  // Keep the last successful request suppressed until the bound settings
  // snapshot catches up. A settings mutation can resolve before its next
  // describe/subscribe update arrives, which would otherwise cause every
  // theme event to issue the same mutation again.
  let lastRequestedOperation: string | undefined
  let latestRequest: { preference: DshThemePreference; theme: FnosTheme | null; operation: string } | undefined

  const sync = (preference: DshThemePreference, theme: FnosTheme | null): void => {
    const snapshot = scope.getSnapshot()
    if (snapshot.mode !== 'host' || !snapshot.writable) return

    const target = preference === 'system' && theme !== null ? theme : undefined
    const current = snapshot.value?.[FNOS_SYSTEM_THEME_FIELD]
    const operation = target === undefined ? 'unset' : `set:${target}`
    latestRequest = { preference, theme, operation }

    if (current === target) {
      if (lastRequestedOperation === operation) lastRequestedOperation = undefined
      return
    }

    if (pendingOperation !== undefined || lastRequestedOperation === operation) return
    pendingOperation = operation
    lastRequestedOperation = operation

    try {
      const request = target === undefined
        ? scope.unset(FNOS_SYSTEM_THEME_FIELD)
        : scope.set(FNOS_SYSTEM_THEME_FIELD, target)
      void Promise.resolve(request).catch(error => {
        if (lastRequestedOperation === operation) lastRequestedOperation = undefined
        console.debug('[dsh-fnos] unable to persist fnOS theme snapshot', error)
      }).finally(() => {
        if (pendingOperation === operation) pendingOperation = undefined
        const latest = latestRequest
        if (latest !== undefined && latest.operation !== operation) {
          queueMicrotask(() => sync(latest.preference, latest.theme))
        }
      })
    } catch (error) {
      pendingOperation = undefined
      if (lastRequestedOperation === operation) lastRequestedOperation = undefined
      console.debug('[dsh-fnos] unable to persist fnOS theme snapshot', error)
    }
  }

  return { sync }
}
