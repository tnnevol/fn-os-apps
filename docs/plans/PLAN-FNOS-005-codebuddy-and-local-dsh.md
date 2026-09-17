---
id: PLAN-FNOS-005
title: PLAN-FNOS-005 CodeBuddy 成长任务移植与仓库内 DSH 开发环境
description: 实施 FNOS-005-01 至 FNOS-005-16：移植成长任务与任务中心，提供管理后台「完成任务」按钮、弹框内单账号「一键完成」与任务执行日志抽屉，对齐来源的风控指纹与节流口径并修复「跑完但没完成」；并在仓库内安装固定版本 dsh CLI，让 start 以仓库根 .dsh 作为 DSH_HOME 启动本地 DSH Web，并自动内置仓库插件。
status: completed
owner: tnnevol
planDate: 2026-09-14
targetVersion: 5.4.0
lastVerified: 2026-09-17
---

# PLAN-FNOS-005 CodeBuddy 成长任务移植与仓库内 DSH 开发环境

| 字段 | 内容 |
| --- | --- |
| 计划编号 | PLAN-FNOS-005 |
| 计划日期 | 2026-09-14 |
| 对应需求 | [FNOS-005 CodeBuddy 成长任务移植与仓库内 DSH 开发环境](/requirements/FNOS-005-codebuddy-and-local-dsh) |
| 本轮功能 | `FNOS-005-01` 至 `FNOS-005-16`：成长任务列表与状态、单任务/一键完成 + 自动领奖、任务中心扫描与执行队列、不可自动化任务指引、运营周期开关收拢到管理面板、「完成任务」按钮、个人成长任务收拢到弹框、执行状态持久化、任务执行日志抽屉、单账号「一键完成」与跨账号互斥、风控指纹对齐与「跑完但没完成」修复，以及仓库内 DSH CLI、本地 DSH Web 启动目标、本地 `DSH_HOME` 与仓库插件自动内置 |
| 移植来源 | `workbuddy2api-panel`（`~/workspace/fork-pj/workbuddy2api-panel`） |
| 上游依据 | `@deepseek-ai/dsh@0.1.5-rc.2`（与 FPK 运行时基线一致） |
| 计划状态 | <Badge type="tip" text="已完成" /> |

## 计划目标

将 `workbuddy2api-panel` 的 CodeBuddy 成长任务能力移植到本仓库 CodeBuddy 插件：复用现有账号 AccessToken、行为事件上报指纹与 per-account 锁，实现成长任务列表/报名/进度回读/自动领奖，以及任务中心的全账号扫描与执行队列。开学季活动不在本轮范围。

同一计划把 DSH 开发环境纳入仓库：根依赖声明与 FPK 相同的 `@deepseek-ai/dsh@0.1.5-rc.2`，`fn-apps-cli start` 增加「DSH Web」启动目标，并以仓库根 `.dsh` 作为该实例的 `DSH_HOME`，使插件调试可以直接对着仓库锁定的运行时基线进行，profile 与凭据留在检出目录。本轮不修改 DSH 官方源码、profile 组合或 DSH CLI 参数语义，也不改变 FPK 的 DSH 版本策略、私有 CLI 安装方式与网关 Web 生命周期。

## 实现范围和边界

| 模块 | 计划入口 | 实现责任 |
| --- | --- | --- |
| 上游任务接口 | `plugins/dsh-codebuddy-plugin/src/host`（新增 growth tasks 客户端） | 移植列表/报名/领奖端点与字段口径，复用现有 AccessToken 与上报签名 |
| 成长任务执行 | `plugins/dsh-codebuddy-plugin/src/host` | 单任务推进（行为事件上报 → 轮询进度 → 自动领奖），与现有 per-account 锁互斥 |
| 任务中心 | `plugins/dsh-codebuddy-plugin/src/client` + host | 全账号扫描、执行队列状态机、实时进度 |
| 面板 UI | `plugins/dsh-codebuddy-plugin/src/client` | 成长任务列表、执行队列、不可自动化项指引；自动签到/自动旅行开关保留在此 |
| 运营周期开关边界 | `plugins/dsh-codebuddy-plugin/src/client/ui`、`src/components` | 两个开关只在管理面板；设置页不渲染，避免同一件事两个入口 |
| 管理后台操作区 | `plugins/dsh-codebuddy-plugin/src/client` + host RPC | 提供「完成任务」按钮：串起成长任务（领养前置）、签到与旅行 |
| 根依赖清单 | `package.json`、`pnpm-lock.yaml` | 声明 `@deepseek-ai/dsh@0.1.5-rc.2`，并补声明 pnpm 隔离布局下不可解析的 `@deepseek-ai/dsh-llm-pi-ai@0.1.5-rc.2` |
| 依赖安装策略 | `pnpm-workspace.yaml` | 显式拒绝 DSH 原生依赖（node-pty、koffi）的安装脚本，去掉交互式占位值 |
| 启动命令 | `tooling/fn-os-apps-cli/src/commands/start.ts`、`src/core/turbo.ts`、`src/core/process.ts`、`src/config/paths.ts`、`src/ui/prompts.ts` | 增加 `--web` 与「DSH Web」启动目标、本地 CLI 解析、`DSH_HOME` 注入与子进程环境构造 |
| 本地 DSH_HOME | 仓库根 `.dsh/`（不提交） | 保存本地 profile、凭据、会话与插件调试状态 |
| 忽略规则 | `.gitignore` | 排除 `.dsh/` |
| 文档与测试 | `docs/development`、`tooling/fn-os-apps-cli/tests/start.spec.ts` | 记录开发环境入口、端口与 `DSH_HOME` 归属；覆盖启动分支与组合约束 |

