/** Keep browser refresh shortcuts scoped to the embedded DSH Web document. */

import { createElement, Fragment } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { DshHotKeys } from '@tnnevol/dsh-semi-ui'
import { isBrowserRefreshShortcut } from './browser-refresh-shortcut-matcher.ts'
import { isEmbeddedFnosFrame } from './sdk-carrier.ts'

export { isBrowserRefreshShortcut } from './browser-refresh-shortcut-matcher.ts'

export function installFnosBrowserRefreshShortcut(): () => void {
  if (!isEmbeddedFnosFrame() || typeof document === 'undefined' || document.body === null) return () => {}

  const handleHotKey = (event: KeyboardEvent): void => {
    if (!isBrowserRefreshShortcut(event)) return

    event.preventDefault()
    event.stopPropagation()
    window.location.reload()
  }

  const mount = document.createElement('span')
  mount.setAttribute('data-dsh-fnos-browser-refresh-shortcut', '')
  mount.hidden = true
  document.body.append(mount)

  const root: Root = createRoot(mount)
  root.render(createElement(
    Fragment,
    null,
    createElement(DshHotKeys, {
      hotKeys: [DshHotKeys.Keys.F5],
      preventDefault: true,
      onHotKey: handleHotKey,
      getListenerTarget: () => window as unknown as HTMLElement,
      render: null,
    }),
    createElement(DshHotKeys, {
      hotKeys: [DshHotKeys.Keys.Control, DshHotKeys.Keys.R],
      preventDefault: true,
      onHotKey: handleHotKey,
      getListenerTarget: () => window as unknown as HTMLElement,
      render: null,
    }),
    createElement(DshHotKeys, {
      hotKeys: [DshHotKeys.Keys.Meta, DshHotKeys.Keys.R],
      preventDefault: true,
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
