---
id: PLAN-FNOS-003
title: PLAN-FNOS-003 FPK 应用运行设置统一
description: 审计并为需要运行参数的 fnOS FPK 应用补齐 wizard/config，统一安装配置、运行设置和生命周期脚本的实施计划。
status: planning
owner: tnnevol
planDate: 2026-08-31
targetVersion: 5.1.x
lastVerified: 2026-08-31
---

# PLAN-FNOS-003 FPK 应用运行设置统一

| 字段 | 内容 |
| --- | --- |
| 计划编号 | PLAN-FNOS-003 |
| 计划日期 | 2026-08-31 |
| 对应需求 | [FNOS-003 FPK 应用运行设置统一](/requirements/FNOS-003-fpk-runtime-settings) |
| 计划状态 | <Badge type="info" text="规划中" /> |

## 计划目标

为确实存在可修改运行参数的 FPK 应用建立 `wizard/config`，复用安装向导中的运行字段契约，并在保存后通过 `cmd/config_callback` 安全应用变更。计划先完成全量审计，再按应用差异实现，不默认给所有应用增加配置页。

本计划不修改 fnOS 平台协议，不把 `cmd/main` 改造成配置处理器，也不把一次性安装参数暴露为运行设置。

## 实现范围和边界

| 模块 | 计划入口 | 实现责任 |
| --- | --- | --- |
| 应用清单 | `apps/*/manifest`、`wizard/install` | 盘点运行字段、安装字段、默认值和校验规则 |
| 运行设置 | 目标应用 `wizard/config` | 为可修改运行参数生成 fnOS 应用设置表单 |
| 生命周期 | `cmd/main`、`cmd/config_init`、`cmd/config_callback` | 读取配置、维护状态、保存后重载或重启 |
| FPK 构建 | 应用构建脚本和根 `build` CLI 入口 | 打包配置文件并验证安装产物 |
| 文档与测试 | `docs/`、应用测试目录 | 记录选择依据并验证设置、升级和 NAS 行为 |

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

## 详细交互

### P1：应用设置运行配置流程

1. 用户在 fnOS 应用中心打开目标应用的“应用设置”。
2. fnOS 根据 `wizard/config` 展示运行字段；首次打开显示已保存值或字段默认值。
3. 用户修改字段并统一点击保存；取消则不提交变更。
4. fnOS 保存成功后触发 `cmd/config_callback`，脚本检查应用状态并执行约定的重载或重启。
5. 页面重新读取应用状态和配置结果；失败时保留旧配置并展示错误，不伪造成功状态。
6. 没有运行字段的应用不展示空配置页；`ctl_stop=false` 仍按原规则隐藏启停控制。

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

### 真实 NAS 验证

- 安装目标 FPK，确认应用设置出现预期运行字段。
- 修改并保存字段，确认 `cmd/config_callback` 执行且应用运行参数已更新。
- 验证应用停止、启动、状态查询和配置回调不会创建重复进程。
- 升级后确认运行配置、用户数据、凭据和工作目录保留。
- 对未纳入目标清单的应用确认没有新增空的运行设置入口。

## 参考资料

| 能力 | 用途 | 参考资料 |
| --- | --- | --- |
| fnOS Manifest | `wizard/install`、`wizard/config` 和 `ctl_stop` 配置契约 | [fnOS Manifest 配置](https://developer.fnnas.com/docs/core-concepts/manifest) |
| fnOS 应用框架 | `cmd/main`、`cmd/config_callback` 生命周期职责 | [fnOS 应用框架](https://developer.fnnas.com/docs/core-concepts/framework) |
| fnOS Wizard | 安装与应用设置字段定义 | [fnOS Wizard 配置](https://developer.fnnas.com/docs/core-concepts/wizard) |
| fnOS 环境变量 | `TRIM_*` 路径和配置变量使用约束 | [fnOS 环境变量](https://developer.fnnas.com/docs/core-concepts/environment-variables) |

## 完成状态

| 阶段 | 状态 | 完成条件 |
| --- | --- | --- |
| P0 应用配置审计 | <Badge type="info" text="规划中" /> | 所有应用完成运行字段与一次性字段分类 |
| P1 运行设置与脚本接入 | <Badge type="info" text="规划中" /> | 目标应用设置可展示、保存并由回调生效 |
| P1 FPK 与 NAS 验证 | <Badge type="info" text="规划中" /> | FPK 安装、升级和真实 NAS 验收通过 |

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-08-31 | 新建 PLAN-FNOS-003 | 原版本统一计划迁移到 PLAN-FNOS-002，本计划改为 FPK 应用运行设置统一 |
| 2026-08-31 | 明确实施顺序 | 先审计应用，再建立运行字段契约，最后进行 FPK 和真实 NAS 验证 |
