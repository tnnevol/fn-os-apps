---
id: PLAN-FNOS-006
title: PLAN-FNOS-006 安装脚本与安装流程优化
description: 实施 FNOS-006-01 至 FNOS-006-07，将安装阶段 Node.js 逻辑整理为 TypeScript helper，保留 node-pty、attachment、插件安装和失败恢复行为，并修复 CodeBuddy 流式中止导致 DSH 进程退出的问题。
status: planned
owner: tnnevol
planDate: 2026-09-16
targetVersion: 5.5.0
lastVerified: 2026-09-16
---

# PLAN-FNOS-006 安装脚本与安装流程优化

| 字段 | 内容 |
| --- | --- |
| 计划编号 | PLAN-FNOS-006 |
| 计划日期 | 2026-09-16 |
| 对应需求 | [FNOS-006 安装脚本与安装流程优化](/requirements/FNOS-006-installation-script-optimization) |
| 本轮功能 | `FNOS-006-01` 至 `FNOS-006-07`：统一安装辅助入口、瘦身安装回调、收敛 node-pty 和 attachment 流程、明确权限边界、校验构建产物，并保障 CodeBuddy 思考中停止会话 |
| 适用应用 | `fn-deepseek-harness` |
| 计划状态 | <Badge type="info" text="规划中" /> |

## 计划目标

将安装阶段的 Node.js 逻辑收拢到 `packages/fnos-gateway/src/install-callback-helper/`，由 `tsdown.app.config.ts` 生成应用目录中的单文件 helper。`cmd/install_callback` 只保留步骤编排、环境准备、命令调用和错误反馈，不再维护内联 JavaScript 或多个功能相近的脚本。

这次整理只改变代码组织和安装入口，不改变 DSH、pnpm、node-pty、插件清单、attachment 持久化目录和用户数据保留规则。权限仍由 fnOS `config/privilege` 提供，安装脚本不再实现用户切换。

## 实现范围和边界

| 模块 | 计划入口 | 实现责任 |
| --- | --- | --- |
| Helper 主入口 | `packages/fnos-gateway/src/install-callback-helper/index.ts` | 解析子命令并调用对应模块 |
| 通用安装操作 | `packages/fnos-gateway/src/install-callback-helper/common.ts` | JSON、profile、pnpm store 和插件清单处理 |
| node-pty 模块 | `packages/fnos-gateway/src/install-callback-helper/node-pty.ts` | 版本检查、编译器判断、生命周期脚本、native 文件复制 |
| attachment 模块 | `packages/fnos-gateway/src/install-callback-helper/attachment-patch.ts` | attachment-local 包校验、源码补丁和原子替换 |
| 应用构建 | `packages/fnos-gateway/tsdown.app.config.ts` | 生成 `app/scripts/install-callback-helper.mjs` |
| 安装回调 | `apps/fn-deepseek-harness/cmd/install_callback` | 按固定顺序调用 helper 和 DSH CLI |
| 应用权限 | `apps/fn-deepseek-harness/config/privilege` | 提供包用户运行身份，不由脚本重复处理 |
| CodeBuddy 流式稳定性 | `plugins/dsh-codebuddy-plugin/src/host/` | 收口 SSE 中止、刷新目录和周期任务的异步拒绝 |
| 测试和文档 | `packages/fnos-gateway/tests`、`plugins/dsh-codebuddy-plugin/tests`、`docs/` | 回归脚本行为、FPK 产物、CodeBuddy 中止和安装流程 |

## 目标架构和数据流

```text
fnOS install_callback
        │
        ├─ Node.js / npm / DSH 环境准备
        │
        ├─ install-callback-helper.mjs
        │      ├─ common
        │      ├─ node-pty
        │      └─ attachment-patch
        │
        └─ dsh plugin --profile web
               │
               └─ Web profile 与插件依赖
```

构建时：

