---
id: PLAN-FNOS-003
title: PLAN-FNOS-003 FPK 应用运行设置统一
description: 审计并为需要运行参数的 fnOS FPK 应用补齐 wizard/config，同时完成 FNOS-002 遗留的 DSH FPK、网关和插件管理面板目标环境验收。
status: planning
owner: tnnevol
planDate: 2026-08-31
targetVersion: 5.3.1
lastVerified: 2026-09-08
---

# PLAN-FNOS-003 FPK 应用运行设置统一

| 字段 | 内容 |
| --- | --- |
| 计划编号 | PLAN-FNOS-003 |
| 计划日期 | 2026-08-31 |
| 对应需求 | [FNOS-003 FPK 应用运行设置统一](/requirements/FNOS-003-fpk-runtime-settings) |
| 计划状态 | <Badge type="info" text="规划中，含 FNOS-002 遗留验收" /> |

## 计划目标

为确实存在可修改运行参数的 FPK 应用建立 `wizard/config`，复用安装向导中的运行字段契约，并在保存后通过 `cmd/config_callback` 安全应用变更。计划先完成全量审计，再按应用差异实现，不默认给所有应用增加配置页。

本计划不修改 fnOS 平台协议，不把 `cmd/main` 改造成配置处理器，也不把一次性安装参数暴露为运行设置。FNOS-002 遗留验收只修复验证中发现的集成问题，不重新实现已经落地的插件和网关功能。

自 PLAN-FNOS-002 迁入的 CodeBuddy 多账号与管理面板计划，承载 `FNOS-003-08`、`FNOS-003-09`：多账号存储与切换、额度阈值自动切换、签到、额度/有效期查看和 Token 统计 ECharts 面板的本地实现已完成，本计划负责补充回归测试并在真实 NAS 验收。

## 实现范围和边界

| 模块 | 计划入口 | 实现责任 |
| --- | --- | --- |
| 应用清单 | `apps/*/manifest`、`wizard/install` | 盘点运行字段、安装字段、默认值和校验规则 |
| 运行设置 | 目标应用 `wizard/config` | 为可修改运行参数生成 fnOS 应用设置表单 |
| 生命周期 | `cmd/main`、`cmd/config_init`、`cmd/config_callback` | 读取配置、维护状态、保存后重载或重启 |
| FPK 构建 | 应用构建脚本和根 `build` CLI 入口 | 打包配置文件并验证安装产物 |
| 文档与测试 | `docs/`、应用测试目录 | 记录选择依据并验证设置、升级和 NAS 行为 |
| CodeBuddy 插件 | `plugins/dsh-codebuddy-plugin` | 维护多账号凭据、额度阈值自动切换、签到和 Token 统计面板，并补充回归测试 |

## 目标架构和数据流

```text
wizard/install 中的运行字段
        ├─ 安装阶段：初始化应用
        └─ wizard/config：应用设置中的运行配置
                         │ 保存
                         ▼
                   wizard_* 环境变量
                         │
                         ▼
                cmd/config_callback
                         │
                 安全重载或重启
                         │
                         ▼
                    cmd/main status
```

安装字段只在确有运行时用途时复用；路径初始化、首次迁移和一次性账号创建等字段不得直接复制到运行设置。

## 分阶段任务

### P0：应用配置审计

状态：<Badge type="info" text="规划中" />

| 任务 ID | 实现内容 | 验收 |
| --- | --- | --- |
| PLAN-FNOS-003-A01 | 盘点所有 `apps/*` 的 `wizard/install`、`wizard/config`、`cmd/main`、`cmd/config_init`、`cmd/config_callback` 和 `ctl_stop` | 形成应用配置审计表 |
| PLAN-FNOS-003-A02 | 区分运行参数、一次性安装参数和不可配置参数，确定目标应用清单 | 每个应用有纳入/不纳入理由 |
| PLAN-FNOS-003-A03 | 对目标字段确认变量名、类型、默认值、选项、校验和敏感信息处理 | 字段契约可被安装与运行脚本共同消费 |

### P1：运行设置与脚本接入

状态：<Badge type="info" text="规划中" />

