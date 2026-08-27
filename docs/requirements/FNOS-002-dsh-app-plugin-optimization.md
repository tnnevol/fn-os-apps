---
id: FNOS-002
title: FNOS-002 DSH 应用与插件优化
description: 记录 Codex 状态、NAS 引用、共享 UI、FPK 网关和 fnOS 应用跳转需求。
status: planned
owner: tnnevol
targetVersion: 5.1.x
lastVerified: 2026-08-27
---

# FNOS-002 DSH 应用与插件优化

| 项目 | 内容 |
| --- | --- |
| 需求编号 | FNOS-002 |
| 提出日期 | 2026-08-24 |
| 需求状态 | <Badge type="info" text="规划中" /> |
| 关联计划 | [详细计划索引](/plans/index)（暂未进入具体计划） |

## 需求背景与目标

DSH 在 fnOS 中运行后，还有几处使用体验需要调整。Codex 未登录时会显示状态，NAS 引用可能改动输入框中的空格，FPK 网关仍由 `node:http` 直接实现。项目也缺少共享 Semi UI 组件的集中预览入口。

这些内容统一在 FNOS-002 中记录。涉及 fnOS 页面跳转的能力先调研，确认 JS SDK 支持后再安排开发。

## 需求目标

- Codex 只在确认登录后显示登录状态。
- NAS 文件和目录引用不改动用户已有文本。
- 新增 DSH Semi UI 总览插件。
- 使用成熟代理工具替换 FPK 网关中的直接 `node:http` 代理。
- 调研 JS SDK 能否打开其他应用或应用中心的指定详情页。

## 涉及范围

| 模块 | 目录或入口 | 职责 |
| --- | --- | --- |
| Codex 插件 | `plugins/dsh-codex-auth-plugin` | 控制登录状态显示 |
| fnOS 插件 | `plugins/dsh-fnos-plugin` | 处理 NAS 引用和 JS SDK 调研 |
| 共享 UI | `packages/dsh-semi-ui`、待新增总览插件 | 展示共享组件和主题效果 |
| FPK 网关 | `apps/fn-deepseek-harness/app/gateway-proxy.mjs` | 代理 DSH 的 HTTP 和流式请求 |
| 项目文档 | `docs/` | 记录需求、调研结论和后续计划 |

## 功能列表

| 编号 | 优先级 | 功能 | 用户行为 | 状态 |
| --- | --- | --- | --- | --- |
| FNOS-002-01 | P1 | Codex 登录状态 | 未登录时不显示成功状态，登录和退出后及时更新 | <Badge type="info" text="规划中" /> |
| FNOS-002-02 | P1 | NAS 引用空格 | 插入文件或目录引用时保留原文，只在需要时补一个空格 | <Badge type="info" text="规划中" /> |
| FNOS-002-03 | P1 | Semi UI 总览插件 | 在独立 DSH 插件中查看共享组件及主题效果 | <Badge type="info" text="规划中" /> |
| FNOS-002-04 | P1 | FPK 网关代理 | 用成熟代理工具替换直接 `node:http` 实现 | <Badge type="info" text="规划中" /> |
| FNOS-002-05 | P2 | fnOS 应用跳转调研 | 确认能否打开其他应用或应用中心的指定详情页 | <Badge type="warning" text="需调研" /> |

## 交互和行为约束

- Codex 未登录、加载中或鉴权失败时隐藏成功状态，登录入口保留。
- NAS 引用只处理插入位置。前面已有空白时不补空格，没有空白时补一个空格。
- Semi UI 总览插件使用 `@tnnevol/dsh-semi-ui` 的公开组件，并覆盖浅色和深色主题。
- 网关替换后保留现有 URL、fnOS 鉴权、插件请求和 SSE 行为，代理目标仍限制在 DSH 回环地址。
- 应用跳转调研以 [fnOS 页面路由文档](https://developer.fnnas.com/api/page/routing) 和真实 NAS 表现为准，不使用未公开的内部路由。

## 不在本次范围内

- 不修改 DSH 官方源码和 Codex OAuth 流程。
- 不调整 Codex 模型、用量和图片能力。
- 不改动 NAS 授权、路径转换和权限校验规则。
- 不在需求阶段指定代理工具，也不承诺 JS SDK 已支持跨应用跳转。

## 验收条件与完成状态

### P1 验收条件

- Codex 登录状态在登录、退出和异常场景下显示正确。
- NAS 文件和目录引用保留原文空格，不产生重复空格。
- Semi UI 总览插件可正常安装和卸载，组件在浅色、深色主题下显示正常。
- 新网关兼容 GET、POST、插件 API、静态资源和 SSE，并在真实 fnOS 入口完成验证。

### P2 调研条件

- 查清 JS SDK 是否支持打开其他应用和应用中心详情页，并记录系统版本、宿主和权限限制。
- 实机验证后再决定是否进入详细计划。

### 状态看板

| 阶段 | 状态 | 当前范围 | 下一步 |
| --- | --- | --- | --- |
| P1 应用与插件优化 | <Badge type="info" text="规划中" /> | Codex 状态、NAS 引用、UI 总览和网关代理 | 确认排期后编写详细计划 |
| P2 fnOS 应用跳转 | <Badge type="warning" text="需调研" /> | JS SDK 和应用中心跳转能力 | 在真实 fnOS 环境验证 |

## 变更记录

| 日期 | 变更 | 说明 |
| --- | --- | --- |
| 2026-08-24 | 新增 FNOS-002 | 记录 Codex 登录状态需求 |
| 2026-08-25 | 合并 NAS 引用需求 | 将原 FNOS-003 合并到本需求 |
| 2026-08-27 | 扩展需求范围 | 增加 UI 总览、网关代理和应用跳转调研 |
| 2026-08-27 | 精简需求文档 | 合并重复功能和验收说明，技术细节留到详细计划 |
