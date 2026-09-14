---
id: FNOS-005
title: FNOS-005 CodeBuddy 插件移植成长任务与任务中心
description: 将 workbuddy2api-panel 中的 CodeBuddy 成长任务能力（任务列表、一键完成、自动领奖）与任务中心（全账号扫描、执行队列）移植到本仓库 CodeBuddy 插件。
status: planned
owner: tnnevol
targetVersion: 5.4.0
lastVerified: 2026-09-14
---

# FNOS-005 CodeBuddy 插件移植成长任务与任务中心

| 项目 | 内容 |
| --- | --- |
| 需求编号 | FNOS-005 |
| 提出日期 | 2026-09-14 |
| 需求状态 | <Badge type="info" text="规划中" /> |
| 关联计划 | 待建立（进入实施阶段后补充 [PLAN-FNOS-005](/plans/PLAN-FNOS-005-codebuddy-growth-tasks)，本轮先以需求文档登记范围） |
| 移植来源 | `workbuddy2api-panel`（`/Users/tnnevol/workspace/fork-pj/workbuddy2api-panel`） |

## 需求背景与目标

`workbuddy2api-panel` 已实现 CodeBuddy/WorkBuddy「成长计划」的纯 API 自动化：`internal/upstream/tasks.go` 封装了成长任务的列表（`GET /v2/activity/growth/tasks`）、报名（`POST .../accept`）与领奖（`POST /activity/growth/tasks/<code>/claim`），`internal/panel/taskcenter.go` 提供「任务中心」——全账号扫描 + 执行队列（账号内串行、账号间并发）。18 个成长任务中 17 个可纯 API 完成，仅 `Expert_Philanthropy` 需真实捐款、不可自动化。

本需求把上述能力移植到本仓库的 CodeBuddy 插件（`plugins/dsh-codebuddy-plugin`）：在插件内复用 CodeBuddy 既有账号凭据与上报链路，提供成长任务列表、单任务/一键自动完成 + 自动领奖，以及任务中心的全账号扫描与执行队列。开学季活动（`school.go`/开学季独立视图）不在本轮范围，另立需求。

### 移植依据

- 来源仓库：`/Users/tnnevol/workspace/fork-pj/workbuddy2api-panel`（Go，面板 + 上游客户端）。
- 关键源码：
  - `internal/upstream/tasks.go`：成长任务列表/报名/领奖端点与字段口径。
  - `internal/panel/taskcenter.go`：`tasksScanAll`（只读扫描）、`tasksRunQueue`/`runQueueItems`（执行队列）、`acceptPendingTasks`（批量报名）、`runGrowthQueued`（单任务推进 + 自动领奖）。
  - `internal/upstream/desktop.go`、`internal/upstream/streak.go`：不同任务所需的行为事件指纹（CLI / 桌面 / web / 小程序），是进度判据的关键。
- 计分语义：任务进度由 `/v2/report` 行为上报点亮，不同任务认不同客户端指纹；上报 200 不等于计分，需轮询进度达标后再领奖；上报按天幂等，重复执行不重复扣资源。

## 需求目标

- 在本仓库 CodeBuddy 插件内复用现有账号凭据、上报通道与互斥锁，实现成长任务的列表查询、报名、进度回读、自动领奖。
- 提供「任务中心」视图：一键扫描全账号未完成的成长任务（可自动化项），按账号分组执行（账号内串行、账号间可配并发），实时更新每条目状态。
- 对不可自动化的任务（如 `Expert_Philanthropy`）只展示操作指引，不进入自动执行队列。
- 移植后保持幂等：已领取/达标的任务自动跳过，重复执行不产生副作用或重复扣资源。
- 与插件既有面板、账号切换、额度/Token 统计面板共用同一前端框架与登录态，不引入独立后端进程。

## 涉及范围

| 模块 | 目录或入口 | 职责 |
| --- | --- | --- |
| 上游任务接口 | `plugins/dsh-codebuddy-plugin/src/host`（新增 growth tasks 客户端） | 移植列表/报名/领奖端点与字段口径，复用现有 AccessToken 与上报签名 |
| 成长任务执行 | `plugins/dsh-codebuddy-plugin/src/host` | 单任务推进（行为事件上报 → 轮询进度 → 自动领奖），与现有 per-account 锁互斥 |
| 任务中心 | `plugins/dsh-codebuddy-plugin/src/client` + host | 全账号扫描、执行队列状态机、实时进度 |
| 面板 UI | `plugins/dsh-codebuddy-plugin/src/client` | 成长任务列表、执行队列、不可自动化项指引 |
| 测试与文档 | `plugins/dsh-codebuddy-plugin/tests`、`docs/development` | 移植差异、测试与验收记录 |

## 功能列表

| 编号 | 优先级 | 功能 | 用户行为 | 状态 |
| --- | --- | --- | --- | --- |
| FNOS-005-01 | P1 | 成长任务列表与状态 | 在 CodeBuddy 面板选择账号后，展示其成长任务、进度、奖励、是否可自动化与是否已领取 | <Badge type="info" text="规划中" /> |
| FNOS-005-02 | P1 | 单任务/一键自动完成 + 自动领奖 | 对可自动化任务执行上报推进并轮询，进度达标后自动领奖；不可自动化任务只展示指引 | <Badge type="info" text="规划中" /> |
| FNOS-005-03 | P1 | 任务中心（全账号扫描 + 执行队列） | 一键扫描所有账号未完成成长任务，按账号排队执行，实时更新每条目状态，可配账号间并发 | <Badge type="info" text="规划中" /> |
| FNOS-005-04 | P2 | 不可自动化任务指引 | 对 `Expert_Philanthropy` 等需真实操作的任务只展示操作说明，不进入自动队列 | <Badge type="info" text="规划中" /> |