```text
packages/fnos-gateway/src/install-callback-helper/index.ts
        │
        └─ tsdown.app.config.ts
                │
                └─ apps/fn-deepseek-harness/app/scripts/install-callback-helper.mjs
```

## 分阶段任务

### P0：统一安装辅助入口

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-006-T01-01 | FNOS-006-01 | 将 helper 入口和通用文件操作整理为 TypeScript 模块 | 类型检查和 lint 通过，未知命令返回非零 |
| PLAN-FNOS-006-T01-02 | FNOS-006-01、06 | 在 tsdown 应用配置中增加 helper 入口，固定输出路径并加入生成文件忽略规则 | Node 24 可执行，FPK 中包含 helper |

验证结果：

- `packages/fnos-gateway/src/install-callback-helper/` 已拆分为 `index.ts`、`common.ts`、`node-pty.ts` 和 `attachment-patch.ts`。
- `tsdown.app.config.ts` 固定输出 `apps/fn-deepseek-harness/app/scripts/install-callback-helper.mjs`（约 19 KB，425 行），重复构建结果稳定。
- 未知子命令返回非零（实测退出码 1），`package-version` 等子命令在 Node 24 下可用。
- 已包含 `prepare-node-pty` 与 `patch-attachment-local` 子命令；旧 `install-node-pty.sh` 和 `patch-dsh-attachment-local.mjs` 已删除。

### P0：收敛 node-pty 与 attachment 流程

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-006-T02-01 | FNOS-006-03 | 把 node-pty 的版本校验、g++ 判断、npm rebuild、元数据恢复和 native 文件复制迁入 `node-pty.ts` | 有无 g++、有无 native 包和版本不匹配场景均有明确结果 |
| PLAN-FNOS-006-T02-02 | FNOS-006-04 | 把 attachment-local 的源码锚点校验、补丁和原子写入迁入 `attachment-patch.ts` | 首次补丁成功，重复执行幂等，失败保留原文件 |
| PLAN-FNOS-006-T02-03 | FNOS-006-03、04 | 删除旧的 `install-node-pty.sh` 和 `patch-dsh-attachment-local.mjs`，由 helper 子命令统一执行 | 安装回调不再引用旧脚本 |

### P0：简化安装回调

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-006-T03-01 | FNOS-006-02、05 | 删除回调中的 `node -e`、重复 JSON 解析函数和身份切换逻辑 | 回调只保留流程编排，不出现旧权限工具和内联 Node 模板 |
| PLAN-FNOS-006-T03-02 | FNOS-006-02、06 | 为 helper 缺失、Node 不可用和子命令失败补充阶段性错误 | `TRIM_TEMP_LOGFILE` 能收到明确错误，生命周期返回非零 |

验证结果：

- `cmd/install_callback` 中 `node -e` 计数为 0，大段内联 JavaScript 与重复 JSON 解析函数已移除。
- 回调只保留环境读取、步骤顺序、`run_install_callback_helper` 调用、`fail_install` 错误退出，以及 helper 缺失与 Node 不可用的阶段检查。
- 回调不再出现 `runuser`、`chown`、`TRIM_UID`、`TRIM_GROUPNAME` 或 `APP_UID`/`APP_GROUP`；身份由 `config/privilege` 的 `run-as=package` 提供。
- `bash -n apps/fn-deepseek-harness/cmd/install_callback` 与 `node --check` 均通过；`pnpm --filter @tnnevol/fnos-gateway check` 通过（54 项测试）。

### P0：CodeBuddy 流式中止稳定性

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-006-T05-01 | FNOS-006-07 | 在 `parseSse` 中立即观察 reader pump 的拒绝，记录失败并唤醒等待中的消费者 | 上游中止时流结束并返回可处理错误，不再永久等待或产生 unhandled rejection |
| PLAN-FNOS-006-T05-02 | FNOS-006-07 | 为 CodeBuddy 账号刷新、模型目录读取和自动签到/旅行/切换周期的浮空 promise 增加 rejection 收口 | 单次网络、凭据或存储失败只记录错误，不触发 DSH 进程退出 |
| PLAN-FNOS-006-T05-03 | FNOS-006-07 | 增加 SSE、延迟拒绝和中止场景回归测试，并重新构建 CodeBuddy bundle | CodeBuddy 插件测试和构建通过，构建产物包含修复 |

