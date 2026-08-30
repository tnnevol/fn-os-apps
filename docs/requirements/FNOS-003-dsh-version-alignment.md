---
id: FNOS-003
title: FNOS-003 DSH 版本统一升级
description: 统一 DSH 插件、运行时依赖与 fnOS FPK 安装流程使用的 DSH 版本。
status: validating
owner: tnnevol
targetVersion: 5.1.x
lastVerified: 2026-08-30
---

# FNOS-003 DSH 版本统一升级

| 字段 | 内容 |
| --- | --- |
| 需求编号 | FNOS-003 |
| 提出日期 | 2026-08-30 |
| 需求状态 | <Badge type="warning" text="待完成" /> |
| 关联计划 | [PLAN-FNOS-003 DSH 版本统一升级](/plans/PLAN-FNOS-003-dsh-version-alignment) |

## 需求背景与目标

当前仓库中的 DSH 插件、插件依赖、FPK 安装器和 native 依赖构建配置存在旧版本声明。版本不一致会导致插件无法加载、安装器重复安装旧 DSH，或 node-pty 产物与运行时不匹配。

本需求将 DSH 生态中实际发布和安装的版本统一到 `0.1.1-rc.2`，并同步相关文档，让本地开发、插件发布和 fnOS FPK 安装使用同一套版本约束。

## 需求目标

- 三个 DSH 运行时插件的自身版本统一为 `0.1.1-rc.2`。
- 三个插件的 `@deepseek-ai/dsh-*` 依赖和兼容性声明统一为 `0.1.1-rc.2`。
- `fn-deepseek-harness` FPK 安装器固定检查和安装 `@deepseek-ai/dsh@0.1.1-rc.2`。
- node-pty native 构建参数、发布插件清单和 rc 发布标签与目标版本一致。
- 涉及版本的应用、插件和开发文档同步更新，避免继续指导使用旧版本。

## 涉及范围

| 模块 | 涉及内容 | 职责 |
| --- | --- | --- |
| DSH 插件 | `dsh-codex-auth`、`dsh-fnos`、`dsh-semi-ui-showcase` | 更新包版本、DSH 依赖和兼容性声明 |
| fnOS 应用 | `fn-deepseek-harness` 安装回调、发布插件清单 | 固定 DSH 版本并安装已发布 rc 插件 |
| native 构建 | GitHub Actions 配置和 node-pty 参数文件 | 为固定 DSH 版本准备可复用的 native 产物 |
| 文档 | 应用、插件、需求和计划文档 | 同步版本、安装方式和验收规则 |
| 共享 UI | `@tnnevol/dsh-semi-ui` | 版本同步为 `0.1.1-rc.2`；它仍是内部共享 UI 包，不是 DSH 运行时插件 |

## 功能列表

| 编号 | 优先级 | 功能 | 用户行为 | 状态 |
| --- | --- | --- | --- | --- |
| FNOS-003-01 | P0 | DSH 插件版本统一 | 安装或发布任一 DSH 插件时，包版本为 `0.1.1-rc.2` | <Badge type="warning" text="待完成" /> |
| FNOS-003-02 | P0 | DSH 依赖版本统一 | 插件使用与 DSH `0.1.1-rc.2` 匹配的 peer/dev 依赖和兼容性声明 | <Badge type="warning" text="待完成" /> |
| FNOS-003-03 | P0 | FPK 固定安装 DSH | 安装或升级 fnOS 应用时，只检查并安装 `@deepseek-ai/dsh@0.1.1-rc.2` | <Badge type="warning" text="待完成" /> |
| FNOS-003-04 | P1 | node-pty 构建参数同步 | FPK 构建使用固定 DSH 版本对应的 native 配置，NAS 无编译器时使用内置产物 | <Badge type="warning" text="待完成" /> |
| FNOS-003-05 | P1 | 发布清单和文档同步 | FPK 使用 rc 标签安装已发布插件，文档中的版本、命令和链接与实际配置一致 | <Badge type="warning" text="待完成" /> |

## 交互和行为约束

- FPK 安装回调必须进行精确版本检查；本地没有 `@deepseek-ai/dsh@0.1.1-rc.2` 时才安装该精确版本。
- 旧版 DSH 或旧版插件不会被当作目标版本复用；安装失败时输出带时间和生命周期前缀的日志。
- 安装和升级不得清空或重建 `DSH_HOME` 中的用户配置、工作区、登录状态和 profile 数据。
- FPK 只安装发布清单中已发布的插件，不从源码目录加载插件。
- 本次使用 npm rc 发布标签；不把共享 UI 包版本误认为 DSH 运行时插件版本。

## 不在本次范围内

- 不修改 DSH 官方源码或上游版本行为。
- 不升级 `@tnnevol/dsh-semi-ui` 共享 UI 包版本。
- 不改变未发布插件的安装策略，不恢复源码链接安装。
- 不删除用户已有的 DSH 数据、profile 配置或历史日志。
- 不以本地浏览器构建通过替代真实 NAS FPK 安装验收。

## 验收条件与完成状态

### 验收条件

1. 三个 DSH 插件的 package、compatibility 和 DSH 依赖均为 `0.1.1-rc.2`。
2. 三个插件分别通过 typecheck、测试和构建。
3. FPK 安装回调只接受并安装 `@deepseek-ai/dsh@0.1.1-rc.2`，且 node-pty native 产物版本匹配。
4. FPK 能安装清单中的 rc 插件，DSH Web 能正常启动并加载插件。
5. 版本升级前后 `DSH_HOME` 中的用户配置和 profile 数据保持不变。
6. 应用、插件、需求和计划文档不再把本次目标版本描述为未发布版本。
7. 在目标 NAS 完成安装、启动和插件加载验证后，才将本需求标记为“已完成”。

### 当前状态看板

| 范围 | 当前状态 | 下一步 |
| --- | --- | --- |
| 源码版本与依赖 | <Badge type="tip" text="已修改" /> | 完成检查和构建 |
| FPK 安装与 native 配置 | <Badge type="tip" text="已修改" /> | 构建并验证 FPK |
| 文档与导航 | <Badge type="tip" text="已同步" /> | 检查文档构建 |
| 真实 NAS 验收 | <Badge type="warning" text="待完成" /> | 安装目标 FPK 后验证 |

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-08-30 | 新增需求，统一 DSH 插件、依赖、FPK 安装器和 native 构建使用 `0.1.1-rc.2`。 |
