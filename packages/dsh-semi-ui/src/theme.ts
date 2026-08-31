/** Map Semi's design tokens to the DSH theme tokens used by the host. */

export const SEMI_DSH_THEME_ATTRIBUTE = 'data-dsh-semi-theme'
const DSH_DARK_THEME_ATTRIBUTE = 'data-ds-dark-theme'
const SEMI_THEME_MODE_ATTRIBUTE = 'theme-mode'

import './theme.scss'

/** Install a reversible, body-scoped Semi theme bridge for a DSH client. */
export function installSemiDshTheme(): () => void {
  if (typeof document === 'undefined' || document.body === null) return () => undefined

  const body = document.body
  const refCountAttribute = 'data-dsh-semi-theme-refcount'
  const previousRefCount = Number(body.getAttribute(refCountAttribute) ?? '0') || 0
  const previousAttribute = previousRefCount === 0 ? body.getAttribute(SEMI_DSH_THEME_ATTRIBUTE) : null
  const previousThemeMode = previousRefCount === 0 ? body.getAttribute(SEMI_THEME_MODE_ATTRIBUTE) : null
  // Remove the runtime style marker used by pre-SCSS builds. The compiled
  // theme is now supplied by the package stylesheet, so stale hot-update
  // styles must not remain in the document.
  document.head.querySelectorAll('style[data-dsh-semi="theme"]').forEach((style) => style.remove())
  // Semi's bundled dark palette is selected by `body[theme-mode=dark]`.
  // DSH owns the authoritative theme state through `data-ds-dark-theme`, so
  // mirror that attribute instead of allowing Semi to resolve the OS scheme.
  const syncThemeMode = (): void => {
    document.body?.setAttribute(SEMI_THEME_MODE_ATTRIBUTE, document.body.hasAttribute(DSH_DARK_THEME_ATTRIBUTE) ? 'dark' : 'light')
  }
  const observer = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(syncThemeMode)
  observer?.observe(body, { attributes: true, attributeFilter: [DSH_DARK_THEME_ATTRIBUTE] })
  syncThemeMode()
  body.setAttribute(refCountAttribute, String(previousRefCount + 1))
  body.setAttribute(SEMI_DSH_THEME_ATTRIBUTE, '')

  return () => {
    observer?.disconnect()
    const currentRefCount = Number(body.getAttribute(refCountAttribute) ?? '1') || 1
    const nextRefCount = Math.max(0, currentRefCount - 1)
    if (nextRefCount > 0) {
      body.setAttribute(refCountAttribute, String(nextRefCount))
      return
    }
    body.removeAttribute(refCountAttribute)
    if (previousAttribute === null) body.removeAttribute(SEMI_DSH_THEME_ATTRIBUTE)
    else body.setAttribute(SEMI_DSH_THEME_ATTRIBUTE, previousAttribute)
    if (previousThemeMode === null) body.removeAttribute(SEMI_THEME_MODE_ATTRIBUTE)
    else body.setAttribute(SEMI_THEME_MODE_ATTRIBUTE, previousThemeMode)
  }
}