| 任务 ID | 实现内容 | 验收 |
| --- | --- | --- |
| PLAN-FNOS-003-R01 | 为目标应用新增或补齐 `wizard/config`，只加入审计确认的运行字段 | 应用设置显示正确字段，不出现一次性参数 |
| PLAN-FNOS-003-R02 | 让 `wizard/install` 与 `wizard/config` 的运行字段保持契约一致，并使用 `wizard_*` 变量 | 安装后读取值与设置保存后的读取值一致 |
| PLAN-FNOS-003-R03 | 检查 `cmd/main`、`cmd/config_init` 和 `cmd/config_callback` 的读取和生效逻辑 | 保存后安全重载/重启，状态可查询 |

### P1：构建与目标环境验证

状态：<Badge type="info" text="规划中" />

| 任务 ID | 实现内容 | 验收 |
| --- | --- | --- |
| PLAN-FNOS-003-V01 | 执行应用级检查并构建 FPK | FPK 包含正确的 `wizard/config` 和脚本 |
| PLAN-FNOS-003-V02 | 在 NAS 安装、修改、保存、重启和升级目标应用 | 配置生效且用户数据保留 |
| PLAN-FNOS-003-V03 | 更新应用开发文档和导航，记录未纳入应用的原因 | 文档、菜单和实际能力一致 |

### P1：FNOS-002 遗留 DSH 集成验收

状态：<Badge type="info" text="规划中" />

| 任务 ID | 实现内容 | 验收 |
| --- | --- | --- |
| PLAN-FNOS-003-D01 | 使用当前项目版本 `5.3.1` 构建 DSH FPK，确认 DSH `0.1.2-rc.1`、插件兼容基线和插件发布版本 `0.1.2-rc.1.3` 对齐；重新生成 `app/bundled-dsh-plugins` | FPK 内置插件包与 `published-dsh-plugins.json` 精确一致 |
| PLAN-FNOS-003-D02 | 在真实 NAS 验证 DSH FPK 安装、升级、回滚、插件加载和用户数据/凭据/profile/工作区保留 | 安装生命周期不重复安装、不丢失配置，版本检查结果正确 |
| PLAN-FNOS-003-D03 | 验证网关 API URL 反代即时生效、HTTP/SSE/WebSocket、权限、并发、异常注入和 DSH Web 恢复 | 全部场景通过，失败时不破坏网关和 DSH Web 状态 |
| PLAN-FNOS-003-D04 | 在真实 NAS 验证 Codex 动态模型目录刷新、失败回退、模型选择器同步，以及 CodeBuddy 多账号、自动切换、签到、额度和 Token 统计面板 | 页面可操作，数据和图表显示正确，刷新/重启后状态保留 |
| PLAN-FNOS-003-D05 | 更新 FNOS-002 的验收记录、需求状态和计划状态 | 需求、计划、验收记录与实际 NAS 版本和结果一致 |

### P1：CodeBuddy 多账号与管理面板（自 PLAN-FNOS-002 迁入）

状态：<Badge type="warning" text="代码已实现，待 NAS 验证" />

对应需求：`FNOS-003-08`、`FNOS-003-09`

| 任务 ID | 实现内容 | 验收 |
| --- | --- | --- |
| PLAN-FNOS-003-C01 | 将 CodeBuddy 单账号凭据迁移为可持久化的多账号结构，支持添加、重登录、重命名、删除和当前账号切换 | 多账号凭据独立保存；切换当前账号不丢失其它账号记录 |
| PLAN-FNOS-003-C02 | 增加额度不足时的账号故障转移、自动切换阈值、掉线探测和连续失败保护 | 低于阈值或额度被拒绝时切到可用账号，全部失败时退避且不影响后续请求 |
| PLAN-FNOS-003-C03 | 增加 `shell.overlay` 管理面板，提供账号、额度/有效期、签到和 Token 统计菜单；Token 图表使用 ECharts | 面板可进入、可操作，切换账号后额度与用量展示同步刷新 |
| PLAN-FNOS-003-C04 | 补充存储迁移、用量统计和面板交互测试，更新插件文档 | 类型检查、单元测试和 tsdown 构建通过；插件文档与面板能力一致 |
| PLAN-FNOS-003-C05 | 收敛状态源：Host 成为自动开关配置的唯一权威，客户端不再用 localStorage 反向覆盖 | Host 侧更新过的配置不被旧 localStorage 覆盖；老用户首次升级仍能迁移本地值 |
| PLAN-FNOS-003-C06 | 凭据文档的读-改-写串行化，并给切换加 CAS 期望当前账号 | 并发切换/改名/删除不互相覆盖；已删除账号不复活；过期期望值放弃切换而非覆盖 |
| PLAN-FNOS-003-C07 | 抽出主动/被动切换的纯决策模块，含冷却、最小收益差、候选下限与活跃请求避让 | 决策可用一组输入直接断言；额度未知时不切换；预期结果对相同输入稳定 |
| PLAN-FNOS-003-C08 | 遵守 `Retry-After`（有上限、可中断），并把已尝试账号收敛为请求级状态 | 被限流时有限等待后可继续；等待期间可被取消；同一请求不重复使用同一账号 |

