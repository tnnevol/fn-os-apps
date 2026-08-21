/** Persist the resolved fnOS theme without changing DSH's theme preference. */

import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { DshThemePreference } from '../theme-bootstrap.ts'
import { FNOS_SYSTEM_THEME_FIELD, type FnosSettings, type FnosTheme } from '../theme-contract.ts'

export function createThemePersistence(scope: SettingsScope<FnosSettings>) {
  let pendingOperation: string | undefined

  const sync = (preference: DshThemePreference, theme: FnosTheme | null): void => {
    const snapshot = scope.getSnapshot()
    if (snapshot.mode !== 'host' || !snapshot.writable) return

    const target = preference === 'system' && theme !== null ? theme : undefined
    const current = snapshot.value?.[FNOS_SYSTEM_THEME_FIELD]
    if (current === target) {
      pendingOperation = undefined
      return
    }

    const operation = target === undefined ? 'unset' : `set:${target}`
    if (pendingOperation === operation) return
    pendingOperation = operation

    try {
      const request = target === undefined
        ? scope.unset(FNOS_SYSTEM_THEME_FIELD)
        : scope.set(FNOS_SYSTEM_THEME_FIELD, target)
      void request.catch(error => {
        console.debug('[dsh-fnos] unable to persist fnOS theme snapshot', error)
      }).finally(() => {
        if (pendingOperation === operation) pendingOperation = undefined
      })
    } catch (error) {
      pendingOperation = undefined
      console.debug('[dsh-fnos] unable to persist fnOS theme snapshot', error)
    }
  }

  return { sync }
}