本轮不移植 `workbuddy2api-panel` 的账号池、Web 面板、Redis 镜像与开学季活动；不引入独立后端进程。本地 DSH 开发环境只覆盖仓库开发工具链，不涉及 FPK 产物。

## 分阶段任务

### P1：成长任务列表与状态

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T01-01 | FNOS-005-01-AC-01 | 移植 `upstream.Task` 列表口径，复用 AccessToken 拉取并展示 `task_code`/标题/进度/奖励/可自动化/已领取 | 字段与来源 `tasks.go` 一致，失败账号标注错误 |
| PLAN-FNOS-005-T01-02 | FNOS-005-01-AC-02/03 | 列表只读拉取，不触发上报/领奖；不可自动化任务标注原因与指引 | 扫描不写副作用，不可自动化任务有说明 |

### P1：单任务/一键完成 + 自动领奖

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T02-01 | FNOS-005-02-AC-01/03 | 复用来源行为事件指纹推进进度，执行前批量报名未接受任务，达标后 Web 域自动领奖 | 进度与领奖与来源语义一致 |
| PLAN-FNOS-005-T02-02 | FNOS-005-02-AC-02/04 | 幂等跳过已领取/达标项，凭据缺失或刷新失败明确报错 | 重复执行无副作用，错误可见 |

### P1：任务中心扫描与队列

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T03-01 | FNOS-005-03-AC-01 | 一键扫描全账号未完成可自动化成长任务，按账号聚合与计数 | 只读扫描结果正确 |
| PLAN-FNOS-005-T03-02 | FNOS-005-03-AC-02/03/04 | 执行队列账号内串行、账号间并发 1–4，`seq` 递增，运行中冲突返回，不可自动化项与占用账号标 skipped | 队列语义与来源一致，实时进度可查 |

### P2：不可自动化任务指引

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T04-01 | FNOS-005-04-AC-01 | 排除 `Expert_Philanthropy` 等并展示原因与操作说明 | 不进入自动执行路径 |

### P1：运营周期开关收拢到管理面板

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T05-01 | FNOS-005-05-AC-01/02 | 「自动签到」「自动旅行」开关保留在管理面板（控制 Host 周期启停）；设置页移除这两个开关 | 面板可启停运营周期，设置页无重复入口 |
| PLAN-FNOS-005-T05-02 | FNOS-005-05-AC-03/04 | 自动签到用 `setInterval` 定时间隔：开启即跑一轮，之后每 30 分钟一轮（对齐 `workbuddy-switch` 的 `CHECKIN_RECOVERY_INTERVAL`）；每轮先查状态、已签到跳过；连续 3 轮全失败才退避（30 分钟起、指数递增、上限 8 倍，冷却后自动恢复） | 周期按 30 分钟触发且幂等；退避可自愈，不永久停止 |

### P1：签到与旅行并入「完成任务」

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T06-01 | FNOS-005-06-AC-01/02/03 | 签到并入「完成任务」：逐账号判断，已签到跳过、企业账号跳过；去掉独立一键签到按钮 | 已签到不重复提交，动作区无独立按钮 |
| PLAN-FNOS-005-T06-02 | FNOS-005-06-AC-04/05 | 旅行同样并入：在途/今日已旅行跳过、arrived 领奖；任务按依赖序执行，领养（first_buddy）为**第一个**任务 | 旅行不重复派发，领养先于旅行 |
| PLAN-FNOS-005-T06-03 | FNOS-005-06-AC-06/07 | 两条旅行路径（自动周期与「完成任务」）在派发前查 `buddy/info`；无猫先领养（上报 → 协议 → buddy/first）再继续旅行；门槛未达记当日已试 | 无猫账号不再空转，领养后能接着派发 |

