/** Open DSH's settings shell with the standard Cmd/Ctrl + comma shortcut. */

import { createElement, Fragment } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { DshHotKeys } from '@tnnevol/dsh-semi-ui'
import { isSettingsShortcut } from './settings-shortcut-matcher.ts'
import { isEmbeddedFnosFrame } from '../services/sdk-carrier.ts'

const SETTINGS_TRIGGER_SELECTOR = '[data-slot="sidebar.settings"] > button[aria-haspopup="dialog"]'

function openDshSettings(): boolean {
  if (typeof document === 'undefined') return false
  const trigger = document.querySelector<HTMLButtonElement>(SETTINGS_TRIGGER_SELECTOR)
  if (trigger === null || trigger.disabled) return false
  trigger.click()
  return true
}

export { isSettingsShortcut } from './settings-shortcut-matcher.ts'

export function installFnosSettingsShortcut(): () => void {
  if (!isEmbeddedFnosFrame() || typeof document === 'undefined' || document.body === null) return () => {}

  const handleHotKey = (event: KeyboardEvent): void => {
    if (!isSettingsShortcut(event)) return
    if (!openDshSettings()) return
    event.preventDefault()
    event.stopPropagation()
  }

  const mount = document.createElement('span')
  mount.setAttribute('data-dsh-fnos-settings-shortcut', '')
  mount.hidden = true
  document.body.append(mount)

  const root: Root = createRoot(mount)
  root.render(createElement(
    Fragment,
    null,
    createElement(DshHotKeys, {
      hotKeys: [DshHotKeys.Keys.Control, DshHotKeys.Keys.Comma],
      onHotKey: handleHotKey,
      getListenerTarget: () => window as unknown as HTMLElement,
      render: null,
    }),
    createElement(DshHotKeys, {
      hotKeys: [DshHotKeys.Keys.Meta, DshHotKeys.Keys.Comma],
      onHotKey: handleHotKey,
      getListenerTarget: () => window as unknown as HTMLElement,
      render: null,
    }),
  ))

  return () => {
    root.unmount()
    mount.remove()
  }
}
