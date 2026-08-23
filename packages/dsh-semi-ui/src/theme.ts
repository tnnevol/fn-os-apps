/** Map Semi's design tokens to the DSH theme tokens used by the host. */

export const SEMI_DSH_THEME_ATTRIBUTE = 'data-dsh-semi-theme'

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

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-cascader,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-cascader-popover,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-cascader-option-lists,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-cascader-option-list {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-3);
  border-color: var(--dsw-alias-border-l2);
  border-radius: 10px;
  box-shadow: var(--dsw-shadow-lv3);
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-cascader-popover,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-cascader-option-lists {
  overflow: hidden;
}

/* Give the leaf panel extra room for model names without widening the trigger panel. */
body[${SEMI_DSH_THEME_ATTRIBUTE}] .dsh-codex-global-model-cascader .semi-cascader-option-lists > .semi-cascader-option-list + .semi-cascader-option-list {
  width: max-content !important;
  min-width: 200px !important;
  max-width: calc(100vw - 32px);
  flex: 0 1 auto;
  overflow-x: hidden;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .dsh-codex-global-model-cascader .semi-cascader-option-lists > .semi-cascader-option-list + .semi-cascader-option-list .semi-cascader-option {
  min-width: max-content;
  white-space: nowrap;
  word-break: normal;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .dsh-codex-global-model-cascader .semi-cascader-option-lists {
  height: 160px;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .dsh-codex-global-model-cascader .semi-cascader-option-list {
  padding-top: 2px;
  padding-bottom: 2px;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .dsh-codex-global-model-cascader .semi-cascader-option-list > li {
  padding-top: 5px;
  padding-bottom: 5px;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .dsh-codex-global-model-cascader .semi-cascader-option {
  font-size: 13px;
  line-height: 18px;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-cascader-option {
  color: var(--dsw-alias-label-primary);
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-cascader-option:hover,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-cascader-option-active {
  background: var(--dsw-alias-interactive-bg-hover);
}

/* Keep portaled tooltips readable in both DSH themes. */
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
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  overflow-x: auto;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list > ul {
  width: 100% !important;
  min-width: max-content;
}

/* Keep the fnOS picker trigger on shared DSH semantic tokens. */
body[${SEMI_DSH_THEME_ATTRIBUTE}] .dsh-fnos-input-picker-trigger {
  background: var(--dsw-alias-bg-layer-1) !important;
  border-color: var(--dsw-alias-border-l2) !important;
  color: var(--dsw-alias-label-primary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .dsh-fnos-input-picker-trigger:hover {
  background: var(--dsw-alias-interactive-bg-hover) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .dsh-fnos-input-picker-trigger:active {
  background: var(--dsw-alias-interactive-bg-active) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .dsh-fnos-input-picker-trigger:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 1px;
}

/* Render fnOS references inside DSH's native input as link-like content. */
body[${SEMI_DSH_THEME_ATTRIBUTE}] [data-dsh-fnos-link] {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  color: var(--dsw-alias-state-business-primary) !important;
  cursor: text !important;
  text-decoration: underline !important;
  text-underline-offset: 2px;
  display: inline-flex !important;
  align-items: center !important;
  gap: 0 !important;
  width: max-content !important;
  min-width: max-content !important;
  max-width: none !important;
  flex: 0 0 auto !important;
  overflow: visible !important;
  pointer-events: auto !important;
  white-space: nowrap !important;
  text-overflow: clip !important;
  contain: none !important;
  inline-size: max-content !important;
  max-inline-size: none !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] [data-dsh-fnos-link] [class*='chipTriggerGlyph'] {
  display: inline-block !important;
  visibility: hidden !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] [data-dsh-fnos-link] > [class*='chipTrigger'] {
  flex: 0 0 auto !important;
  width: max-content !important;
  min-width: 16px !important;
  max-width: none !important;
  overflow: visible !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] [data-dsh-fnos-link] > span:last-child {
  display: inline-block !important;
  width: max-content !important;
  inline-size: max-content !important;
  flex: 0 0 auto !important;
  min-width: max-content !important;
  max-width: none !important;
  max-inline-size: none !important;
  overflow: visible !important;
  white-space: nowrap !important;
}

/* Keep checked states monochrome while preserving the host hover surface for unchecked controls. */
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list .semi-checkbox-unChecked:hover .semi-checkbox-inner-display {
  background: var(--dsw-alias-interactive-bg-hover) !important;
  border-color: var(--dsw-alias-border-l2) !important;
  box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l2) !important;
  color: var(--dsw-alias-label-primary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list .semi-checkbox-inner-checked .semi-checkbox-inner-display,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list .semi-checkbox-indeterminate .semi-checkbox-inner-display {
  background: #111 !important;
  border-color: #111 !important;
  box-shadow: inset 0 0 0 1px #111 !important;
  color: #fff !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list .semi-checkbox-inner-checked .semi-checkbox-inner-display svg,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list .semi-checkbox-indeterminate .semi-checkbox-inner-display svg {
  color: #fff !important;
  fill: currentColor;
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

/** Install a reversible, body-scoped Semi theme bridge for a DSH client. */
export function installSemiDshTheme(): () => void {
  if (typeof document === 'undefined' || document.body === null) return () => undefined

  const previousAttribute = document.body.getAttribute(SEMI_DSH_THEME_ATTRIBUTE)
  const style = document.createElement('style')
  style.dataset.dshSemi = 'theme'
  style.textContent = SEMI_DSH_THEME_CSS
  document.body.setAttribute(SEMI_DSH_THEME_ATTRIBUTE, '')
  document.head.append(style)

  return () => {
    style.remove()
    if (previousAttribute === null) document.body?.removeAttribute(SEMI_DSH_THEME_ATTRIBUTE)
    else document.body?.setAttribute(SEMI_DSH_THEME_ATTRIBUTE, previousAttribute)
  }
}