### P1：管理后台「完成任务」按钮

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T07-01 | FNOS-005-07-AC-01/02/04 | 按钮放在「添加账号」右侧（间距 10px）、文案「完成任务」，点击进入 loading 并触发全账号可自动化任务队列；不可自动化项排除，运行中防重复触发 | 按钮位置与 loading 交互正确，执行状态可见 |
| PLAN-FNOS-005-T07-02 | FNOS-005-07-AC-03 | 队列结束后回读真实成长任务状态和自动领奖结果 | 展示最终进度与到账结果 |

### P1：个人成长任务收拢到账号信息弹框

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T08-01 | FNOS-005-08-AC-01/02 | 账号信息弹框在「用量信息」后新增「成长任务」Tab，只渲染当前账号；弹框加大一档 | 个人详情不再出现在页面级区块，弹框不溢出 |
| PLAN-FNOS-005-T08-02 | FNOS-005-08-AC-03 | 刷新按钮移入成长任务 Tab 内部；移除页面级成长任务区块与其刷新入口 | 弹框内可独立刷新 |
| PLAN-FNOS-005-T08-03 | FNOS-005-08-AC-04 | 任务列表容器限定 `min(52vh, 620px)` 高度并 `overflow-y: auto`，与用量信息资源列表同口径；工具栏留在容器外 | 任务多时列表内滚动，弹框高度稳定 |
| PLAN-FNOS-005-T08-04 | FNOS-005-08-AC-05/06 | 列表内新增「未完成 / 已完成」二级 button Tab（默认未完成、各带数量与空态）；分组抽为纯函数，只按 `claimed` 判定 | 达标未领奖仍留在未完成栏 |

### P1：成长任务执行状态持久化

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T09-01 | FNOS-005-09-AC-01 | 宿主在 begin/finish 时原子落盘运行状态，并新增 `growthRunStatus` RPC；客户端 mount 时采纳 | 刷新页面后按钮保持 loading |
| PLAN-FNOS-005-T09-02 | FNOS-005-09-AC-02 | 结束以宿主状态收尾解除 loading；孤儿 running 超预算判定为已结束 | 不出现永久 loading，也不出现刷新后按钮复活 |

### P1：任务执行日志抽屉

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T10-01 | FNOS-005-10-AC-01/02/08 | 底部 SideSheet + 自渲染终端风格日志（CodeHighlight 无法分段着色）；点「完成任务」自动展开，动作区另有「查看日志」按钮（不带 loading/disabled） | 每行含时间/账号/任务/状态且分字段着色；按钮随时可点 |
| PLAN-FNOS-005-T10-02 | FNOS-005-10-AC-03/04/05 | 宿主每条处理完即 `appendGrowthRunLog` 落盘（串行队列、条数上限）；一轮开始/每账号开始/结束均落具体日志；抽屉仅在展开且执行中轮询并先立刻拉一次 | 执行中逐条追更，无长时间空态 |
| PLAN-FNOS-005-T10-03 | FNOS-005-10-AC-06/07/09/10/11/12/13/14/15/16/17/18 | 抽屉占 `50vh`，上半屏用 DSH mask token + `backdrop-filter` 做半透明磨砂；日志区固定高度内部滚动，内容区 `border-box` 消除假滚动条；深色底与滚动条同层；底部留 15px；状态按结局着色（未完成红/完成跳过绿/一半黄）；日志覆盖各阶段并给最后一行加等待动效 | 背景可辨认，短日志无滚动条，底部不贴边，长请求不静默，进行中可见 |

### P1：仓库内安装 DSH CLI

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T11-01 | FNOS-005-11-AC-01 | 根 `package.json` 增加 `@deepseek-ai/dsh@0.1.5-rc.2`，版本与 FPK 运行时基线一致 | `node_modules/.bin/dsh --version` 输出 `0.1.5-rc.2` |
| PLAN-FNOS-005-T11-02 | FNOS-005-11-AC-01 | 补声明 `@deepseek-ai/dsh-llm-pi-ai@0.1.5-rc.2`：它是 `@deepseek-ai/dsh-base` 的依赖，但 pnpm 的 `.pnpm` 隔离布局使其不在 `dsh` 的可见解析路径上，导致 profile 首次启动报 `ERR_MODULE_NOT_FOUND` | 本地 `dsh web` 能装载 `llm-pi-ai` 行并完成启动 |
| PLAN-FNOS-005-T11-03 | FNOS-005-11-AC-02 | `pnpm-workspace.yaml` 的 `allowBuilds` 把 `@deepseek-ai/dsh-subprocess-local`、`koffi`、`node-pty` 显式置为 `false`，替换 pnpm 写入的交互式占位值 | `pnpm install` 非交互完成且不再提示人工批准构建脚本 |

