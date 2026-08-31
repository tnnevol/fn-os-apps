/** Keep browser refresh shortcuts scoped to the embedded DSH Web document. */

import { isEmbeddedFnosFrame } from './sdk-carrier.ts'

export function isBrowserRefreshShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>): boolean {
  if (event.key === 'F5') return true
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r'
}

export function installFnosBrowserRefreshShortcut(): () => void {
  if (!isEmbeddedFnosFrame()) return () => {}

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (!isBrowserRefreshShortcut(event)) return

    // The host page owns the browser frame. Cancel its default reload and
    // refresh only the embedded DSH Web document instead.
    event.preventDefault()
    event.stopPropagation()
    window.location.reload()
  }

  window.addEventListener('keydown', handleKeyDown, true)
  return () => { window.removeEventListener('keydown', handleKeyDown, true) }
}
