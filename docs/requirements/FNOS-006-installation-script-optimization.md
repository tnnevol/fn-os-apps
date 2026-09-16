---
id: FNOS-006
title: FNOS-006 安装脚本与安装流程优化
description: 统一安装阶段的辅助脚本和构建入口，减少 Shell 与内联 Node 代码，保留 DSH、node-pty、插件和附件初始化的现有行为，并确保 CodeBuddy 流式中止不会因未处理拒绝终止 DSH 服务。
status: planned
owner: tnnevol
targetVersion: 5.5.0
lastVerified: 2026-09-16
---

# FNOS-006 安装脚本与安装流程优化

| 项目 | 内容 |
| --- | --- |
| 需求编号 | FNOS-006 |
| 提出日期 | 2026-09-16 |
| 需求状态 | <Badge type="info" text="规划中" /> |
| 关联计划 | [PLAN-FNOS-006 安装脚本与安装流程优化](/plans/PLAN-FNOS-006-installation-script-optimization) |
| 适用应用 | `fn-deepseek-harness` |

## 需求背景与目标

`fn-deepseek-harness` 的 `cmd/install_callback` 同时承担 Shell 编排、Node.js 文件处理、node-pty 原生文件准备和 attachment 持久化补丁。过去这些逻辑分散在内联 `node -e`、独立 Shell 脚本和独立 JavaScript 脚本中，安装流程能跑起来，但改一处就要同时检查多份入口，测试也不容易覆盖完整。

本需求把安装阶段的 Node.js 逻辑收拢到一个由网关包编译生成的辅助入口。Shell 回调只负责读取 fnOS 环境、安排步骤、传递参数和处理失败。权限继续由 fnOS 应用框架提供，安装脚本不再重复实现 UID/GID 检查、`runuser` 和 `chown`。

## 需求目标

- 安装回调不再包含内联 Node.js 模板脚本。
- `packages/fnos-gateway` 使用 TypeScript 模块维护安装辅助逻辑，并通过 tsdown 生成 FPK 使用的单文件入口。
- node-pty 原生文件准备、依赖生命周期脚本处理、pnpm store 持久化和 attachment-local 补丁保持现有行为。
- 安装回调只保留步骤编排和错误处理，应用用户权限由 `config/privilege` 的 `run-as=package` 统一处理。
- 安装、升级和重复执行保持幂等，不清理用户的 `DSH_HOME`、profile、凭据、会话和插件配置。
- 编译产物路径固定，FPK 安装时不依赖仓库源码或额外的网关 npm 依赖。
- CodeBuddy 模型在思考过程中停止会话时，SSE 中止错误必须被消费并通过 DSH 正常错误链路返回，不得触发 unhandled rejection 或终止 DSH 服务。

## 涉及范围

| 模块 | 目录或入口 | 职责 |
| --- | --- | --- |
| 安装辅助源码 | `packages/fnos-gateway/src/install-callback-helper/` | 维护 JSON、pnpm、node-pty 和 attachment 处理模块 |
| 辅助入口 | `packages/fnos-gateway/src/install-callback-helper/index.ts` | 统一分发安装回调使用的子命令 |
| 应用构建 | `packages/fnos-gateway/tsdown.app.config.ts` | 将辅助入口编译到 FPK 应用目录 |
| FPK 辅助产物 | `apps/fn-deepseek-harness/app/scripts/install-callback-helper.mjs` | 提供 Node 24 可执行的安装辅助脚本 |
| 安装回调 | `apps/fn-deepseek-harness/cmd/install_callback` | 校验运行时、调用 helper、安装 DSH 和插件 |
| 应用权限 | `apps/fn-deepseek-harness/config/privilege` | 由 fnOS 框架提供包用户运行身份 |
| CodeBuddy 插件稳定性 | `plugins/dsh-codebuddy-plugin/src/host/` | 保证流式中止、刷新和周期任务的拒绝被正确收口 |
| 测试与文档 | `packages/fnos-gateway/tests`、`plugins/dsh-codebuddy-plugin/tests`、`docs/` | 覆盖脚本行为、构建产物、流式中止和安装流程说明 |