### P1：start 增加本地 DSH Web 启动目标

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T12-01 | FNOS-005-12-AC-01 | `StartSelection` 增加 `web`，`askStartSelection` 多选加入「DSH Web」条目 | 交互多选出现三个目标，选择 DSH Web 后命令启动 |
| PLAN-FNOS-005-T12-02 | FNOS-005-12-AC-02 | 注册 `start --web`，参数模式直接进入 DSH Web 分支；端口固定 3150，与 FPK 网关的 `127.0.0.1:3080` 区分 | `pnpm run start -- --web` 输出 `http://127.0.0.1:3150/?token=…` |
| PLAN-FNOS-005-T12-03 | FNOS-005-12-AC-03 | DSH Web 实现为 Turbo 根任务 `//#dev:web`（`persistent` + `passThroughEnv: ["DSH_HOME"]`），与 `dev` 一起交给同一个 `turbo watch`，保留 TUI 且各占一行 | `pnpm run start -- --web --docs` 在同一个 TUI 中同时起 3150 与 9876 |
| PLAN-FNOS-005-T12-04 | FNOS-005-12-AC-04 | 未选择 DSH Web 时保持原路径：`turbo watch dev` 统一调度插件与文档，文档端口仍为 9876 | `pnpm run start -- --docs` 仅启动 watch |

### P1：本地 DSH_HOME 指向仓库根 .dsh

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T13-01 | FNOS-005-13-AC-01 | `paths.ts` 新增 `dshHomeDirectory = <仓库根>/.dsh`，`runDevCommand` 注入子进程 `DSH_HOME` | `<仓库根>/.dsh/profiles/` 下出现 profile |
| PLAN-FNOS-005-T13-02 | FNOS-005-13-AC-02 | 子进程环境清除 `DSH_SESSION_ID`、`DSH_SHELL`、`DSH_WEB_URL`；不改写 `HOME` | `$HOME/.dsh` 的 profile 与凭据不被本次启动写入 |
| PLAN-FNOS-005-T13-03 | FNOS-005-13-AC-03 | `.gitignore` 增加 `.dsh/` | `git status` 不显示 `.dsh/` |
| PLAN-FNOS-005-T13-04 | FNOS-005-13-AC-04 | `resolveDshBinary` 只接受仓库 `node_modules/.bin/dsh`，缺失时提示先执行 `pnpm install` | 不因 `PATH` 顺序使用全局 `dsh` |
| PLAN-FNOS-005-T13-05 | FNOS-005-12-AC-01/03 | 新增 `tests/start.spec.ts` 覆盖启动分支、组合约束与取消路径 | `vitest run` 全部通过 |

### P1：仓库插件内置进本地 profile

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T14-01 | FNOS-005-14-AC-01 | 新增 `src/core/local-profile.ts`：启动 DSH Web 前先用 `turbo run build` 构建待链接插件，再逐个 `dsh plugin --profile web add <插件目录>` | 新克隆的检出目录启动后 profile 含仓库插件，且各插件 `lib/` 产物已就绪 |
| PLAN-FNOS-005-T14-02 | FNOS-005-14-AC-02 | 链接走 DSH CLI 而不是直接改写 profile 清单，由 CLI 的 `reconcilePlugins` 把插件同步进 `dsh.profile.bundles` | `--dump-config` 中三个插件各成一行 patch layer |
| PLAN-FNOS-005-T14-03 | FNOS-005-14-AC-03 | 已链接且已在 bundle 列表中的插件跳过安装 | 第二次启动无 `Linking` 日志，Turbo 全量缓存命中 |
| PLAN-FNOS-005-T14-04 | FNOS-005-14-AC-04 | 内置范围显式排除 `@tnnevol/dsh-fnos` | 本地 profile 的依赖与 bundle 列表不含 `@tnnevol/dsh-fnos` |
| PLAN-FNOS-005-T14-05 | FNOS-005-14-AC-01/02/03/04 | 新增 `tests/local-profile.spec.ts` 覆盖排除规则、构建与链接命令、已链接跳过、仅依赖未入 bundle 时重链 | `vitest run` 全部通过 |

### 详细交互：仓库插件内置进本地 profile

