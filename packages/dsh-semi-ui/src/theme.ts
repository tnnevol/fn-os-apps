/** Map Semi's design tokens to the DSH theme tokens used by the host. */

export const SEMI_DSH_THEME_ATTRIBUTE = 'data-dsh-semi-theme'
const DSH_DARK_THEME_ATTRIBUTE = 'data-ds-dark-theme'
const SEMI_THEME_MODE_ATTRIBUTE = 'theme-mode'

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
  --semi-color-info: var(--dsw-alias-state-business-primary);
  --semi-color-info-light-default: var(--dsw-alias-interactive-bg-hover);
  --semi-color-warning: var(--dsw-alias-state-warn-primary);
  --semi-color-warning-light-default: var(--dsw-alias-interactive-bg-hover);
  --semi-color-success: var(--dsw-alias-state-success-primary);
  --semi-color-success-light-default: var(--dsw-alias-interactive-bg-hover);
  --semi-color-danger-light-default: var(--dsw-alias-interactive-bg-hover);
  --semi-color-mode-minor-text: var(--dsw-alias-label-secondary);
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

/* Keep filled Semi buttons aligned with DSH: light surfaces in light mode and
   dark surfaces in dark mode, with the host border token on every button. */
body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-button.semi-button-solid:not(.semi-button-disabled) {
  background: var(--dsw-static-neutral-bluish-00) !important;
  border: 1px solid var(--dsw-alias-border-l2) !important;
  color: var(--dsw-static-neutral-bluish-1000) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-button.semi-button-solid:not(.semi-button-disabled):hover {
  background: var(--dsw-alias-interactive-bg-hover) !important;
  border-color: var(--dsw-alias-border-l2) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-button.semi-button-solid:not(.semi-button-disabled):active {
  background: var(--dsw-alias-interactive-bg-active) !important;
  border-color: var(--dsw-alias-border-l2) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-button.semi-button-solid:not(.semi-button-disabled) {
  background: var(--dsw-static-neutral-bluish-1000) !important;
  border: 1px solid var(--dsw-alias-border-l2) !important;
  color: var(--dsw-static-neutral-bluish-00) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-button.semi-button-solid:not(.semi-button-disabled):hover {
  background: var(--dsw-alias-interactive-bg-hover) !important;
  border-color: var(--dsw-alias-border-l2) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-button.semi-button-solid:not(.semi-button-disabled):active {
  background: var(--dsw-alias-interactive-bg-active) !important;
  border-color: var(--dsw-alias-border-l2) !important;
}

/* Keep primary and secondary actions visually distinct in both DSH themes. */
body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-button.semi-button-primary.semi-button-solid:not(.semi-button-disabled) {
  background: var(--dsw-static-neutral-bluish-1000) !important;
  background-color: var(--dsw-static-neutral-bluish-1000) !important;
  color: var(--dsw-static-neutral-bluish-00) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-button.semi-button-primary.semi-button-solid:not(.semi-button-disabled):hover {
  background: var(--dsw-static-neutral-bluish-750) !important;
  background-color: var(--dsw-static-neutral-bluish-750) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-button.semi-button-primary.semi-button-solid:not(.semi-button-disabled):is(:active, :focus-visible) {
  background: var(--dsw-static-neutral-bluish-750) !important;
  background-color: var(--dsw-static-neutral-bluish-750) !important;
  color: var(--dsw-static-neutral-bluish-00) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-button.semi-button-primary.semi-button-solid:not(.semi-button-disabled) {
  background: var(--dsw-static-neutral-bluish-00) !important;
  background-color: var(--dsw-static-neutral-bluish-00) !important;
  color: var(--dsw-static-neutral-bluish-1000) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-button.semi-button-primary.semi-button-solid:not(.semi-button-disabled):hover {
  background: var(--dsw-static-neutral-bluish-100) !important;
  background-color: var(--dsw-static-neutral-bluish-100) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-button.semi-button-primary.semi-button-solid:not(.semi-button-disabled):is(:active, :focus-visible) {
  background: var(--dsw-static-neutral-bluish-750) !important;
  background-color: var(--dsw-static-neutral-bluish-750) !important;
  color: var(--dsw-static-neutral-bluish-00) !important;
}

/* Preserve the semantic distinction between Semi button types. The shared
   surface rule above intentionally normalizes neutral buttons, but status
   buttons must continue to communicate warning and danger states. */
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-tertiary.semi-button-solid:not(.semi-button-disabled) {
  background: var(--dsw-alias-button-tool-bar-fill) !important;
  background-color: var(--dsw-alias-button-tool-bar-fill) !important;
  color: var(--dsw-alias-label-primary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-warning.semi-button-solid:not(.semi-button-disabled) {
  background: var(--dsw-alias-state-warn-primary) !important;
  background-color: var(--dsw-alias-state-warn-primary) !important;
  border-color: var(--dsw-alias-state-warn-primary) !important;
  color: var(--dsw-static-neutral-bluish-00) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-warning.semi-button-solid:not(.semi-button-disabled):hover {
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary), var(--dsw-static-neutral-bluish-1000) 12%) !important;
  background-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary), var(--dsw-static-neutral-bluish-1000) 12%) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-danger.semi-button-solid:not(.semi-button-disabled) {
  background: var(--dsw-alias-state-error-primary) !important;
  background-color: var(--dsw-alias-state-error-primary) !important;
  border-color: var(--dsw-alias-state-error-primary) !important;
  color: var(--dsw-static-neutral-bluish-00) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-danger.semi-button-solid:not(.semi-button-disabled):hover {
  background: var(--dsw-alias-state-error-secondary) !important;
  background-color: var(--dsw-alias-state-error-secondary) !important;
}

/* Keep Semi's light and outline themes distinct from solid actions. */
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-primary.semi-button-light:not(.semi-button-disabled),
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-secondary.semi-button-light:not(.semi-button-disabled),
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-tertiary.semi-button-light:not(.semi-button-disabled) {
  background: var(--dsw-alias-interactive-bg-hover) !important;
  background-color: var(--dsw-alias-interactive-bg-hover) !important;
  border-color: transparent !important;
  color: var(--dsw-alias-label-primary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-primary.semi-button-light:not(.semi-button-disabled):hover,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-secondary.semi-button-light:not(.semi-button-disabled):hover,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-tertiary.semi-button-light:not(.semi-button-disabled):hover {
  background: var(--dsw-alias-interactive-bg-active) !important;
  background-color: var(--dsw-alias-interactive-bg-active) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-primary.semi-button-borderless:not(.semi-button-disabled),
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-secondary.semi-button-borderless:not(.semi-button-disabled),
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-tertiary.semi-button-borderless:not(.semi-button-disabled) {
  color: var(--dsw-alias-label-primary) !important;
}

/* Keep the fnOS refresh action transparent while using the same DSH
   interaction color on hover. Its size comes from Semi's size prop. */
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.dsh-fnos-web-refresh,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.dsh-fnos-web-refresh:not(.semi-button-borderless):not(.semi-button-disabled) {
  background: transparent !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.dsh-fnos-web-refresh:not(.semi-button-disabled):hover,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.dsh-fnos-web-refresh:not(.semi-button-borderless):not(.semi-button-disabled):hover {
  background: var(--dsw-alias-interactive-bg-hover) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-dropdown-wrapper {
  background: var(--dsw-alias-bg-layer-3);
  border: 1px solid var(--dsw-alias-border-l2);
  box-shadow: var(--dsw-shadow-lv3);
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-progress-track {
  background-color: var(--dsw-alias-interactive-bg-hover) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-progress-horizontal .semi-progress-track-inner,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-progress-vertical .semi-progress-track-inner,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-progress-circle-ring-inner {
  background-color: var(--dsw-alias-brand-primary) !important;
  stroke: var(--dsw-alias-brand-primary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-progress-line-text,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-progress-circle-text,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-spin-wrapper {
  color: var(--dsw-alias-label-secondary);
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-toast-content {
  background-color: var(--dsw-alias-bg-layer-3);
  border-color: var(--dsw-alias-border-l2);
  box-shadow: var(--dsw-shadow-lv3);
  color: var(--dsw-alias-label-primary);
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-toast-light.semi-toast-info .semi-toast-content,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-toast-light.semi-toast-success .semi-toast-content,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-toast-light.semi-toast-warning .semi-toast-content,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-toast-light.semi-toast-error .semi-toast-content {
  background-color: var(--dsw-alias-bg-layer-3);
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

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-cascader-option {
  color: var(--dsw-alias-label-primary);
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-cascader-option:hover,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-cascader-option-active {
  background: var(--dsw-alias-interactive-bg-hover);
}

/* Keep portaled tooltips readable in both DSH themes. */
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tooltip-wrapper {
  background-color: var(--dsw-alias-tooltip-bg);
  color: var(--dsw-static-neutral-bluish-00);
  box-shadow: var(--dsw-shadow-lv3);
  pointer-events: none;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tooltip-wrapper .semi-tooltip-icon-arrow {
  color: var(--dsw-alias-tooltip-bg);
}

/* Keep the fnOS picker trigger on shared DSH semantic tokens. */
body[${SEMI_DSH_THEME_ATTRIBUTE}] .dsh-fnos-input-picker-trigger {
  background: var(--dsw-alias-bg-layer-1) !important;
  border: none !important;
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

/* Use one monochrome checkbox treatment for standalone Checkbox, TreeSelect,
   Tree and Cascader. This prevents each consumer from drifting visually. */
body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-checkbox:not(.semi-checkbox-checked):not(.semi-checkbox-indeterminate):hover .semi-checkbox-inner-display,
body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-checkbox-unChecked:hover .semi-checkbox-inner-display {
  background: var(--dsw-alias-interactive-bg-hover) !important;
  border-color: var(--dsw-static-neutral-bluish-1000) !important;
  box-shadow: inset 0 0 0 1px var(--dsw-static-neutral-bluish-1000) !important;
  color: var(--dsw-static-neutral-bluish-1000) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-checkbox:not(.semi-checkbox-checked):not(.semi-checkbox-indeterminate):hover .semi-checkbox-inner-display,
body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-checkbox-unChecked:hover .semi-checkbox-inner-display {
  background: var(--dsw-alias-interactive-bg-hover) !important;
  border-color: var(--dsw-static-neutral-bluish-00) !important;
  box-shadow: inset 0 0 0 1px var(--dsw-static-neutral-bluish-00) !important;
  color: var(--dsw-static-neutral-bluish-00) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-checkbox.semi-checkbox-checked .semi-checkbox-inner-display,
body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-checkbox.semi-checkbox-indeterminate .semi-checkbox-inner-display,
body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-cascader-option-label-checkbox.semi-checkbox-checked .semi-checkbox-inner-display,
body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-cascader-option-label-checkbox.semi-checkbox-indeterminate .semi-checkbox-inner-display,
body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-checkbox .semi-checkbox-inner-checked .semi-checkbox-inner-display,
body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-checkbox .semi-checkbox-indeterminate .semi-checkbox-inner-display {
  background: var(--dsw-static-neutral-bluish-00) !important;
  border-color: var(--dsw-static-neutral-bluish-1000) !important;
  box-shadow: inset 0 0 0 1px var(--dsw-static-neutral-bluish-1000) !important;
  color: var(--dsw-static-neutral-bluish-1000) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-checkbox.semi-checkbox-checked .semi-checkbox-inner-display svg,
body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-checkbox.semi-checkbox-indeterminate .semi-checkbox-inner-display svg,
body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-cascader-option-label-checkbox.semi-checkbox-checked .semi-checkbox-inner-display svg,
body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-cascader-option-label-checkbox.semi-checkbox-indeterminate .semi-checkbox-inner-display svg,
body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-checkbox .semi-checkbox-inner-checked .semi-checkbox-inner-display svg,
body[${SEMI_DSH_THEME_ATTRIBUTE}]:not([${DSH_DARK_THEME_ATTRIBUTE}]) .semi-checkbox .semi-checkbox-indeterminate .semi-checkbox-inner-display svg {
  color: var(--dsw-static-neutral-bluish-1000) !important;
  fill: currentColor;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-checkbox.semi-checkbox-checked .semi-checkbox-inner-display,
body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-checkbox.semi-checkbox-indeterminate .semi-checkbox-inner-display,
body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-cascader-option-label-checkbox.semi-checkbox-checked .semi-checkbox-inner-display,
body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-cascader-option-label-checkbox.semi-checkbox-indeterminate .semi-checkbox-inner-display,
body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-checkbox .semi-checkbox-inner-checked .semi-checkbox-inner-display,
body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-checkbox .semi-checkbox-indeterminate .semi-checkbox-inner-display {
  background: var(--dsw-static-neutral-bluish-1000) !important;
  border-color: var(--dsw-static-neutral-bluish-00) !important;
  box-shadow: inset 0 0 0 1px var(--dsw-static-neutral-bluish-00) !important;
  color: var(--dsw-static-neutral-bluish-00) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-checkbox.semi-checkbox-checked .semi-checkbox-inner-display svg,
body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-checkbox.semi-checkbox-indeterminate .semi-checkbox-inner-display svg,
body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-cascader-option-label-checkbox.semi-checkbox-checked .semi-checkbox-inner-display svg,
body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-cascader-option-label-checkbox.semi-checkbox-indeterminate .semi-checkbox-inner-display svg,
body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-checkbox .semi-checkbox-inner-checked .semi-checkbox-inner-display svg,
body[${SEMI_DSH_THEME_ATTRIBUTE}][${DSH_DARK_THEME_ATTRIBUTE}] .semi-checkbox .semi-checkbox-indeterminate .semi-checkbox-inner-display svg {
  color: var(--dsw-static-neutral-bluish-00) !important;
  fill: currentColor;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list .semi-tree-option-selected .semi-tree-option-label,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list .semi-tree-option-selected .semi-tree-option-label:hover,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list .semi-tree-option-selected .semi-tree-option-label:active {
  background-color: var(--dsw-alias-interactive-bg-hover) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list .semi-tree-option:hover .semi-tree-option-label {
  background-color: var(--dsw-alias-interactive-bg-hover) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list .semi-tree-option-selected .semi-tree-option-label-text {
  color: var(--dsw-alias-label-primary) !important;
}

/* Semi maps disabled Tree labels to its dimmed token. In DSH light mode that
   token is intended for secondary metadata and is too close to the surface;
   use the readable secondary label token for disabled labels in both themes. */
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list .semi-tree-option-disabled .semi-tree-option-label,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-tree-option-list .semi-tree-option-disabled .semi-tree-option-label-text {
  color: var(--dsw-alias-label-secondary) !important;
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

/* Match Semi's theme matrix: the type communicates meaning, while the theme
   controls whether the action is filled, outlined, or text-only. The rules
   above keep DSH's primary action contrast; these rules prevent warning and
   danger buttons from losing their semantic color in light/outline modes. */
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-warning.semi-button-light:not(.semi-button-disabled),
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-danger.semi-button-light:not(.semi-button-disabled) {
  color: var(--dsw-alias-label-primary) !important;
  border-color: transparent !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-warning.semi-button-light:not(.semi-button-disabled) {
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, var(--dsw-alias-bg-layer-3)) !important;
  background-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, var(--dsw-alias-bg-layer-3)) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-danger.semi-button-light:not(.semi-button-disabled) {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 16%, var(--dsw-alias-bg-layer-3)) !important;
  background-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 16%, var(--dsw-alias-bg-layer-3)) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-warning.semi-button-outline:not(.semi-button-disabled),
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-danger.semi-button-outline:not(.semi-button-disabled) {
  background: transparent !important;
  background-color: transparent !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-warning.semi-button-outline:not(.semi-button-disabled) {
  border-color: var(--dsw-alias-state-warn-primary) !important;
  color: var(--dsw-alias-state-warn-primary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-danger.semi-button-outline:not(.semi-button-disabled) {
  border-color: var(--dsw-alias-state-error-primary) !important;
  color: var(--dsw-alias-state-error-primary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-warning.semi-button-borderless:not(.semi-button-disabled) {
  color: var(--dsw-alias-state-warn-primary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-danger.semi-button-borderless:not(.semi-button-disabled) {
  color: var(--dsw-alias-state-error-primary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-primary.semi-button-outline:not(.semi-button-disabled),
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-secondary.semi-button-outline:not(.semi-button-disabled),
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-tertiary.semi-button-outline:not(.semi-button-disabled) {
  background: transparent !important;
  background-color: transparent !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-primary.semi-button-outline:not(.semi-button-disabled) {
  border-color: var(--dsw-alias-label-primary) !important;
  color: var(--dsw-alias-label-primary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-secondary.semi-button-outline:not(.semi-button-disabled) {
  border-color: var(--dsw-alias-border-l2) !important;
  color: var(--dsw-alias-label-primary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-tertiary.semi-button-outline:not(.semi-button-disabled) {
  border-color: var(--dsw-alias-button-tool-bar-fill) !important;
  color: var(--dsw-alias-label-primary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-tertiary.semi-button-solid:not(.semi-button-disabled) {
  background: var(--dsw-alias-button-tool-bar-fill) !important;
  background-color: var(--dsw-alias-button-tool-bar-fill) !important;
  color: var(--dsw-alias-label-primary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-warning:not(.semi-button-disabled):focus-visible {
  outline: 2px solid var(--dsw-alias-state-warn-primary);
  outline-offset: 2px;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-button.semi-button-danger:not(.semi-button-disabled):focus-visible {
  outline: 2px solid var(--dsw-alias-state-error-primary);
  outline-offset: 2px;
}

/* Modal surfaces are portaled to body, so scope them to the same bridge used
   by dropdowns and tooltips. This keeps the mask, content, close affordance,
   and confirm variants readable when DSH switches theme. */
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-mask {
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 72%, transparent) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-content,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-inner {
  background: var(--dsw-alias-bg-layer-3) !important;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--semi-border-radius-large);
  box-shadow: var(--dsw-shadow-lv3);
  color: var(--dsw-alias-label-primary);
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-header,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-body,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-footer {
  color: var(--dsw-alias-label-primary);
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-header,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-footer {
  border-color: var(--dsw-alias-border-l2) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-close {
  color: var(--dsw-alias-label-secondary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-close:hover {
  background: var(--dsw-alias-interactive-bg-hover) !important;
  color: var(--dsw-alias-label-primary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-info-icon,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-confirm-info-icon {
  color: var(--dsw-alias-state-business-primary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-success-icon,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-confirm-success-icon {
  color: var(--dsw-alias-state-success-primary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-warning-icon,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-confirm-warning-icon {
  color: var(--dsw-alias-state-warn-primary) !important;
}

body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-error-icon,
body[${SEMI_DSH_THEME_ATTRIBUTE}] .semi-modal-confirm-error-icon {
  color: var(--dsw-alias-state-error-primary) !important;
}
`

/** Install a reversible, body-scoped Semi theme bridge for a DSH client. */
export function installSemiDshTheme(): () => void {
  if (typeof document === 'undefined' || document.body === null) return () => undefined

  const body = document.body
  const refCountAttribute = 'data-dsh-semi-theme-refcount'
  const previousRefCount = Number(body.getAttribute(refCountAttribute) ?? '0') || 0
  const previousAttribute = previousRefCount === 0 ? body.getAttribute(SEMI_DSH_THEME_ATTRIBUTE) : null
  const previousThemeMode = previousRefCount === 0 ? body.getAttribute(SEMI_THEME_MODE_ATTRIBUTE) : null
  const style = document.head.querySelector<HTMLStyleElement>('style[data-dsh-semi="theme"]') ?? document.createElement('style')
  const ownsStyle = style.parentNode === null
  if (ownsStyle) {
    style.dataset.dshSemi = 'theme'
    style.textContent = SEMI_DSH_THEME_CSS
    document.head.append(style)
  }

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
    if (ownsStyle) style.remove()
    if (previousAttribute === null) body.removeAttribute(SEMI_DSH_THEME_ATTRIBUTE)
    else body.setAttribute(SEMI_DSH_THEME_ATTRIBUTE, previousAttribute)
    if (previousThemeMode === null) body.removeAttribute(SEMI_THEME_MODE_ATTRIBUTE)
    else body.setAttribute(SEMI_THEME_MODE_ATTRIBUTE, previousThemeMode)
  }
}
