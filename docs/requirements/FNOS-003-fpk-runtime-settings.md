---
id: FNOS-003
title: FNOS-003 FPK 应用运行设置统一
description: 为需要运行参数配置的 fnOS FPK 应用补齐应用设置入口，并承接 FNOS-002 遗留的 FPK/NAS 集成验收，保持安装、运行和发布配置一致。
status: planned
owner: tnnevol
targetVersion: 5.3.1
lastVerified: 2026-09-08
---

# FNOS-003 FPK 应用运行设置统一

| 项目 | 内容 |
| --- | --- |
| 需求编号 | FNOS-003 |
| 提出日期 | 2026-08-31 |
| 需求状态 | <Badge type="info" text="规划中" /> |
| 关联计划 | [PLAN-FNOS-003 FPK 应用运行设置统一](/plans/PLAN-FNOS-003-fpk-runtime-settings) |

## 需求背景与目标

目前仓库内应用大多已有 `cmd/main` 和 `cmd/config_callback`，但只有部分应用提供 `wizard/config`。没有 `wizard/config` 时，用户无法在 fnOS 的“应用设置”中修改应用运行参数；已有安装向导的配置也可能与运行时配置分散，导致字段、默认值和校验规则不一致。

本需求同时承接 FNOS-002 已实现但尚未完成目标环境验收的工作：DSH FPK 内置插件包与发布清单版本对齐、安装/升级/回滚保留配置、网关完整代理场景，以及 Codex 动态模型和 CodeBuddy 管理面板在真实 NAS 上的验收。

本需求统一需要运行参数配置的 FPK 应用的设置入口，明确安装配置、运行设置和生命周期脚本的职责边界。是否纳入配置不以“存在 `cmd/main`”作为唯一条件，而以应用确实存在可修改的运行参数为准。

## 需求目标

- 为目标应用提供 `wizard/config`，在应用设置中展示可修改的运行参数。
- 运行配置与 `wizard/install` 中对应的运行字段保持名称、类型、默认值和校验规则一致。
- 保存后通过 `cmd/config_callback` 使配置生效；`cmd/main` 继续负责启动、停止和状态维护。
- 一次性安装参数不出现在运行设置中；不需要运行配置的应用不增加空设置页。
- 完成 FNOS-002 遗留的 DSH FPK 构建、插件加载、版本升级/回滚和网关完整代理验收。
- 完成 Codex 动态模型目录、CodeBuddy 多账号管理面板及 Token 统计在真实 NAS 环境的验收，并回写 FNOS-002 状态。

## 涉及范围

| 模块 | 目录或入口 | 职责 |
| --- | --- | --- |
| FPK 应用 | `apps/*/manifest`、`wizard/install`、`wizard/config` | 声明安装配置和可持续修改的运行配置 |
| 生命周期脚本 | `cmd/main`、`cmd/config_init`、`cmd/config_callback` | 读取 `wizard_*` 环境变量，管理进程并应用配置变更 |
| 开发文档 | `docs/development`、应用文档 | 记录字段来源、脚本关系和验证方式 |
| 构建与验证 | FPK 构建脚本、测试目录、目标 NAS | 验证设置展示、保存生效和升级保留配置 |

## 功能列表

| 编号 | 优先级 | 功能 | 用户行为 | 状态 |
| --- | --- | --- | --- | --- |
| FNOS-003-01 | P1 | 运行设置入口 | 在应用中心打开应用设置，可看到目标应用的运行参数配置 | <Badge type="info" text="规划中" /> |
| FNOS-003-02 | P1 | 安装与运行配置一致 | 安装时与运行时使用同一套字段契约，修改后字段值能被生命周期脚本读取 | <Badge type="info" text="规划中" /> |
| FNOS-003-03 | P1 | 配置变更生效 | 用户保存配置后，应用按约定重载或重启服务，并能看到新的运行状态 | <Badge type="info" text="规划中" /> |
| FNOS-003-04 | P1 | 一次性配置边界 | 仅安装阶段使用的路径、初始化选项和迁移参数不出现在运行设置中 | <Badge type="info" text="规划中" /> |
| FNOS-003-05 | P1 | DSH FPK 与版本验收 | FPK 内置插件包与发布清单、插件兼容版本保持一致，安装/升级/回滚保留用户配置 | <Badge type="info" text="规划中" /> |
| FNOS-003-06 | P1 | DSH 网关完整场景验收 | 完成 API 反代即时生效、SSE/WebSocket、权限、并发、异常和恢复场景验证 | <Badge type="info" text="规划中" /> |
| FNOS-003-07 | P1 | DSH 插件管理面板验收 | 验证 Codex 动态模型目录和 CodeBuddy 多账号、额度、签到、Token 统计面板在真实 NAS 可用 | <Badge type="info" text="规划中" /> |