1. 选择 DSH Web 后，CLI 先解析应在本地 profile 中启用的仓库插件（当前为 Codex Auth、Semi UI 总览、CodeBuddy）。
2. 通过 `turbo run build` 构建这些插件：profile 经包 `exports` 解析入口，入口指向 git 忽略的 `lib/`，没有产物时 `dsh plugin add` 会链到一个无法加载的包。
3. 读取本地 profile 清单，逐插件判断是否已 `link:<插件目录>` 且已列入 `dsh.profile.bundles`；未满足的先打印 `Linking <包名> into web profile`，再执行 `dsh plugin --profile web add <插件目录>`。
4. 全部就绪后启动 `dsh web --no-open --port 3150`。首次启动的 profile 由 DSH CLI 自动初始化；插件的最小运行依赖（如 CodeBuddy 的 `echarts`、`nanostores`）由 pnpm 装在 profile 目录内。
5. 重复启动时不再链接、不再安装，插件产物变更由 `start` 的插件 watch 或重新构建生效。
6. `@tnnevol/dsh-fnos` 始终不进入本地 profile：它注册 fnOS 设置命名空间、fnOS JS SDK 桥和网关前缀路由，脱离 fnOS 宿主无可用能力。

### 详细交互：本地 DSH Web

1. 开发者执行 `pnpm run start`，CLI 弹出启动多选，条目依次为「Harness 插件」「项目文档」「DSH Web」；DSH Web 的提示文案说明它使用仓库根 `.dsh` 作为 `DSH_HOME` 并监听 3150。
2. 只选择「DSH Web」并确认后，CLI 先按上一节把仓库插件链接进本地 profile，再解析仓库 `node_modules/.bin/dsh`，以仓库根为工作目录启动 `dsh web --no-open --port 3150`。
3. DSH Web 就绪后在终端打印带 token 的访问地址；终端保持被该进程占用，`Ctrl+C` 结束本地 Web。
4. 直接执行 `pnpm run start -- --web` 跳过询问，行为与第 2、3 步一致。
5. DSH Web 可与「Harness 插件」「项目文档」同时选中：三者由同一个 `turbo watch` 调度，DSH Web 作为 `//#dev:web` 与 `dev` 并列显示在同一个 TUI 中。
6. 若选择被取消，或只选了「Harness 插件」但没有选中任何插件，CLI 不启动任何服务并正常退出。
7. 本地首次启动会在仓库根创建 `.dsh/`：`profiles/web` 由 DSH CLI 自动初始化，凭据、会话与本地插件调试数据都写入该目录；开发者的 `$HOME/.dsh` 保持不变。

| 错误情况 | 表现 |
| --- | --- |
| 仓库未安装 dsh | 报 `DSH CLI is missing; run \`pnpm install\` at the repository root first`，不落回全局 `dsh` |
| 同时选择互斥目标 | 报错并退出，不启动任何目标 |
| 本地 Web 端口被占用 | 由 DSH 自身报 `EADDRINUSE` 并退出，CLI 原样透传 |

### P1：单账号「一键完成」与跨账号执行互斥

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T15-01 | FNOS-005-15-AC-01/02/06 | 「成长任务」Tab 工具栏在刷新按钮**左侧**加「一键完成」，只对当前账号执行全部可自动化任务（报名 → 上报 → 回读 → 领奖）；点下即展开同一份日志抽屉；用 `loading` 表达本账号执行中并由处理函数挡住重入 | 按钮位置与文案正确，只影响本账号，重入被挡 |
| PLAN-FNOS-005-T15-02 | FNOS-005-15-AC-03/04/05/07 | 宿主把「单一全局 `growthTasksGuard`」改为**按账号互斥**（同账号单项与一键完成共用一把锁，不同账号并行）；`growthRunStatus` 因此上报哪些账号在跑；客户端据此禁用账号管理页「完成任务」与该账号的单项按钮，其他账号保持可点；结束以宿主状态收尾 | 运行中禁用范围以账号为界，刷新页面后仍成立，无永久 loading |
| PLAN-FNOS-005-T15-03 | FNOS-005-15-AC-03/04 | 运行态模型从「单个 mode/accountId」升级为「运行中账号集合 + 全量轮次」，`isBlockedByRunAll` 与单项判断改读该集合；落盘兼容旧状态文件 | 旧状态文件仍可读，禁用范围判定由单测守住 |

### P1：风控指纹对齐与「跑完但没完成」修复