## 交互和行为约束

- 移植只复用 CodeBuddy 既有账号 AccessToken、上报指纹构造与 per-account 锁；不引入 `workbuddy2api-panel` 的账号池/面板进程。
- 成长任务计分依赖行为上报，不同任务所需客户端指纹（CLI/桌面/web/小程序）必须与来源保持一致；上报返回 200 不视为计分成功，必须轮询 `current/target` 达标后再领奖。
- 报名（accept）只针对 `accept_status` 非 `accepted`/`completed` 且未锁定的任务；领奖仅在 `claimable`（进度达标且未领取）时调用，重复领奖按幂等处理（上游 `already_claimed` 视为成功、无新增奖励）。
- 执行队列：账号内串行（复用 per-account 锁，与单任务/一键完成互斥），账号间受并发信号量约束（默认 1，范围 1–4）；队列运行中再次触发返回冲突，不覆盖正在进行的进度。
- 队列每次启动递增 `seq`，前端只渲染自己启动的那一轮；执行结束后的残留条目不得覆盖后续扫描结果。
- 不可自动化任务（需真实捐款/真实小程序沙箱对话等）显式排除在执行队列之外，仅在列表中标注原因与操作指引。
- 全账号扫描为只读操作，不触发任何上报或领奖；执行队列开始前先「批量报名未接受任务」以保证后续上报计数有效（来源已确认漏此步会导致进度一直 `not_accepted`、无法领奖）。
- 重复执行幂等：已领取/达标任务自动跳过，不重复扣资源；上报按天幂等。
- 移植行为只在已登录且持有有效 AccessToken 的账号上执行；凭据缺失或刷新失败时明确报错，不静默跳过。

## 不在本次范围内

- 开学季活动（`school.go` 及其独立状态卡/全账号闭环/抽奖）：能力来自同一来源但属独立活动，另立需求实施。
- `workbuddy2api-panel` 的账号池轮转、Web 面板、Redis 镜像、定时签到/旅行/保活等与本功能无关的能力。
- 对来源未覆盖任务的逆向（如 `Expert_Philanthropy` 真实捐款回执），本需求不尝试绕过。

## 验收条件与完成状态

### FNOS-005-01 验收条件

- `FNOS-005-01-AC-01`：选择账号后，面板展示其成长任务列表，字段含 `task_code`、`title`、进度 `current/target`、奖励积分/能量、是否可自动化、`claimed` 状态，与来源 `upstream.Task` 口径一致。
- `FNOS-005-01-AC-02`：列表只读拉取，不触发任何上报或领奖；失败账号在列表中标注错误而非中断整体扫描。
- `FNOS-005-01-AC-03`：不可自动化任务（如 `Expert_Philanthropy`）在列表中明确标注「不可自动化」及原因。

### FNOS-005-02 验收条件

- `FNOS-005-02-AC-01`：对可自动化任务执行后，进度按来源判据推进；达标后自动调用领奖接口，界面显示到账积分/能量。
- `FNOS-005-02-AC-02`：已领取/达标任务再次执行自动跳过，无重复领奖、无重复扣资源（幂等）。
- `FNOS-005-02-AC-03`：未报名任务执行前先报名（accept），避免上报不计数；报名失败不阻塞行为上报但记录日志。
- `FNOS-005-02-AC-04`：凭据缺失或 AccessToken 刷新失败时明确报错，不静默跳过。

### FNOS-005-03 验收条件

- `FNOS-005-03-AC-01`：任务中心一键扫描全账号未完成的成长任务（可自动化项），列表按账号聚合，显示每账号待办数。
- `FNOS-005-03-AC-02`：执行队列账号内串行、账号间按配置并发（1–4）；运行中再次触发返回冲突，不覆盖进度。
- `FNOS-005-03-AC-03`：队列每条目状态（pending/running/done/skipped/error）实时可查；每次启动 `seq` 递增，前端只渲染本轮。
- `FNOS-005-03-AC-04`：不可自动化任务不进入队列；某账号被其它任务动作占用时该账号队列项标 `skipped`。
- `FNOS-005-03-AC-05`：队列执行结果与来源语义一致（单任务推进 + 自动领奖 + 进度文本），插件 typecheck、单元测试和构建通过。

### FNOS-005-04 验收条件

- `FNOS-005-04-AC-01`：不可自动化任务在面板展示操作说明与排除原因，不进入自动执行路径。

### 状态看板

| 阶段 | 状态 | 当前范围 | 下一步 |
| --- | --- | --- | --- |
| 成长任务列表与状态 | <Badge type="info" text="规划中" /> | 移植列表/报名/领奖端点，复用账号凭据与上报指纹 | 进入计划后补实现与测试 |
| 单任务/一键完成 + 自动领奖 | <Badge type="info" text="规划中" /> | 行为事件上报、轮询进度、Web 域领奖、幂等 | 进入计划后补实现与测试 |
| 任务中心扫描与队列 | <Badge type="info" text="规划中" /> | 全账号扫描 + 执行队列状态机 + 实时进度 | 进入计划后补实现与测试 |
| 不可自动化任务指引 | <Badge type="info" text="规划中" /> | 排除 `Expert_Philanthropy` 等并展示说明 | 进入计划后补实现与测试 |

## 变更记录

| 日期 | 变更 | 说明 |
| --- | --- | --- |
| 2026-09-14 | 新增 FNOS-005 | 记录把 workbuddy2api-panel 的 CodeBuddy 成长任务与任务中心移植到本仓库 CodeBuddy 插件的需求；开学季活动另立需求，不在本轮范围 |