## 交互和行为约束

- 目标应用的“应用设置”只展示真实可运行时修改的字段；没有此类字段的应用不新增 `wizard/config`。
- `wizard/config` 的字段名使用稳定的 `wizard_*` 环境变量，并与 `wizard/install` 的运行字段保持一致。
- 保存由 fnOS 统一提交；保存成功后调用 `cmd/config_callback`，由脚本决定安全重载或重启，不在 Client 侧伪造状态。
- `cmd/main` 负责 `start`、`stop`、`status`；`cmd/config_callback` 负责配置保存后的应用变更，两者职责不能互相替代。
- `ctl_stop=false` 的应用仍不显示应用中心的启停控制；这与是否提供运行设置是两个独立条件。
- 密码、Token 等敏感值按 fnOS 配置类型处理，不在普通日志和页面中回显。

## 不在本次范围内

- 不为所有应用机械复制 `wizard/install`，不为没有运行参数的应用增加空配置页。
- 不修改 fnOS 应用中心的设置页面或生命周期协议。
- 不改变应用业务功能、数据目录、权限模型和已有安装迁移策略。
- 不把 `ctl_stop` 的启停按钮行为与运行设置入口合并。
- 不在本需求重新实现 FNOS-002 已完成的插件和网关代码，只补齐 FPK/NAS 集成验收及其必要的修复。

## 验收条件与完成状态

### P1 验收条件

- 选定的目标应用在应用设置中显示对应的运行参数，字段类型、默认值和校验结果正确。
- 保存后 `cmd/config_callback` 收到新值并按应用约定使服务生效；`cmd/main status` 返回真实状态。
- 重启或升级应用后，运行配置和用户数据保留；一次性安装参数不会被错误覆盖。
- 没有运行参数的应用不出现空的运行设置；`ctl_stop=false` 的应用不因此新增启停控制。
- 完成 FPK 构建和真实 NAS 安装验证后，需求状态才能改为已完成。
- DSH FPK 中内置插件版本与 `published-dsh-plugins.json` 一致，安装、升级、回滚和插件加载不丢失用户配置。
- DSH 网关的 HTTP、SSE、WebSocket、权限、并发、异常恢复场景在目标 NAS 验收通过。
- Codex 动态模型目录和 CodeBuddy 管理面板在目标 NAS 可访问、可操作，Token 统计数据和图表显示正确。

### 状态看板

| 阶段 | 状态 | 当前范围 | 下一步 |
| --- | --- | --- | --- |
| P1 运行设置统一 | <Badge type="info" text="规划中" /> | 已确认配置入口、字段边界和脚本职责 | 审计应用并确定目标清单，随后实现并在 NAS 验证 |
| FNOS-002 遗留 DSH 验收 | <Badge type="info" text="规划中" /> | 承接 FPK/网关/插件管理面板的目标环境验收 | 完成 FPK 构建、安装升级回滚、网关完整场景和插件面板验收 |

## 变更记录

| 日期 | 变更 | 说明 |
| --- | --- | --- |
| 2026-08-31 | 新增 FNOS-003 | 原 FNOS-003 的 DSH 版本统一内容迁移到 FNOS-002，本需求改为 FPK 应用运行设置统一 |
| 2026-08-31 | 明确配置职责 | 确认 `wizard/config` 负责应用设置表单，`cmd/main` 负责生命周期，`cmd/config_callback` 负责保存后生效 |
| 2026-09-08 | 承接 FNOS-002 遗留验收 | 将 DSH FPK 版本与内置插件包、网关完整场景、Codex 动态模型和 CodeBuddy 管理面板的未完成目标环境验收纳入 FNOS-003 |