状态：<Badge type="tip" text="已完成" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-005-T16-01 | FNOS-005-16-AC-01 | 行为上报与 growth/billing 域出站补齐来源头族：`X-CodeBuddy-Request: 1`、按 uid 稳定派生的 `X-Machine-ID` / `X-Session-ID`（跨重启恒定、账号间互异）、桌面链三段式 UA 与 `X-Product`/`X-Domain` | 头族与来源一致，派生 Id 稳定且按账号互异 |
| PLAN-FNOS-005-T16-02 | FNOS-005-16-AC-02 | 对齐节流口径：连续上报间隔 1.05s（`chat_5` 补报、模板链、夜间补足）、专家召唤链 6s、账号之间限速；`accept` 批量报名保持批间节流 | 间隔为可测常量，批量执行不瞬时打满上游 |
| PLAN-FNOS-005-T16-03 | FNOS-005-16-AC-03/05 | 专家类任务改用**真实对话**返回的服务端 `requestId`（`cmb-`/裸 32 hex 校验），拿不到即计失败而不是自造 id；`Expert_lighthouse` 用 `mode:"LOCAL"`、`type` 空、`cost:0`；`Library_read` / `template_5` / `Hp_Appearance` 按来源判据形态发送 | 判据与来源一致，自造 id 不再出现 |
| PLAN-FNOS-005-T16-04 | FNOS-005-16-AC-04 | 桌面链事件载荷补全为来源的完整字段集（`agent_task_created` 能力标志组、`chat_message_response` token 与 `finishReason`、`chat_request_response` 成功态、`codebuddy.*` 关联键）；`skill_1` 的 `finishReason` 用 `tool_calls` | 载荷字段集与来源一致，不用最小字段集 |
| PLAN-FNOS-005-T16-05 | FNOS-005-16-AC-06/07 | 执行结束后按账号回读真实任务状态：未达标写 `pending` + 进度（区分零进度与做了一半），「动作已发送」不汇报为「已完成」；失败原因分类可见；未完成数计入结果，单账号失败不阻断其他账号 | 日志与结果如实反映未完成项 |

### 详细交互：单账号「一键完成」

1. 用户在账号管理页点账号卡片打开「账户信息」弹框，切到「成长任务」Tab。
2. 工具栏出现「一键完成」与「刷新」两个按钮，一键完成在左。点「一键完成」后按钮进入 loading，并立即展开底部日志抽屉（复用与「完成任务」同一份宿主日志）。
3. 宿主只对该账号加锁并执行全部可自动化任务；其他账号此刻点「一键完成」或单项「完成」仍可真实执行（不同账号可并行）。
4. 同一时间，账号管理页的「完成任务」（全账号）按钮变为禁用，直到本账号执行结束。
5. 执行结束后按宿主状态收尾：按钮解除 loading，任务列表自动重载真实进度。

| 错误情况 | 表现 |
| --- | --- |
| 该账号已有成长任务在跑 | 宿主返回冲突，按钮不进入 loading，提示已有执行在途 |
| 凭据已过期 | 该账号结果标 `error` 并写明 `refresh token expired`，不静默跳过 |
| 任务动作未移植 | 该任务标 `unsupported` 并展示原因，不计入完成 |

## 完成状态

| 阶段 | 状态 | 完成条件 |
| --- | --- | --- |
| P1 成长任务列表与状态 | <Badge type="tip" text="已完成" /> | 列表只读展示进度/奖励/可自动化/已领取，不可自动化项有说明 |
| P1 单任务/一键完成 + 自动领奖 | <Badge type="tip" text="已完成" /> | 行为事件推进 + 轮询达标 + 自动领奖 + 幂等 |
| P1 任务中心扫描与队列 | <Badge type="tip" text="已完成" /> | 全账号扫描 + 执行队列状态机 + 实时进度 |
| P2 不可自动化任务指引 | <Badge type="tip" text="已完成" /> | 排除并展示说明 |
| P1 运营周期开关收拢到管理面板 | <Badge type="tip" text="已完成" /> | 两个开关只在管理面板可操作；设置页不渲染 |
| P1 签到与旅行并入「完成任务」 | <Badge type="tip" text="已完成" /> | 逐账号签到 + 推进旅行，已完成项跳过；领养前置 |
| P1 管理后台「完成任务」按钮 | <Badge type="tip" text="已完成" /> | 紧贴「添加账号」右侧、loading 交互，触发队列并回读结果 |
| P1 个人成长任务收拢到弹框 | <Badge type="tip" text="已完成" /> | 弹框成长任务 Tab、弹框加大、刷新入 Tab、列表限高可滚动、未完成/已完成分栏、页面级区块移除 |
| P1 执行状态持久化 | <Badge type="tip" text="已完成" /> | 运行态落盘宿主，刷新后仍为 loading，结束后解除 |
| P1 任务执行日志抽屉 | <Badge type="tip" text="已完成" /> | 底部抽屉半屏 + 磨砂蒙层；日志内部滚动；含常驻「查看日志」按钮 |
| P1 仓库内安装 DSH CLI | <Badge type="tip" text="已完成" /> | 根依赖与 FPK 同版本；`pnpm install` 非交互完成 |
| P1 start 增加本地 DSH Web 启动目标 | <Badge type="tip" text="已完成" /> | `--web` 与交互多选可用；固定 3150；与 Turbo watch 目标互斥 |
| P1 本地 DSH_HOME 指向仓库根 .dsh | <Badge type="tip" text="已完成" /> | 启动注入 `DSH_HOME`；profile 落在仓库内；`.dsh/` 不进入版本库 |
| P1 仓库插件内置进本地 profile | <Badge type="tip" text="已完成" /> | 先构建再经 DSH CLI 链接；已在 bundle 中的跳过；排除 `@tnnevol/dsh-fnos` |
| P1 单账号「一键完成」与跨账号互斥 | <Badge type="tip" text="已完成" /> | 弹框内刷新左侧新增按钮；宿主按账号加锁；运行中禁用全账号按钮与该账号单项按钮，其他账号不受影响 |
| P1 风控指纹对齐与「跑完但没完成」修复 | <Badge type="tip" text="已完成" /> | 头族与节流对齐来源；专家类任务用真实 chat requestId；按账号回读并如实汇报未达标 |

