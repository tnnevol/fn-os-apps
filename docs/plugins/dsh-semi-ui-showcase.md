---
title: DSH Semi UI 总览
description: 在 DSH 中集中检查共享 Semi Design 组件及主题状态。
---

# DSH Semi UI 总览

`@tnnevol/dsh-semi-ui-showcase` 是 `@tnnevol/dsh-semi-ui` 的组件总览插件。它只使用共享包公开导出的组件，不维护第二套主题样式。

## 使用方式

安装插件后，在任意会话的头部右侧点击 `Semi UI` 文本按钮。页面会进入 `#/plugins/semi-ui`，可通过浏览器前进、后退或页面左上角返回按钮回到原会话。

总览包含按钮、图标、Tooltip、Dropdown、Cascader、Tree、TreeSelect、Modal、Popover、Progress、Spin 和 Toast，用于检查浅色、深色及系统主题下的组件状态和 Portal 浮层。

Dropdown 页面与 Semi 官方文档保持同一组核心示例：基本菜单、嵌套菜单、弹出位置、`hover`/`focus`/`click`/`custom`/`contextMenu` 触发、菜单事件和 JSON `menu` 配置，并展示 `Title`、`Item`、`Divider`、图标、类型、禁用和激活状态。

## 开发检查

```bash
pnpm --filter @tnnevol/dsh-semi-ui run build
pnpm --filter @tnnevol/dsh-semi-ui-showcase run check
```

新增共享组件时，应先在 `packages/dsh-semi-ui` 中封装并导出，再从总览插件的公开入口使用。