验证结果：

- `PLAN-FNOS-006-T05-01`、`T05-02`、`T05-03` 均已完成。
- `pnpm --filter @tnnevol/dsh-codebuddy check`、`pnpm --filter @tnnevol/dsh-codebuddy build`、`pnpm run check -- --all`、`pnpm run build -- --docs` 通过；CodeBuddy 812 项测试通过。
- 端到端中止复现通过：思考中停止会话后流以 `AbortError` 干净结束，DSH 进程继续运行。
- 真实使用环境已确认「思考中停止会话不再导致 DSH 客户端服务停止」。

### P1：回归验证与发布

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-006-T04-01 | FNOS-006-01、03、04 | 增加 helper 子命令和 node-pty/attachment 场景测试 | 关键成功、重复执行、版本错误、权限错误和恢复路径覆盖 |
| PLAN-FNOS-006-T04-02 | FNOS-006-06 | 构建 FPK 并检查 helper、网关和脚本路径 | FPK 可识别，安装回调能找到 Node 24 helper |
| PLAN-FNOS-006-T04-03 | FNOS-006-06 | 在真实 fnOS NAS 执行新装、重复安装、升级和故障恢复 | 记录日志、权限、native 文件、profile 和用户数据结果 |

## 详细交互

1. fnOS 按应用权限配置执行 `cmd/install_callback`。
2. 回调检查 Node.js 和编译生成的 helper 是否存在。
3. 回调读取旧 npm 配置，调用 helper 清理 legacy `store-dir`。
4. 回调配置 npm registry，准备固定版本 pnpm 和 DSH。
5. 回调调用 helper 的 `prepare-node-pty`，按 NAS 编译器和 FPK native 文件状态选择路径。
6. 回调调用 helper 的 `patch-attachment-local`，校验依赖并应用持久化补丁。
7. 回调调用 helper 持久化 pnpm store，之后通过 DSH CLI 管理 Web profile 插件。
8. 任一步骤失败都停止流程，保留已有用户 profile 和配置，并输出可定位错误。
9. CodeBuddy 模型思考中收到停止会话信号时，SSE reader 先记录并唤醒读取方，错误沿 DSH 适配器链路返回；刷新、目录读取和周期任务的后台 promise 同样必须被观察。

## 数据、权限和错误处理

- 所有用户数据继续保存在 `${TRIM_PKGHOME}`、`${TRIM_PKGVAR}` 和应用声明的持久化目录中，不因重构改变路径。
- `config/privilege` 的 `run-as=package` 是安装阶段和应用运行身份的唯一来源，helper 不读取 UID/GID，也不调用 `runuser` 或 `chown`。
- 写入 pnpm store 记录和 attachment 源文件时继续使用临时文件和原子替换；临时文件失败要清理。
- node-pty package JSON 在执行 rebuild 前备份，rebuild 完成或失败后都尝试恢复；恢复失败时流程返回非零。
- helper 不输出凭据内容、Token 或完整环境变量，只输出阶段、版本和可诊断错误。
- helper 缺失、Node 版本不可用、包版本不匹配、native 文件不完整和源码锚点变化都必须明确失败。
- CodeBuddy 流式中止、账号刷新、模型目录读取及自动周期失败必须由明确的 rejection handler 收口；不得让 unhandled rejection 触发 DSH 的 fail-loud 退出。

## 依赖、风险和决策