## 变更记录

| 日期 | 变更 | 说明 |
| --- | --- | --- |
| 2026-09-14 | 建立 PLAN-FNOS-005 | 配套 FNOS-005 建立实施计划骨架，范围锁定成长任务与任务中心；开学季活动不在本轮 |
| 2026-09-14 | 补充运营周期开关边界 | 新增 T05-01，约束成长任务移植不新增、不复制既有自动签到/自动旅行配置 |
| 2026-09-14 | 最终定位：开关只在管理面板 | 曾两处都删（开关不可见但 Host 周期仍跑）、也曾两处都留（两个入口）；现收拢到管理面板、设置页移除，T05-01 与验收条件同步改写 |
| 2026-09-15 | 补充签到节奏说明 | 新增 T05-02：把「开启即跑 + 每 30 分钟一轮」的既有行为写进计划，并记录退避阈值与其余周期间隔 |
| 2026-09-14 | 撤销隐藏开关，恢复 T05-01 | 实施中曾移除管理面板与设置页的两个开关，导致开关不可见而 Host 周期仍默认开启；现恢复原位置与行为，T05-01 改为「保持不变」 |
| 2026-09-14 | 新增管理后台快捷操作 | 新增 T06-01/T06-02 一键签到与 T07-01/T07-02 一键完成成长任务，明确按钮状态、跳过规则、防重复和结果回读 |
| 2026-09-14 | PLAN-FNOS-005 完成实现与自验 | 全部阶段任务已落地；插件 56 个测试文件/670 条测试、构建、根全量检查和 CodeBuddy/WorkBuddy 实际账号列表接口测试通过 |
| 2026-09-14 | 调整成长任务 UI 与执行状态 | 新增 T08-01/T08-02（个人详情入弹框 Tab、弹框加大、刷新入 Tab）与 T09-01/T09-02（运行态落盘宿主、刷新后保持 loading）；T07 改为「完成任务」按钮并移到「添加账号」右侧、点击 loading |
| 2026-09-14 | 成长任务列表限高滚动 | 新增 T08-03：列表容器限定 `min(52vh, 620px)` 并 `overflow-y: auto`，与用量信息资源列表同口径；同时把「完成任务」按钮配色对齐「添加账号」 |
| 2026-09-14 | 成长任务列表分栏 | 新增 T08-04：Tab 内再分「未完成 / 已完成」两栏（默认未完成），分组抽为纯函数并只按 `claimed` 判定 |
| 2026-09-14 | 新增任务执行日志抽屉 | 新增 T10-01/T10-02：底部 SideSheet + CodeHighlight 展示逐条日志，宿主每条落盘、抽屉执行中追更 |
| 2026-09-14 | 去掉动作区的日志按钮 | 抽屉改为只由「完成任务」唤起（曾加过手动入口），T10-01 相应收紧 |
| 2026-09-14 | 签到与旅行并入「完成任务」 | T06-01/T06-02 改写：去掉独立一键签到按钮，改为在「完成任务」内按「领养 → 其余任务 → 签到 → 旅行」执行，已完成项跳过 |
| 2026-09-14 | 日志抽屉观感与入口调整 | 新增 T10-03；T10-01 加回「查看日志」按钮（不带 loading/disabled），T10-02 补「开始/读取任务列表/结束」日志以消除空态 |
| 2026-09-14 | 修掉日志抽屉假滚动条 | T10-03 补 `box-sizing: border-box` 与 `overflow: hidden` 约束 |
| 2026-09-14 | 日志改用终端风格 | T10-01 从 CodeHighlight 改为自渲染逐行；T10-03 增加「滚动条与底色同层」与「状态语义着色」两条约束 |
| 2026-09-14 | 抽屉底部留白 | T10-03 增加 15px 底部留白约束（限本组件作用域） |
| 2026-09-14 | 领养前置与日志增强 | T06-02 明确领养为第一个任务；T10-03 增加「按结局着色」「各阶段都有日志」「等待动效」约束 |
| 2026-09-14 | 单项任务复用日志抽屉 | T10-03 增加 AC-14：单项执行也打开同一抽屉，层级高于 Modal |
| 2026-09-14 | 单项日志立刻可见 + 全量禁用 | T10-03 增加 AC-15（本地乐观日志）与 AC-16（全量执行禁用单项） |
| 2026-09-15 | 日志改虚拟滚动 + 缓存两轮 | T10-03 增加 AC-17（Semi Table 虚拟化）与 AC-18（仅保留两轮、不按条裁剪） |
| 2026-09-14 | 旅行增加领养前置 | 新增 T06-03：无猫时先领养再旅行；`hasBuddy` 只认显式 null，门槛未达当日不再重试 |
| 2026-09-15 | 并入本地 DSH 开发环境 | 计划主题扩展为「CodeBuddy 成长任务移植与仓库内 DSH 开发环境」（文档同步改名），新增 T11/T12/T13：仓库内安装固定版本 dsh CLI、`start` 增加本地 DSH Web 目标、本地 `DSH_HOME` 指向仓库根 `.dsh`，并补详细交互与错误反馈 |
| 2026-09-15 | 明确端口与组合约束 | T12-02 固定本地端口 3150（与 FPK 网关 3080 区分）；T12-03 起初约束三者不能同时启动 |
| 2026-09-15 | T12-03 改为 Turbo 根任务 | 先前用 `--ui=stream` 关闭 TUI 的做法被用户否决（要求保留 TUI 多任务形态）；T12-03 改为把 DSH Web 做成根任务 `//#dev:web`，与 `dev` 同处一个 `turbo watch`。实测三类目标全选时日志为 `//#dev:web, dev in 5 packages`，3150 与 9876 同时可访问 |
| 2026-09-15 | 补齐依赖安装策略 | T11-02 补 `@deepseek-ai/dsh-llm-pi-ai` 根依赖以修复 profile 首次启动的 `ERR_MODULE_NOT_FOUND`；T11-03 用 `allowBuilds` 显式拒绝原生依赖安装脚本，保持 `pnpm install` 非交互 |
| 2026-09-15 | 回归验证 | CLI typecheck/build 通过；`tests/start.spec.ts` 与 `tests/version.spec.ts` 共 10 条用例通过；`pnpm run start -- --web` 实测输出 3150 地址，`--web --docs` 组合报错退出 |
| 2026-09-15 | 仓库插件内置进本地 profile | 新增 T14：启动 DSH Web 前先用 Turbo 构建、再经 `dsh plugin --profile web add` 把仓库插件链接进本地 profile，使新克隆的检出目录也能直接进入带插件的 DSH Web；按用户要求排除 `@tnnevol/dsh-fnos` |
| 2026-09-17 | 新增 T15：单账号「一键完成」与按账号互斥 | 用户要求弹框内提供单账号一键完成、且该账号在跑时禁用账号管理页「完成任务」而其他账号不禁用。原实现是单一全局 `growthTasksGuard`，其他账号按钮虽可点但会被宿主判重拒绝——因此必须把宿主改成按账号加锁（T15-02），否则「其他账号不禁用」只是表面成立。运行态模型随之从单个 `mode/accountId` 升级为账号集合（T15-03） |
| 2026-09-17 | 新增 T16：风控指纹对齐与「跑完但没完成」修复 | 用户反馈「任务跑完了但实际没跑完，要到弹框里一个个点」。逐条比对来源后确认两类差异：① 出站指纹与节流未对齐（缺 `X-CodeBuddy-Request`/`X-Machine-ID`/`X-Session-ID`、上报间隔与账号限速缺失），未对齐时上游可能受理但静默不计分；② 部分判据与来源不一致（专家类自造 requestId 不计数、`Expert_lighthouse` 的 mode/type/cost 形态、桌面链字段集不足）。同时把「动作已发送」与「任务已完成」在结果与日志里彻底分开（T16-05） |