## 详细交互

### P1：应用设置运行配置流程

1. 用户在 fnOS 应用中心打开目标应用的“应用设置”。
2. fnOS 根据 `wizard/config` 展示运行字段；首次打开显示已保存值或字段默认值。
3. 用户修改字段并统一点击保存；取消则不提交变更。
4. fnOS 保存成功后触发 `cmd/config_callback`，脚本检查应用状态并执行约定的重载或重启。
5. 页面重新读取应用状态和配置结果；失败时保留旧配置并展示错误，不伪造成功状态。
6. 没有运行字段的应用不展示空配置页；`ctl_stop=false` 仍按原规则隐藏启停控制。

### P1：CodeBuddy 管理面板流程

1. 用户在设置页或账号面板添加 CodeBuddy 账号，插件打开 OAuth 授权页并轮询换取令牌，凭据独立持久化。
2. 账号面板列出全部账号的额度、有效期和签到状态，可切换当前账号、重登录、重命名和删除。
3. 自动切换开启时，当前账号剩余额度低于阈值或请求被判定额度不足时，插件切到可用账号并刷新模型目录与用量展示。
4. Token 统计菜单按日展示输入/输出堆叠柱状图，支持 7/30/90 天范围、悬浮明细和图例。

## 数据、权限和错误处理

- 配置字段使用 fnOS `wizard/config` 支持的类型和校验，不在脚本中重复解析不一致的格式。
- 脚本通过 `${TRIM_*}` 访问应用路径，禁止写死安装目录；运行配置写入 fnOS 管理的配置来源。
- 配置回调失败时不得删除旧配置、用户数据、凭据或应用工作目录。
- 重载/重启前确认 PID 和应用状态，避免重复启动；完成后通过真实状态检查确认结果。
- 敏感字段不写入普通日志；目标 NAS 验证需检查权限和升级后的配置保留。

## 依赖、风险和决策

| 项目 | 风险或决策 | 处理方式 |
| --- | --- | --- |
| 应用选择 | 并非所有应用都有可运行时修改的参数 | 先审计，按字段用途决定是否增加 `wizard/config` |
| 安装与运行配置 | 直接复制可能暴露一次性字段或造成默认值漂移 | 只复用运行字段，建立字段契约检查 |
| 生命周期 | `cmd/main` 和 `cmd/config_callback` 职责不同 | main 只管生命周期，callback 只处理保存后的变更 |
| 启停控制 | `ctl_stop=false` 与运行设置无直接关系 | 两套能力分别按 manifest 语义验证 |
| 宿主差异 | 本地构建通过不代表应用中心能展示或保存 | 必须在真实 NAS 安装后验收 |

## 测试、打包和发布

### 脚本和应用级检查

- 检查目标应用的 `wizard/config` 字段与 `wizard/install` 运行字段一致。
- 对目标应用执行现有 typecheck、shell lint、单元测试和构建命令。
- 执行：

```bash
pnpm run build -- --fpk
pnpm run check -- --sdd --docs
```

### CodeBuddy 插件检查

```bash
pnpm --filter @tnnevol/dsh-codebuddy run typecheck
pnpm --filter @tnnevol/dsh-codebuddy run test:unit
pnpm --filter @tnnevol/dsh-codebuddy run build
```

测试覆盖多账号存储迁移、账号操作、额度与自动切换，以及 Token 统计数据聚合；本地已通过这些命令并保留测试通过记录。