## 功能列表

| 编号 | 优先级 | 功能 | 用户可观察结果 | 状态 |
| --- | --- | --- | --- | --- |
| FNOS-006-01 | P0 | 统一安装辅助入口 | 安装阶段所有 Node.js 辅助操作都由一个编译后的 helper 提供 | <Badge type="info" text="规划中" /> |
| FNOS-006-02 | P0 | 安装回调瘦身 | `install_callback` 只做流程编排，不再拼接 `node -e` 模板 | <Badge type="info" text="规划中" /> |
| FNOS-006-03 | P0 | node-pty 准备流程收敛 | 有无 g++、是否有 FPK native 文件时都能按原规则完成或明确失败 | <Badge type="info" text="规划中" /> |
| FNOS-006-04 | P0 | attachment 补丁流程收敛 | attachment-local 补丁可重复执行，写入失败不会发布半截文件 | <Badge type="info" text="规划中" /> |
| FNOS-006-05 | P1 | 安装环境与权限边界清晰 | 安装脚本不自行切换用户，DSH 由 fnOS 包用户运行 | <Badge type="info" text="规划中" /> |
| FNOS-006-06 | P1 | 构建产物和安装检查 | FPK 中存在固定路径的 helper，缺失时安装回调给出明确错误 | <Badge type="info" text="规划中" /> |
| FNOS-006-07 | P0 | CodeBuddy 流式中止稳定性 | CodeBuddy 模型思考过程中停止会话只中断当前请求，DSH 客户端服务继续运行 | <Badge type="warning" text="待完成" /> |

## 交互和行为约束

- `install_callback` 的执行顺序保持为：检查 Node.js → 清理旧 pnpm 配置 → 配置 npm 源 → 准备 pnpm → 准备 DSH → 准备 node-pty → 应用 attachment 补丁 → 固化 pnpm store → 管理插件。
- Node.js helper 只通过明确的子命令工作，未知命令必须以非零状态退出。
- package JSON、profile manifest 和 pnpm 元数据读取失败时，读取类查询可以返回空值，真正的安装、写入和补丁操作必须失败并保留可诊断错误。
- node-pty 没有 g++ 时，只临时跳过 node-pty 的 native 生命周期脚本；其他依赖生命周期脚本仍然执行，结束后必须恢复原 package JSON。
- FPK native 文件存在时，DSH 版本文件、node-pty 版本清单、native 目录和已安装 node-pty 版本必须互相匹配。
- attachment-local 补丁必须校验包名、包版本和源码锚点；重复执行只报告已完成，不重复改写源码。
- DSH、npm 和 pnpm 使用的路径继续来自 `${TRIM_*}` 和应用目录，不从当前工作目录或全局 PATH 推断。
- 失败时 `install_callback` 返回非零，并通过 `TRIM_TEMP_LOGFILE` 输出阶段性错误；不得留下需要人工猜测的半安装状态。
- CodeBuddy 的 SSE reader、账号刷新、模型目录读取和自动周期任务产生的 promise 必须有明确的 rejection 观察者；调用方仍需收到原始错误或稳定错误码。
- 停止 CodeBuddy 会话时，流消费者必须被唤醒并结束，不能永久等待或把 `AbortError` 泄漏到进程级 unhandled rejection。
- 不改变 FPK 的 DSH 版本、插件版本、网关路由、公开入口策略和用户数据保留策略。

## 验收条件与完成状态

### FNOS-006-01 验收条件

