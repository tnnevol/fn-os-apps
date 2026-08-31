---
title: DSH Semi UI 组件总览
description: 使用 VitePress 预览 DSH 主题下的 Semi Design 共享组件及交互状态。
---

<script setup lang="ts">
import SemiUiPreview from '../components/SemiUiPreview.vue'
</script>

# DSH Semi UI 组件总览

`@tnnevol/dsh-semi-ui` 是 DSH 插件共用的 Semi Design 组件层。下面的页面由 VitePress 构建，交互状态与插件中使用的组件保持同一套 DSH 主题语义。


<SemiUiPreview />

## 对应共享包

页面展示的组件对应 [`@tnnevol/dsh-semi-ui`](/plugins/dsh-semi-ui) 的公开导出。运行时交互总览仍可从 DSH 设置中的“DSH Semi UI → 打开总览”进入 [`#/plugins/semi-ui`](https://deepseek-harness.github.io/deepseek-harness/)。

组件分组和演示状态参考 Semi 官方文档；当前已接入 [Button](https://semi.design/zh-CN/basic/button)、[Icon](https://semi.design/zh-CN/basic/icon)、[Cascader](https://semi.design/zh-CN/input/cascader)、[TreeSelect](https://semi.design/zh-CN/input/treeselect)、[Tree](https://semi.design/zh-CN/navigation/tree)、[Modal](https://semi.design/zh-CN/show/modal)、[Progress](https://semi.design/zh-CN/feedback/progress)、[Spin](https://semi.design/zh-CN/feedback/spin) 与 [Toast](https://semi.design/zh-CN/feedback/toast)。官方仓库中的 `content/**` 文档和组件示例作为展示状态与 API 的参考，插件运行时继续使用共享包的按需导出。

```ts
import { DshButton, DshCascader, DshProgress, DshSpin, DshToast, DshTree, installSemiDshTheme } from '@tnnevol/dsh-semi-ui'
```

<style>
.semi-preview {
  --semi-surface: var(--vp-c-bg-elv);
  --semi-surface-soft: var(--vp-c-bg-soft);
  --semi-border: var(--vp-c-border);
  --semi-text: var(--vp-c-text-1);
  --semi-muted: var(--vp-c-text-2);
  --semi-primary: #111827;
  --semi-primary-hover: #374151;
  --semi-on-primary: #fff;
  --semi-selection: rgba(37, 99, 235, 0.1);
  position: relative;
  margin: 28px 0 40px;
  overflow: hidden;
  border: 1px solid var(--semi-border);
  border-radius: 18px;
  background: var(--semi-surface);
  color: var(--semi-text);
  box-shadow: var(--docs-shadow);
}

.semi-preview.is-dark {
  --semi-surface: #101827;
  --semi-surface-soft: #172238;
  --semi-border: rgba(148, 163, 184, .25);
  --semi-text: #f8fafc;
  --semi-muted: #a9b5c8;
  --semi-primary: #f8fafc;
  --semi-primary-hover: #cbd5e1;
  --semi-on-primary: #111827;
  --semi-selection: rgba(96, 165, 250, .17);
}

.semi-preview button { font: inherit; cursor: pointer; }
.semi-preview__hero { display: flex; justify-content: space-between; gap: 20px; padding: 30px 32px 26px; border-bottom: 1px solid var(--semi-border); background: linear-gradient(120deg, var(--semi-selection), transparent 55%); }
.semi-preview__hero h2, .semi-preview__section h3 { margin: 5px 0 0; color: var(--semi-text); }
.semi-preview__hero h2 { font-size: 28px; letter-spacing: -.03em; }
.semi-preview__hero p, .semi-preview__section > p, .semi-preview__section-heading p { margin: 8px 0 0; color: var(--semi-muted); font-size: 14px; }
.semi-preview__eyebrow { color: var(--vp-c-brand-1); font-size: 11px; font-weight: 700; letter-spacing: .12em; }
.semi-doc-breadcrumb { display: block; margin-bottom: 12px; color: var(--semi-muted); font-size: 12px; }.semi-doc-breadcrumb span { padding: 0 5px; color: var(--vp-c-brand-1); }.semi-preview__nav-title--group { margin-top: 22px; }.semi-doc-example-note { margin-top: 24px; color: var(--semi-text); font-size: 13px; font-weight: 650; }.semi-doc-code { margin: 10px 0 0; padding: 14px 16px; overflow-x: auto; border: 1px solid var(--semi-border); border-radius: 8px; background: color-mix(in srgb, var(--semi-surface-soft) 78%, #061629); color: var(--semi-muted); font: 12px/1.65 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre; }.semi-preview__outline { padding: 30px 14px 30px 18px; border-left: 1px solid var(--semi-border); color: var(--semi-muted); font-size: 12px; }.semi-preview__outline span { display: block; margin-bottom: 13px; }.semi-preview__outline span:first-child { color: var(--vp-c-brand-1); font-weight: 650; }
.semi-preview__theme { display: flex; align-self: start; padding: 3px; border: 1px solid var(--semi-border); border-radius: 9px; background: var(--semi-surface-soft); }
.semi-preview__theme button { padding: 6px 10px; border: 0; border-radius: 7px; background: transparent; color: var(--semi-muted); font-size: 12px; }
.semi-preview__theme button.active { background: var(--semi-primary); color: var(--semi-on-primary); }
.semi-preview__layout { display: grid; grid-template-columns: 190px minmax(0, 1fr) 132px; min-height: 570px; }
.semi-preview__nav { padding: 22px 12px; border-right: 1px solid var(--semi-border); background: var(--semi-surface-soft); }
.semi-preview__nav-title, .semi-preview__label { display: block; color: var(--semi-muted); font-size: 12px; font-weight: 650; }
.semi-preview__nav-title { padding: 0 10px 10px; text-transform: uppercase; letter-spacing: .1em; }
.semi-preview__nav button { display: flex; align-items: center; width: 100%; gap: 8px; margin: 3px 0; padding: 9px 10px; border: 0; border-radius: 8px; background: transparent; color: var(--semi-muted); text-align: left; font-size: 13px; }
.semi-preview__nav button:hover, .semi-preview__nav button.active { background: var(--semi-selection); color: var(--vp-c-brand-1); }
.semi-preview__nav-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: .65; }
.semi-preview__content { min-width: 0; padding: 30px; }
.semi-preview__section-heading { display: flex; justify-content: space-between; }
.semi-preview__section h3 { font-size: 22px; }
.semi-preview__demo-group { margin-top: 28px; }
.semi-preview__row { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; margin-top: 10px; }
.semi-button, .semi-icon-button, .semi-select, .semi-button-group button { box-sizing: border-box; border: 1px solid transparent; border-radius: 8px; transition: background-color .18s ease, border-color .18s ease, transform .18s ease, color .18s ease; }
.semi-button { min-height: 36px; padding: 0 14px; color: var(--semi-text); font-size: 13px; font-weight: 600; }
.semi-button:hover, .semi-icon-button:hover, .semi-select:hover { transform: translateY(-1px); }
.semi-button:active, .semi-icon-button:active { transform: scale(.97); }
.semi-button.is-solid.is-primary, .semi-icon-button.is-solid.is-primary { background: var(--semi-primary); color: var(--semi-on-primary); }
.semi-button.is-solid.is-secondary, .semi-button.is-solid.is-tertiary, .semi-button.is-solid.is-warning, .semi-button.is-solid.is-danger { background: var(--semi-surface-soft); color: var(--semi-text); border-color: var(--semi-border); }
.semi-button.is-solid.is-warning { color: #b45309; }.semi-button.is-solid.is-danger { color: #dc2626; }
.semi-button.is-light { background: var(--semi-surface-soft); color: var(--semi-text); border-color: var(--semi-border); }
.semi-button.is-outline { background: transparent; color: var(--semi-text); border-color: var(--semi-border); }
.semi-button.is-borderless { background: transparent; color: var(--semi-text); }
.semi-button.is-borderless:hover, .semi-button.is-light:hover, .semi-button.is-outline:hover, .semi-button.is-solid:not(.is-primary):hover, .semi-select:hover { background: var(--semi-selection); }
.semi-button.is-size-large { min-height: 44px; padding: 0 18px; font-size: 14px; }.semi-button.is-size-small { min-height: 28px; padding: 0 10px; font-size: 12px; }
.semi-button--wide { min-width: 150px; }.semi-button:disabled, .semi-icon-button:disabled, .semi-select:disabled { cursor: not-allowed; opacity: .45; transform: none; }
.semi-icon, .semi-folder { margin-right: 5px; }.semi-icon-button { width: 36px; height: 36px; padding: 0; font-size: 16px; }.semi-button-group { display: inline-flex; }.semi-button-group button { min-height: 36px; padding: 0 12px; border-color: var(--semi-border); background: var(--semi-primary); color: var(--semi-on-primary); font-size: 13px; }.semi-button-group button + button { border-left-color: color-mix(in srgb, var(--semi-on-primary) 25%, transparent); border-top-left-radius: 0; border-bottom-left-radius: 0; }.semi-button-group button:first-child { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.semi-spinner { display: inline-block; width: 12px; height: 12px; margin-right: 6px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; vertical-align: -2px; animation: semi-spin .7s linear infinite; }
.semi-tooltip-demo, .semi-dropdown-demo, .semi-select-demo { position: relative; display: inline-flex; }.semi-tooltip { position: absolute; z-index: 3; bottom: calc(100% + 8px); left: 50%; padding: 6px 9px; border-radius: 6px; background: #1f2937; color: #fff; font-size: 12px; opacity: 0; pointer-events: none; transform: translate(-50%, 3px); transition: opacity .18s ease, transform .18s ease; white-space: nowrap; }.semi-tooltip-demo:hover .semi-tooltip { opacity: 1; transform: translate(-50%, 0); }.semi-dropdown-menu, .semi-selection-menu { position: absolute; z-index: 4; top: calc(100% + 7px); left: 0; min-width: 150px; padding: 5px; border: 1px solid var(--semi-border); border-radius: 9px; background: var(--semi-surface); box-shadow: var(--docs-shadow); }.semi-dropdown-menu button, .semi-selection-menu button { display: flex; justify-content: space-between; width: 100%; padding: 8px 9px; border: 0; border-radius: 6px; background: transparent; color: var(--semi-text); text-align: left; font-size: 12px; }.semi-dropdown-menu button:hover, .semi-selection-menu button:hover { background: var(--semi-selection); }
.semi-select { display: inline-flex; align-items: center; justify-content: space-between; min-width: 180px; min-height: 36px; padding: 0 11px; background: var(--semi-surface); color: var(--semi-text); border-color: var(--semi-border); font-size: 13px; text-align: left; }.semi-select.is-error { border-color: #ef4444; }.semi-select.is-success { border-color: #22c55e; }.semi-tag { margin-left: 4px; padding: 3px 5px; border-radius: 4px; background: var(--semi-selection); font-size: 11px; }.semi-selection-menu { min-width: 190px; }.semi-selection-menu button { gap: 8px; }
.semi-tree-demo { max-width: 480px; margin-top: 12px; padding: 10px; border: 1px solid var(--semi-border); border-radius: 10px; background: var(--semi-surface-soft); }.semi-tree-row { display: flex; align-items: center; min-height: 34px; gap: 7px; padding: 3px 8px; border-radius: 6px; font-size: 13px; }.semi-tree-row:hover { background: var(--semi-selection); }.semi-tree-row--root { background: var(--semi-selection); }.semi-tree-indent { width: 12px; color: var(--semi-muted); }.semi-checkbox { display: inline-grid; place-items: center; width: 17px; height: 17px; padding: 0; border: 1px solid var(--semi-text); border-radius: 3px; background: transparent; color: var(--semi-text); font-size: 12px; }.semi-checkbox.checked, .semi-checkbox.is-indeterminate { background: var(--semi-primary); color: var(--semi-on-primary); }.semi-icon-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; margin-top: 10px; }.semi-icon-grid span { display: flex; align-items: center; gap: 7px; padding: 9px; border: 1px solid var(--semi-border); border-radius: 8px; color: var(--semi-muted); font-size: 12px; }.semi-icon-grid b { color: var(--semi-text); font-size: 17px; }
.semi-feedback-progress { height: 8px; margin: 14px 0; overflow: hidden; border-radius: 999px; background: var(--semi-border); }.semi-feedback-progress.is-large { height: 12px; }.semi-feedback-progress span { display: block; height: 100%; border-radius: inherit; background: var(--vp-c-brand-1); }.semi-feedback-progress span.is-success { background: #22a06b; }.semi-feedback-progress span.is-warning { background: #d97706; }.semi-spinner--large { width: 18px; height: 18px; }.semi-feedback-toast { display: inline-flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--semi-border); border-radius: 8px; background: var(--semi-surface); color: var(--semi-text); box-shadow: var(--docs-shadow); }.semi-feedback-toast button { border: 0; background: transparent; color: var(--semi-muted); font-size: 16px; }
.semi-modal-mask { position: fixed; z-index: 10; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(15, 23, 42, .48); }.semi-modal { width: min(420px, 100%); padding: 20px; border: 1px solid var(--semi-border); border-radius: 14px; background: var(--semi-surface); box-shadow: var(--docs-shadow); }.semi-modal__heading, .semi-modal__actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; }.semi-modal__heading button { border: 0; background: transparent; color: var(--semi-muted); font-size: 20px; }.semi-modal p { color: var(--semi-muted); font-size: 13px; }.semi-modal__actions { justify-content: flex-end; margin-top: 20px; }
@keyframes semi-spin { to { transform: rotate(360deg); } }
@media (max-width: 900px) { .semi-preview__layout { grid-template-columns: 170px minmax(0, 1fr); }.semi-preview__outline { display: none; } }
@media (max-width: 720px) { .semi-preview__hero { align-items: flex-start; flex-direction: column; padding: 24px 20px; }.semi-preview__layout { grid-template-columns: 1fr; }.semi-preview__nav { display: flex; gap: 4px; overflow-x: auto; padding: 10px; border-right: 0; border-bottom: 1px solid var(--semi-border); }.semi-preview__nav-title { display: none; }.semi-preview__nav button { width: auto; white-space: nowrap; }.semi-preview__content { padding: 22px 18px; }.semi-icon-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
