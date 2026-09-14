---
id: PLAN-FNOS-005
title: PLAN-FNOS-005 CodeBuddy 插件移植成长任务与任务中心
description: 实施 FNOS-005-01 至 FNOS-005-04：移植 workbuddy2api-panel 的成长任务列表/报名/领奖与任务中心全账号扫描、执行队列，复用 CodeBuddy 既有账号凭据与上报链路。
status: planned
owner: tnnevol
planDate: 2026-09-14
targetVersion: 5.4.0
lastVerified: 2026-09-14
---

# PLAN-FNOS-005 CodeBuddy 插件移植成长任务与任务中心

| 字段 | 内容 |
| --- | --- |
| 计划编号 | PLAN-FNOS-005 |
| 计划日期 | 2026-09-14 |
| 对应需求 | [FNOS-005 CodeBuddy 插件移植成长任务与任务中心](/requirements/FNOS-005-codebuddy-growth-tasks) |
| 本轮功能 | `FNOS-005-01` 至 `FNOS-005-04`：成长任务列表与状态、单任务/一键完成 + 自动领奖、任务中心扫描与执行队列、不可自动化任务指引 |
| 移植来源 | `workbuddy2api-panel`（`/Users/tnnevol/workspace/fork-pj/workbuddy2api-panel`） |
| 计划状态 | <Badge type="info" text="规划中" /> |

## 计划目标

将 `workbuddy2api-panel` 的 CodeBuddy 成长任务能力移植到本仓库 CodeBuddy 插件：复用现有账号 AccessToken、行为事件上报指纹与 per-account 锁，实现成长任务列表/报名/进度回读/自动领奖，以及任务中心的全账号扫描与执行队列。开学季活动不在本轮范围。

## 实现范围和边界

| 模块 | 计划入口 | 实现责任 |
| --- | --- | --- |
| 上游任务接口 | `plugins/dsh-codebuddy-plugin/src/host`（新增 growth tasks 客户端） | 移植列表/报名/领奖端点与字段口径，复用现有 AccessToken 与上报签名 |
| 成长任务执行 | `plugins/dsh-codebuddy-plugin/src/host` | 单任务推进（行为事件上报 → 轮询进度 → 自动领奖），与现有 per-account 锁互斥 |
| 任务中心 | `plugins/dsh-codebuddy-plugin/src/client` + host | 全账号扫描、执行队列状态机、实时进度 |
| 面板 UI | `plugins/dsh-codebuddy-plugin/src/client` | 成长任务列表、执行队列、不可自动化项指引 |

本轮不移植 `workbuddy2api-panel` 的账号池、Web 面板、Redis 镜像与开学季活动；不引入独立后端进程。

## 分阶段任务

### P1：成长任务列表与状态

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T01-01 | FNOS-005-01-AC-01 | 移植 `upstream.Task` 列表口径，复用 AccessToken 拉取并展示 `task_code`/标题/进度/奖励/可自动化/已领取 | 字段与来源 `tasks.go` 一致，失败账号标注错误 |
| PLAN-FNOS-005-T01-02 | FNOS-005-01-AC-02/03 | 列表只读拉取，不触发上报/领奖；不可自动化任务标注原因与指引 | 扫描不写副作用，不可自动化任务有说明 |

### P1：单任务/一键完成 + 自动领奖

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T02-01 | FNOS-005-02-AC-01/03 | 复用来源行为事件指纹推进进度，执行前批量报名未接受任务，达标后 Web 域自动领奖 | 进度与领奖与来源语义一致 |
| PLAN-FNOS-005-T02-02 | FNOS-005-02-AC-02/04 | 幂等跳过已领取/达标项，凭据缺失或刷新失败明确报错 | 重复执行无副作用，错误可见 |

### P1：任务中心扫描与队列

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T03-01 | FNOS-005-03-AC-01 | 一键扫描全账号未完成可自动化成长任务，按账号聚合与计数 | 只读扫描结果正确 |
| PLAN-FNOS-005-T03-02 | FNOS-005-03-AC-02/03/04 | 执行队列账号内串行、账号间并发 1–4，`seq` 递增，运行中冲突返回，不可自动化项与占用账号标 skipped | 队列语义与来源一致，实时进度可查 |

### P2：不可自动化任务指引

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T04-01 | FNOS-005-04-AC-01 | 排除 `Expert_Philanthropy` 等并展示原因与操作说明 | 不进入自动执行路径 |

## 完成状态

| 阶段 | 状态 | 完成条件 |
| --- | --- | --- |
| P1 成长任务列表与状态 | <Badge type="info" text="规划中" /> | 列表只读展示进度/奖励/可自动化/已领取，不可自动化项有说明 |
| P1 单任务/一键完成 + 自动领奖 | <Badge type="info" text="规划中" /> | 行为事件推进 + 轮询达标 + 自动领奖 + 幂等 |
| P1 任务中心扫描与队列 | <Badge type="info" text="规划中" /> | 全账号扫描 + 执行队列状态机 + 实时进度 |
| P2 不可自动化任务指引 | <Badge type="info" text="规划中" /> | 排除并展示说明 |

## 变更记录

| 日期 | 变更 | 说明 |
| --- | --- | --- |
| 2026-09-14 | 建立 PLAN-FNOS-005 | 配套 FNOS-005 建立实施计划骨架，范围锁定成长任务与任务中心；开学季活动不在本轮 |
