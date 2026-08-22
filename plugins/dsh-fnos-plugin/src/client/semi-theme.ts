/** Map Semi's design tokens to the DSH theme tokens used by the host. */

export const SEMI_DSH_THEME_ATTRIBUTE = 'data-dsh-fnos-semi-theme'

const SEMI_DSH_THEME_CSS = `
body[${SEMI_DSH_THEME_ATTRIBUTE}] {
  --semi-color-bg-0: var(--dsw-alias-bg-base);
  --semi-color-bg-1: var(--dsw-alias-bg-layer-1);
  --semi-color-bg-2: var(--dsw-alias-bg-layer-2);
  --semi-color-bg-3: var(--dsw-alias-bg-layer-3);
  --semi-color-border: var(--dsw-alias-border-l2);
  --semi-color-fill-0: var(--dsw-alias-interactive-bg-hover);
  --semi-color-fill-1: var(--dsw-alias-interactive-bg-active);
  --semi-color-fill-2: var(--dsw-alias-interactive-bg-hover-solid);
  --semi-color-text-0: var(--dsw-alias-label-primary);
  --semi-color-text-1: var(--dsw-alias-label-secondary);
  --semi-color-text-2: var(--dsw-alias-label-tertiary);
  --semi-color-text-3: var(--dsw-alias-label-dimmed);
  --semi-color-primary: var(--dsw-alias-button-primary-fill);
  --semi-color-primary-hover: var(--dsw-alias-button-primary-hover);
  --semi-color-primary-active: var(--dsw-alias-button-primary-dimmed);
  --semi-color-primary-light-active: var(--dsw-alias-border-l3);
  --semi-color-secondary: var(--dsw-alias-button-contrast-fill);
  --semi-color-secondary-hover: var(--dsw-alias-button-primary-hover);
  --semi-color-secondary-active: var(--dsw-alias-button-primary-dimmed);
  --semi-color-tertiary: var(--dsw-alias-button-tool-bar-fill);
  --semi-color-tertiary-hover: var(--dsw-alias-button-tool-bar-hover);
  --semi-color-tertiary-active: var(--dsw-alias-interactive-bg-active);
  --semi-color-primary-light-default: var(--dsw-alias-interactive-bg-hover);
  --semi-color-primary-light-hover: var(--dsw-alias-interactive-bg-active);
  --semi-color-primary-light-active: var(--dsw-alias-interactive-bg-active);
  --semi-color-disabled-text: var(--dsw-alias-label-dimmed);
  --semi-color-disabled-border: var(--dsw-alias-border-l1);
  --semi-color-disabled-bg: var(--dsw-alias-bg-layer-2);
  --semi-color-focus-border: var(--dsw-alias-state-business-primary);
  --semi-color-link: var(--dsw-alias-state-business-primary);
  --semi-color-link-hover: var(--dsw-alias-button-info-hover);
  --semi-color-link-active: var(--dsw-alias-button-info-fill);
  --semi-color-danger: var(--dsw-alias-state-error-primary);
  --semi-color-danger-hover: var(--dsw-alias-state-error-secondary);
  --semi-color-warning: var(--dsw-alias-state-warn-primary);
  --semi-color-success: var(--dsw-alias-state-success-primary);
  --semi-shadow-elevated: var(--dsw-shadow-lv3);
  --semi-border-radius-small: 6px;
  --semi-border-radius-medium: 8px;
  --semi-border-radius-large: 12px;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-dropdown,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-icon {
  font-family: var(--dsw-font-family);
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-dropdown-wrapper {
  background: var(--dsw-alias-bg-layer-3);
  border: 1px solid var(--dsw-alias-border-l2);
  box-shadow: var(--dsw-shadow-lv3);
}

/* Semi's default Tooltip background uses the raw --semi-grey-7 token. That
 * token is not available in the host theme, so the declaration becomes
 * invalid and leaves the portal transparent. Use DSH semantic tokens instead
 * so the tooltip remains readable in both light and dark themes. */
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tooltip-wrapper {
  background-color: var(--dsw-alias-bg-layer-3, #2a2a2a);
  color: var(--dsw-alias-label-primary, #fff);
  box-shadow: var(--dsw-shadow-lv3, 0 8px 24px rgba(0, 0, 0, 0.18));
  pointer-events: none;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tooltip-wrapper .semi-tooltip-icon-arrow {
  color: var(--dsw-alias-bg-layer-3, #2a2a2a);
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list {
  overflow-x: auto;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list > ul {
  min-width: max-content;
}

/* The reference rail is portaled into the composer card. Reserve the same
 * top row in DSH's native scrollport so the caret and draft stay below it. */
body[${SEMI_DSH_THEME_ATTRIBUTE}] [data-composer-card]:has([data-dsh-fnos-input-references]) [data-input-scroll] {
  padding-top: 46px;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list .semi-checkbox-inner-checked .semi-checkbox-inner-display {
  background: var(--dsw-alias-state-business-primary, #4d8dff);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-state-business-primary, #4d8dff);
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list .semi-tree-option-selected .semi-tree-option-label,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list .semi-tree-option-selected .semi-tree-option-label:hover,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list .semi-tree-option-selected .semi-tree-option-label:active {
  background-color: var(--dsw-alias-interactive-bg-hover);
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-dropdown-item {
  color: var(--dsw-alias-label-primary);
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-dropdown-item:hover,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-dropdown-item-hover,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-dropdown-item:focus-visible {
  background: var(--dsw-alias-interactive-bg-hover);
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-dropdown-item:active {
  background: var(--dsw-alias-interactive-bg-active);
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button-borderless {
  color: var(--dsw-alias-label-primary);
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button-borderless:not(.semi-button-disabled):hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button-borderless:not(.semi-button-disabled):active {
  background: var(--dsw-alias-interactive-bg-active);
}
`

/** Install a reversible, body-scoped Semi theme bridge for the plugin. */
export function installSemiDshTheme(): () => void {
  if (typeof document === 'undefined' || document.body === null) return () => undefined

  const previousAttribute = document.body.getAttribute(SEMI_DSH_THEME_ATTRIBUTE)
  const style = document.createElement('style')
  style.dataset.dshFnos = 'semi-theme'
  style.textContent = SEMI_DSH_THEME_CSS
  document.body.setAttribute(SEMI_DSH_THEME_ATTRIBUTE, '')
  document.head.append(style)

  return () => {
    style.remove()
    if (previousAttribute === null) document.body?.removeAttribute(SEMI_DSH_THEME_ATTRIBUTE)
    else document.body?.setAttribute(SEMI_DSH_THEME_ATTRIBUTE, previousAttribute)
  }
}