| 项目 | 风险 | 处理方式 |
| --- | --- | --- |
| Node.js 版本 | fnOS 设备缺少声明的 Node.js runtime | 回调在任何写入前失败并提示依赖应用 |
| tsdown 输出 | 源码更新但 FPK 仍使用旧 helper | FPK 构建前强制运行 `build:app`，并检查生成路径 |
| node-pty native | NAS 没有 g++ 且 FPK native 文件缺失 | 明确失败，不留下半安装依赖 |
| pnpm rebuild | 生命周期脚本修改包元数据后未恢复 | 使用临时备份，成功和失败路径都恢复 |
| attachment 补丁 | 上游源码结构变化导致错误替换 | 三个锚点各匹配一次，否则拒绝写入 |
| 用户数据 | 重构误删 profile 或凭据 | 不执行清空和迁移，失败时保留旧数据 |

不修改 DSH 官方源码、fnOS 权限模型和 DSH CLI 参数语义。安装 helper 只是 FPK 内部运行文件，不作为公开系统命令暴露。

## 测试、打包和发布

本地检查：

```bash
pnpm --filter @tnnevol/fnos-gateway typecheck
pnpm --filter @tnnevol/fnos-gateway run test
pnpm --filter @tnnevol/fnos-gateway run build:app
pnpm run check -- --all
pnpm run build -- --docs
pnpm exec fn-apps-cli build -- --fpk --app fn-deepseek-harness --bundle-dsh-plugins
pnpm --filter @tnnevol/dsh-codebuddy check
pnpm --filter @tnnevol/dsh-codebuddy build
```

构建后检查：

- `apps/fn-deepseek-harness/app/gateway-proxy.mjs` 和 `app/scripts/install-callback-helper.mjs` 均为 Node 24 可执行的单文件 ESM。
- 安装回调只引用生成后的 helper，不引用 `packages/` 源码路径和已删除的旧脚本。
- FPK 不包含仓库 `node_modules`，也不要求 NAS 在安装阶段重新安装网关 npm 依赖。
- helper 缺失、native 文件不完整或包版本不匹配时，安装失败日志能指出具体阶段。
- 真实 NAS 验收单独记录新装、重复安装、升级、失败恢复和用户数据保留结果。
- CodeBuddy 真实运行验收记录「思考中停止会话」结果，确认客户端连接和 DSH 服务均保持运行。

## 完成状态

| 阶段 | 状态 | 完成条件 |
| --- | --- | --- |
| P0 统一安装辅助入口 | <Badge type="tip" text="已完成" /> | TypeScript 模块、tsdown 固定输出和 Node 24 可执行产物均完成 |
| P0 node-pty 与 attachment 流程 | <Badge type="info" text="规划中" /> | 原有功能迁移并通过回归测试 |
| P0 安装回调瘦身 | <Badge type="tip" text="已完成" /> | `node -e` 清零、旧脚本移除、权限交由 `run-as=package` |
| P0 CodeBuddy 流式中止稳定性 | <Badge type="tip" text="已完成" /> | 代码、812 项插件测试、构建、端到端中止复现和真实环境验证均通过 |
| P1 回归验证与发布 | <Badge type="info" text="规划中" /> | 全量检查、FPK 构建和真实 NAS 验收通过 |

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-16 | 建立 PLAN-FNOS-006，规划安装辅助脚本统一、安装回调瘦身、node-pty 与 attachment 流程收敛，以及构建和 NAS 验收。 |
| 2026-09-16 | 增加 PLAN-FNOS-006-T05-01 至 T05-03：将 CodeBuddy 思考中停止会话的 SSE 中止、刷新/目录读取和周期任务 rejection 收口纳入 P0；本地 812 项测试和端到端中止验证通过，待真实 NAS 验收。 |
| 2026-09-16 | T05 阶段验收通过：CodeBuddy 流式中止稳定性在真实使用环境确认，思考中停止会话不再导致 DSH 客户端服务停止；阶段状态改为“已完成”。 |
| 2026-09-16 | T01、T03 阶段完成：统一安装辅助入口与简化安装回调完成，helper 模块化编译产物落地（19 KB/425 行，未知子命令退出码 1），回调 `node -e` 计数为 0 且不再处理身份切换；阶段状态改为“已完成”。 |
