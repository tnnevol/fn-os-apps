---
id: FNOS-001
title: FNOS-001 DSH 飞牛 NAS 适配
description: DeepSeek Harness 在飞牛 fnOS 中的应用、插件和 NAS 能力适配需求。
status: completed
owner: tnnevol
targetVersion: 5.1.x
lastVerified: 2026-08-24
---

# FNOS-001 DSH 飞牛 NAS 适配

| 项目 | 内容 |
| --- | --- |
| 需求编号 | FNOS-001 |
| 提出日期 | 2026-08-19 |
| 需求状态 | <Badge type="tip" text="P0/P1 已完成验证" /> |
| 关联计划 | [PLAN-FNOS-001 DSH 飞牛 NAS 适配](/plans/PLAN-FNOS-001-dsh-fnos-adaptation) |

## 需求背景与目标

DSH 运行在 fnOS 后，需要处理 iframe 入口、数据持久化、应用网关和 NAS 文件权限。直接修改 DSH 源码会增加升级成本，因此适配代码放在 `fn-deepseek-harness`、`@tnnevol/dsh-fnos` 和 `@tnnevol/dsh-codex-auth` 中维护。

本需求让 DSH 在 fnOS 中稳定运行，并补齐主题、授权目录、工作区、NAS 文件引用、文件打开、宿主标题和 Session log 导出。

## 需求目标

- 通过 FPK 安装、启动和访问 DSH Web。
- 用独立插件接入 fnOS 和 Codex 能力，不修改 DSH 官方源码。
- 管理 NAS 授权目录，并在 DSH 工作区和输入框中使用这些路径。
- 让主题、文件打开和页面标题符合 fnOS 宿主行为。
- 支持按发布清单安装插件，并保留用户配置和数据。
- 支持将 Session log 导出到电脑或已授权 NAS 目录。

## 涉及范围

| 模块 | 目录或入口 | 职责 |
| --- | --- | --- |
| FPK 应用 | `apps/fn-deepseek-harness` | 生命周期、iframe、持久化、网关和插件安装 |
| fnOS 插件 | `plugins/dsh-fnos-plugin` | 主题、授权目录、路径选择、文件打开和宿主交互 |
| Codex 插件 | `plugins/dsh-codex-auth-plugin` | Codex OAuth 和模型能力 |
| 应用配置 | `apps/fn-deepseek-harness` | fnOS Scope 和共享目录声明 |
| 文档 | `docs/` | 记录使用方式、边界和验证结果 |

DSH 官方仓库只用于确认插件契约，不提交适配补丁。

## 功能列表

| 编号 | 优先级 | 功能 | 用户行为 | 状态 |
| --- | --- | --- | --- | --- |
| FNOS-001-01 | P0 | fnOS 应用入口 | 从 NAS 桌面打开 DSH，并由 fnOS 控制访问权限 | <Badge type="tip" text="已完成验证" /> |
| FNOS-001-02 | P0 | NAS 主题桥接 | DSH 跟随系统时同步 NAS 主题，手动主题保持 DSH 设置 | <Badge type="tip" text="已完成验证" /> |
| FNOS-001-03 | P0 | 独立适配层 | FPK 和插件提供 fnOS 能力，不修改 DSH 官方源码 | <Badge type="tip" text="已完成验证" /> |
| FNOS-001-04 | P1 | 授权目录管理 | 查看、添加、刷新和取消授权目录，共享目录只读 | <Badge type="tip" text="已完成验证" /> |
| FNOS-001-08 | P2 | 其他 fnOS 能力 | 新能力确认后另立需求和计划 | <Badge type="info" text="后续计划" /> |
| FNOS-001-09 | P1 | FPK 插件安装 | 安装发布清单中的 npm 插件，不打包未发布源码 | <Badge type="tip" text="已完成验证" /> |
| FNOS-001-10 | P1 | 工作区快捷跳转 | 从 DSH 原始工作区弹框选择已授权 NAS 目录 | <Badge type="tip" text="已完成验证" /> |
| FNOS-001-11 | P1 | NAS 文件引用 | 在输入框中多选已授权文件或目录并提交真实路径引用 | <Badge type="tip" text="已完成验证" /> |
| FNOS-001-12 | P1 | fnOS 文件打开 | 用 fnOS 文件应用打开上下文文件和 DSH 配置文件 | <Badge type="tip" text="已完成验证" /> |
| FNOS-001-13 | P1 | 宿主页面标题 | 将 DSH 页面标题同步到 fnOS 应用窗口 | <Badge type="tip" text="已完成验证" /> |
| FNOS-001-15 | P1 | Session log 导出 | 保留电脑下载，并支持导出 ZIP 到授权 NAS 目录 | <Badge type="tip" text="已完成验证" /> |