### 真实 NAS 验证

- 安装目标 FPK，确认应用设置出现预期运行字段。
- 修改并保存字段，确认 `cmd/config_callback` 执行且应用运行参数已更新。
- 验证应用停止、启动、状态查询和配置回调不会创建重复进程。
- 升级后确认运行配置、用户数据、凭据和工作目录保留。
- 对未纳入目标清单的应用确认没有新增空的运行设置入口。
- 在真实 NAS 完成 CodeBuddy 多账号添加、切换、签到、额度/有效期查看和自动切换验证，并确认 Token 统计图表与本地会话日志一致。

## 参考资料

| 能力 | 用途 | 参考资料 |
| --- | --- | --- |
| fnOS Manifest | `wizard/install`、`wizard/config` 和 `ctl_stop` 配置契约 | [fnOS Manifest 配置](https://developer.fnnas.com/docs/core-concepts/manifest) |
| fnOS 应用框架 | `cmd/main`、`cmd/config_callback` 生命周期职责 | [fnOS 应用框架](https://developer.fnnas.com/docs/core-concepts/framework) |
| fnOS Wizard | 安装与应用设置字段定义 | [fnOS Wizard 配置](https://developer.fnnas.com/docs/core-concepts/wizard) |
| fnOS 环境变量 | `TRIM_*` 路径和配置变量使用约束 | [fnOS 环境变量](https://developer.fnnas.com/docs/core-concepts/environment-variables) |
| DSH 页面插槽 | CodeBuddy 管理面板的 `shell.overlay` 路由与插件生命周期 | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) |
| ECharts | Token 统计按日输入/输出堆叠柱状图与响应式尺寸 | [Apache ECharts](https://echarts.apache.org/zh/index.html) |

## 完成状态

| 阶段 | 状态 | 完成条件 |
| --- | --- | --- |
| P0 应用配置审计 | <Badge type="info" text="规划中" /> | 所有应用完成运行字段与一次性字段分类 |
| P1 运行设置与脚本接入 | <Badge type="info" text="规划中" /> | 目标应用设置可展示、保存并由回调生效 |
| P1 FPK 与 NAS 验证 | <Badge type="info" text="规划中" /> | FPK 安装、升级和真实 NAS 验收通过 |
| FNOS-002 遗留 DSH 集成验收 | <Badge type="info" text="规划中" /> | FPK、网关、Codex 和 CodeBuddy 遗留场景完成真实 NAS 验收并回写 FNOS-002 |
| P1 CodeBuddy 多账号与管理面板 | <Badge type="warning" text="代码已实现，待 NAS 验证" /> | 多账号、自动切换、签到、额度/有效期和 Token ECharts 面板本地检查通过，并在目标 NAS 验收账号操作与统计图表 |

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-08-31 | 新建 PLAN-FNOS-003 | 原版本统一计划迁移到 PLAN-FNOS-002，本计划改为 FPK 应用运行设置统一 |
| 2026-08-31 | 明确实施顺序 | 先审计应用，再建立运行字段契约，最后进行 FPK 和真实 NAS 验证 |
| 2026-09-08 | 承接 FNOS-002 遗留验收 | 增加 DSH FPK 版本/内置插件包、网关完整场景、Codex 动态模型和 CodeBuddy 管理面板的目标环境验收任务 |
| 2026-09-08 | 迁入 CodeBuddy Token 图表条款 | 承接 PLAN-FNOS-002 的 ECharts 模块化柱状图约定，替换手写 div 柱状图并补充 Tooltip、Legend、输入/输出堆叠和 ResizeObserver 清理要求 |
| 2026-09-09 | 迁入 CodeBuddy 计划 | 新增 `PLAN-FNOS-003-C01`～`C04`，承接原 `PLAN-FNOS-002-T07-01`～`T07-04` 的多账号、自动切换、管理面板和插件测试计划，并补入插件检查命令与 NAS 验证项 |
| 2026-09-11 | 补充状态收敛与切换策略 | 新增 `PLAN-FNOS-003-C05`～`C08`：Host 配置唯一权威、写入串行化与 CAS、纯决策模块、`Retry-After` 等待与请求级已尝试账号 |