- `packages/fnos-gateway/src/install-callback-helper/` 下的 TypeScript 模块可通过类型检查和 lint。
- tsdown 生成 `apps/fn-deepseek-harness/app/scripts/install-callback-helper.mjs`，产物可由 Node 24 直接执行。
- 所有安装辅助子命令都从该入口分发，不再依赖旧的独立 node-pty 或 attachment 脚本。

### FNOS-006-02 验收条件

- `cmd/install_callback` 中不存在 `node -e`、大段 JavaScript 模板或旧脚本路径。
- 回调只负责环境变量、步骤顺序、helper 调用和错误退出。
- 安装和升级回调使用同一套 helper 行为，重复执行不会覆盖用户配置。

### FNOS-006-03 验收条件

- 无 g++ 且有匹配 FPK native 文件时，native 文件可复制到所有目标 node-pty 依赖目录。
- 有 g++ 时使用 NAS 编译结果，不重复覆盖已有 native 构建。
- 需要执行依赖生命周期脚本时，node-pty 安装脚本临时禁用，npm rebuild 结束后 package JSON 完整恢复。
- 缺少版本清单、native 文件、目标 node-pty 包或版本不匹配时返回非零并给出具体错误。

### FNOS-006-04 验收条件

- attachment-local 包名和版本校验通过后才能应用补丁。
- 三个源码锚点必须各匹配一次，锚点缺失或重复时拒绝修改。
- 补丁采用临时文件加原子替换；替换失败时清理临时文件并保留原文件。
- 已打补丁的包重复执行保持源码不变。

### FNOS-006-05 验收条件

- 安装脚本不再包含 UID/GID、`runuser`、`chown` 或应用用户切换逻辑。
- `config/privilege` 继续使用 `run-as=package`。
- Node、npm、pnpm、DSH 和 profile 文件由 fnOS 包用户按框架规则访问。

### FNOS-006-06 验收条件

- `pnpm --filter @tnnevol/fnos-gateway typecheck` 和相关测试通过。
- `pnpm run check -- --all` 通过。
- `pnpm run build -- --docs` 通过。
- `pnpm exec fn-apps-cli build -- --fpk --app fn-deepseek-harness --bundle-dsh-plugins` 通过，并确认 FPK 中包含编译后的 helper。
- 在真实 fnOS NAS 上完成新装、重复安装、升级和失败恢复验证后，需求状态才能改为“已完成”。

### FNOS-006-07 验收条件

- CodeBuddy SSE reader 在上游响应中止或读取失败时，消费者被唤醒并收到可处理的错误。
- 停止思考中的 CodeBuddy 会话不会产生 `dsh: fatal load failure`，也不会使 DSH 进程退出。
- CodeBuddy 账号刷新、模型目录读取和自动周期任务的失败不会产生 unhandled rejection。
- CodeBuddy 插件类型检查、全量测试和构建通过；在真实目标环境执行一次思考中停止会话验证后，状态才能改为“已完成”。

## 不在本次范围内

- 不修改 DSH 官方源码、CLI 参数语义或 profile 组合方式。
- 不引入新的公开 `dsh` 系统命令。
- 不把安装脚本重构为多个独立 FPK 应用或额外后台进程。
- 不改变 node-pty、DSH、插件和 attachment 的版本策略。
- 不删除或迁移用户已有的 `DSH_HOME`、profile、凭据、会话和工作区。
- 不修改 CodeBuddy 上游协议、账号切换策略或 DSH 官方模型适配器；本项只收口异常传播和会话中止生命周期。

## 变更记录

| 日期 | 变更 | 说明 |
| --- | --- | --- |
| 2026-09-16 | 新增 FNOS-006 | 登记安装辅助脚本统一、安装回调瘦身、node-pty 与 attachment 流程收敛，以及编译产物和真实 NAS 验收要求 |
| 2026-09-16 | 增加 FNOS-006-07 | 记录 CodeBuddy 思考中停止会话的 SSE 中止、刷新和周期任务 rejection 收口要求；本地测试已通过，待目标环境验证 |