## 交互和行为约束

| 功能 | 约束 |
| --- | --- |
| 主题 | 只在 DSH 选择跟随系统时响应 `os/theme`，不使用轮询。独立浏览器保持原行为。 |
| 授权目录 | 合并 API、运行时路径和共享目录后去重并显示语义路径。取消选择时静默结束，取消授权不删除文件。 |
| 插件安装 | FPK 只安装发布清单中的精确版本。重复安装和升级不能覆盖用户 profile、会话或凭据。 |
| 工作区 | 保留 DSH 原始弹框和 `onPicked`，插件只提供已授权目录快捷入口，不修改 ACL。 |
| 输入引用 | 目录和文件可多选、移除和去重。提交真实路径，不上传、复制或移动文件。 |
| 文件打开 | fnOS iframe 调用 `TrimApp.openFile()`，独立浏览器继续使用 DSH 原生逻辑。 |
| 页面标题 | 监听 `document.title` 并调用 `setTitle()`。SDK 失败不能阻塞 DSH。 |
| Session log | 电脑导出复用 DSH 原生流程，NAS 导出只能写入已授权目录。 |

## 不在本次范围内

- 不修改 DSH 官方源码、memory 模式和模型业务。
- 不改变 `HOME`、`DSH_HOME` 和现有数据布局。
- 不因取消授权、卸载插件或回滚删除用户文件、会话和工作区。
- 不在浏览器端暴露 Token、Unix Socket 和 Host 内部错误。
- P2 能力扩展另立需求，不写入本计划。

## 验收条件与完成状态

### P0 验收条件

- DSH 可从 fnOS 桌面打开，iframe、应用网关和访问权限正常。
- 跟随系统主题可响应 NAS 主题变化，手动浅色或深色不被覆盖。
- 缺少 fnOS SDK 时 DSH 仍可运行。

### P1 验收条件

- FPK 可安装发布清单插件，升级和重复启动不丢失用户数据。
- 授权目录支持查看、添加、刷新和取消授权，共享目录不可删除。
- 工作区可从原始弹框选择授权目录，并由 DSH 复用或登记工作区。
- 输入框可多选 NAS 文件和目录，引用可移除、去重并提交真实路径。
- 上下文文件和配置文件可交给 fnOS 文件应用打开。
- DSH 标题变化可同步到 fnOS 应用窗口。
- Session log 可下载到电脑或写入授权 NAS 目录。
- 以上功能均已在真实 fnOS NAS 中完成验证。

### 状态看板

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| P0 运行与主题 | <Badge type="tip" text="已完成验证" /> | iframe、网关、权限和主题已通过 NAS 验收 |
| P1 fnOS 功能适配 | <Badge type="tip" text="已完成验证" /> | 插件安装、目录、文件、标题和导出功能已通过 NAS 验收 |
| P2 fnOS 能力扩展 | <Badge type="info" text="后续计划" /> | 新能力另立需求和计划 |

详细实现见[对应计划](/plans/PLAN-FNOS-001-dsh-fnos-adaptation)。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-08-19 | 建立 FNOS-001，确定 P0 运行与主题、P1 授权目录范围。 |
| 2026-08-19 | 增加插件安装、工作区快捷入口和输入框 NAS 引用。 |
| 2026-08-20 | 增加 fnOS 文件打开，移除未发布插件的 FPK 本地集成和目录选择器补丁。 |
| 2026-08-24 | 合并最终功能范围，P0/P1 完成真实 fnOS NAS 验证。 |
| 2026-08-27 | 精简重复的交互、验收和历史说明，保留最终需求与验证结果。 |
