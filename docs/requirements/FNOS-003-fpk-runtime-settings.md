---
id: FNOS-003
title: FNOS-003 FPK 应用运行设置统一
description: 为需要运行参数配置的 fnOS FPK 应用补齐应用设置入口，承接 FNOS-002 遗留的 FPK/NAS 集成验收，并承接 CodeBuddy 多账号、额度与 Token 统计面板需求（该插件与 fnOS 无关，任一 DSH 客户端均可使用）。
status: planned
owner: tnnevol
targetVersion: 5.3.1
lastVerified: 2026-09-09
---

# FNOS-003 FPK 应用运行设置统一

| 项目 | 内容 |
| --- | --- |
| 需求编号 | FNOS-003 |
| 提出日期 | 2026-08-31 |
| 需求状态 | <Badge type="info" text="规划中" /> |
| 关联计划 | [PLAN-FNOS-003 FPK 应用运行设置统一](/plans/PLAN-FNOS-003-fpk-runtime-settings) |

## 需求背景与目标

目前仓库内 15 个应用都已提供 `cmd/main`、`cmd/config_init`、`cmd/config_callback` 与 `cmd/uninstall_callback`，其中 11 个已提供 `wizard/config`。没有 `wizard/config` 时，用户无法在 fnOS 的“应用设置”中修改应用运行参数；已有安装向导的配置也可能与运行时配置分散，导致字段、默认值和校验规则不一致。剩余未提供 `wizard/config` 的 4 个应用经审计均无运行参数（Shell 工具与 Docker 一次性参数），按需求边界不新增空配置页。

本需求同时承接 FNOS-002 已实现但尚未完成目标环境验收的工作：DSH FPK 内置插件包与发布清单版本对齐、安装/升级/回滚保留配置、网关完整代理场景，以及 Codex 动态模型目录的目标环境验收；原 FNOS-002-06 的 CodeBuddy 需求与计划内容也整体迁入本需求，但该插件不依赖 fnOS——它只依赖 DSH 的插件接缝，任一 DSH 客户端（Web、桌面、其它发行形态）均可使用，因此其验收在 DSH 客户端完成，不绑定 NAS。

本需求统一需要运行参数配置的 FPK 应用的设置入口，明确安装配置、运行设置和生命周期脚本的职责边界。是否纳入配置不以“存在 `cmd/main`”作为唯一条件，而以应用确实存在可修改的运行参数为准。

## 需求目标

- 为目标应用提供 `wizard/config`，在应用设置中展示可修改的运行参数。
- 运行配置与 `wizard/install` 中对应的运行字段保持名称、类型、默认值和校验规则一致。
- 保存后通过 `cmd/config_callback` 使配置生效；`cmd/main` 继续负责启动、停止和状态维护。
- 一次性安装参数不出现在运行设置中；不需要运行配置的应用不增加空设置页。
- 完成 FNOS-002 遗留的 DSH FPK 构建、插件加载、版本升级/回滚和网关完整代理验收。
- 完成 Codex 动态模型目录的目标环境验收，并回写 FNOS-002 状态。
- CodeBuddy 支持多账号管理、当前账号切换、额度/有效期查看、签到和额度不足时的自动切换，并提供独立管理面板。
- CodeBuddy 管理面板的 Token 统计使用 ECharts 绘制按日输入/输出堆叠柱状图，支持 7/30/90 天范围、悬浮明细、图例和容器自适应；统计数据继续来自本地会话日志。
- DSH FPK 应用设置只暴露可安全修改的运行参数：`0.0.0.0` 监听地址标注为暂不支持并禁用，可信访问地址必填且指向 NAS Web 的 host 或 host:port。
- CodeBuddy 支持 CodeBuddy CLI 与 WorkBuddy 两种客户端登录；账号卡片的运营动作（签到、旅行）与资源包台账在面板内可观察。
- CodeBuddy 面板切换菜单不重新拉取，首次加载以骨架占位，刷新只更新局部数据。

## 涉及范围

| 模块 | 目录或入口 | 职责 |
| --- | --- | --- |
| FPK 应用 | `apps/*/manifest`、`wizard/install`、`wizard/config` | 声明安装配置和可持续修改的运行配置 |
| 生命周期脚本 | `cmd/main`、`cmd/config_init`、`cmd/config_callback` | 读取 `wizard_*` 环境变量，管理进程并应用配置变更 |
| 开发文档 | `docs/development`、应用文档 | 记录字段来源、脚本关系和验证方式 |
| 构建与验证 | FPK 构建脚本、测试目录、目标 NAS | 验证设置展示、保存生效和升级保留配置 |
| CodeBuddy 插件 | `plugins/dsh-codebuddy-plugin` | 管理多账号凭据、额度阈值自动切换、签到、额度/有效期查看和 Token 统计面板 |

## 功能列表

| 编号 | 优先级 | 功能 | 用户行为 | 状态 |
| --- | --- | --- | --- | --- |
| FNOS-003-01 | P1 | 运行设置入口 | 在应用中心打开应用设置，可看到目标应用的运行参数配置 | <Badge type="warning" text="代码已实现，待 NAS 验证" /> |
| FNOS-003-02 | P1 | 安装与运行配置一致 | 安装时与运行时使用同一套字段契约，修改后字段值能被生命周期脚本读取 | <Badge type="warning" text="代码已实现，待 NAS 验证" /> |
| FNOS-003-03 | P1 | 配置变更生效 | 用户保存配置后，应用按约定重载或重启服务，并能看到新的运行状态 | <Badge type="warning" text="部分实现，待 NAS 验证" /> |
| FNOS-003-04 | P1 | 一次性配置边界 | 仅安装阶段使用的路径、初始化选项和迁移参数不出现在运行设置中 | <Badge type="warning" text="代码已实现，待 NAS 验证" /> |
| FNOS-003-05 | P1 | DSH FPK 与版本验收 | FPK 内置插件包与发布清单、插件兼容版本保持一致，安装/升级/回滚保留用户配置 | <Badge type="info" text="规划中" /> |
| FNOS-003-06 | P1 | DSH 网关完整场景验收 | 完成 API 反代即时生效、SSE/WebSocket、权限、并发、异常和恢复场景验证 | <Badge type="info" text="规划中" /> |
| FNOS-003-07 | P1 | DSH 插件管理面板验收 | 验证 Codex 动态模型目录（含上下文窗口写入）的目标环境表现 | <Badge type="info" text="规划中" /> |
| FNOS-003-11 | P1 | DSH 应用运行参数约束 | 监听地址只能选 `127.0.0.1`，`0.0.0.0` 置灰并说明未适配；可信访问地址必填且不得填 DSH 自身端口 | <Badge type="warning" text="代码已实现，待 NAS 验证" /> |
| FNOS-003-12 | P1 | CodeBuddy 多客户端登录 | 添加账号时可选择 CodeBuddy CLI 或 WorkBuddy 客户端，卡片展示客户端与固定版本标识 | <Badge type="tip" text="代码已实现，本地已验证" /> |
| FNOS-003-13 | P1 | CodeBuddy 账号运营自动化 | 自动签到、派猫猫旅行自动派发与奖励领取、资源包台账按可使用/已用完/已过期分组 | <Badge type="tip" text="代码已实现，本地已验证" /> |
| FNOS-003-14 | P1 | CodeBuddy 面板体验与状态持久化 | 面板 keep-alive、首次加载骨架、刷新局部更新、偏好与台账走统一状态库 | <Badge type="tip" text="代码已实现，本地已验证" /> |
| FNOS-003-15 | P1 | CodeBuddy 模型图片输入 | 支持图片的模型以原生 `image_url` 发送图片，不支持时仍由 DSH 读图工具兜底 | <Badge type="tip" text="代码已实现，本地已验证" /> |
| FNOS-003-08 | P1 | CodeBuddy 多账号与管理面板 | 管理多个 CodeBuddy 账号，支持切换、签到、额度/有效期查看、自动切换和 Token 统计 | <Badge type="tip" text="代码已实现，本地已验证" /> |
| FNOS-003-09 | P1 | CodeBuddy Token 统计图表 | 面板按日展示输入/输出堆叠柱状图，支持 7/30/90 天范围、悬浮明细、图例和容器自适应 | <Badge type="tip" text="代码已实现，本地已验证" /> |
| FNOS-003-10 | P1 | CodeBuddy 状态源与切换策略收敛 | 自动开关配置以 Host 为唯一权威，凭据写入串行化且切换带期望当前账号，主动/被动切换由纯决策模块判定并遵守 `Retry-After` | <Badge type="tip" text="代码已实现，本地已验证" /> |

## 交互和行为约束

- 目标应用的“应用设置”只展示真实可运行时修改的字段；没有此类字段的应用不新增 `wizard/config`。
- `wizard/config` 的字段名按**应用形态**分两类，两类都要求与 `wizard/install` 中的同义字段同名、同默认值、同校验：
  - **Native 应用**（自行读取环境变量）：使用稳定的 `wizard_*` 前缀，例如 `wizard_host`、`wizard_port`、`wizard_trusted_hosts`。
  - **Docker 应用**（由 `app/docker/docker-compose.yaml` 直接引用）：沿用 compose 已引用的裸名（如 `DB_TYPE`、`APP_PORT`、`SQL_DSN`），不为统一前缀而改写已发布应用的变量名。
- 保存由 fnOS 统一提交；保存成功后调用 `cmd/config_callback`，由脚本决定安全重载或重启，不在 Client 侧伪造状态。
- `cmd/main` 负责 `start`、`stop`、`status`；`cmd/config_callback` 负责配置保存后的应用变更，两者职责不能互相替代。
- `cmd/config_callback` 不得保持占位：Native 应用要按约定重载或重启进程；Docker 应用要显式记录“由 appcenter 依据新环境变量重建容器”的生效路径，并在文档与验收中说明。
- `ctl_stop=false` 的应用仍不显示应用中心的启停控制；这与是否提供运行设置是两个独立条件。
- 密码、Token 等敏感值按 fnOS 配置类型处理，不在普通日志和页面中回显。
- DSH FPK 的监听地址只允许 `127.0.0.1`：`0.0.0.0` 选项显示为「暂不支持」并禁用；可信访问地址必填，填写的是打开 NAS Web 的 host 或 host:port，不得填 DSH 自身监听端口。
- CodeBuddy 管理面板使用 `shell.overlay` 独立路由，包含账号、额度和 Token 统计菜单；Token 统计使用 ECharts 展示按日输入/输出堆叠柱状图。
- CodeBuddy 自动切换以剩余额度阈值为前提，开关与阈值由用户可改；触发切换后当前账号、模型目录和用量展示同步刷新。
- 多个 CodeBuddy 账号的凭据独立持久化，切换当前账号不删除其它账号记录，也不影响 FNOS-002 已验收的 Codex 与网关行为。
- CodeBuddy **添加账号不改变当前账号**：新登录的账号只入库并出现在列表中，当前账号保持不变（切换当前账号有独立入口与自动切换策略，登录不顺带替用户决定）。仅当一个账号都没有时例外——此时新账号必须成为当前账号，不允许留下「有账号却没有当前账号」的状态；重复登录已存在的账号（含重新登录）也不会把它自己挤下去。
- CodeBuddy 添加账号时先选客户端（CLI / WorkBuddy）；客户端决定登录端点与版本标识，历史条目缺该字段时按 CLI 处理。
- CodeBuddy 运营周期（自动签到、旅行派发、旅行领取）按账号去重且失败退避可自愈；成长中心能力仅对个人账号调用，企业账号自动跳过。
- CodeBuddy 面板刷新保留旧数据并只叠局部遮罩；切换菜单不卸载页面，首次加载用骨架占位。

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
- Codex 动态模型目录在目标环境可访问、可操作。
- CodeBuddy 管理面板在 DSH 客户端可访问、可操作，Token 统计数据和图表显示正确（与 fnOS 无关）。
- Codex 模型目录刷新把账号返回的最大上下文窗口写入 DSH，长上下文响应不再被误判为 `CONTEXT_WINDOW_EXCEEDED`；账号接口未提供最大值时才回退默认窗口。
- DSH FPK 应用设置中 `0.0.0.0` 监听地址不可选，可信访问地址校验拒绝 DSH 自身端口；保存后应用以新配置重启且状态正确。
- CodeBuddy 可添加、重登录、重命名、删除多个账号并切换当前账号；额度/有效期、签到状态和额度不足时的自动切换按预期工作。
- CodeBuddy 可用 CLI 与 WorkBuddy 两种客户端登录成功，登录失败在界面上给出原因；卡片显示正确的客户端与版本标识。
- CodeBuddy 自动签到与旅行周期在 DSH 客户端按间隔运行，重复触发不重复提交，企业账号被跳过且不报错。
- CodeBuddy 面板切换菜单不重新拉取、刷新保留旧数据，首次加载显示骨架；偏好在刷新与其他界面间保持一致。
- CodeBuddy 自动开关配置以 Host 为唯一权威：在任一界面修改后，其它界面与刷新后的页面都读到同一值，不被旧的浏览器本地值覆盖。
- CodeBuddy 在并发切换、改名、删除并存时结果保持一致（不互相覆盖、已删账号不复活）；被限流时按 `Retry-After` 有限等待且可取消。
- CodeBuddy 管理面板的 Token 统计按日展示输入/输出堆叠柱状图，7/30/90 天范围切换、悬浮明细、图例和容器自适应正常，数据来自本地会话日志。

### 状态看板

| 阶段 | 状态 | 当前范围 | 下一步 |
| --- | --- | --- | --- |
| P1 运行设置统一 | <Badge type="warning" text="代码已实现，待 NAS 验证" /> | 11 个应用已提供 `wizard/config`；4 个无运行参数的应用已确认不纳入 | 补齐 `cmd/config_callback` 真实生效逻辑，并在 NAS 逐个验证展示与保存 |
| FNOS-002 遗留 DSH 验收 | <Badge type="info" text="规划中" /> | 承接 FPK/网关/插件管理面板的目标环境验收 | 完成 FPK 构建、安装升级回滚、网关完整场景和插件面板验收 |
| P1 CodeBuddy 多账号与管理面板 | <Badge type="tip" text="代码已实现，本地已验证" /> | 多账号、双客户端登录、自动切换、签到、旅行、资源包台账、Token ECharts 面板代码已落地 | 在 DSH 客户端验收账号操作、运营周期与统计图表（不依赖 fnOS） |

## 变更记录

| 日期 | 变更 | 说明 |
| --- | --- | --- |
| 2026-08-31 | 新增 FNOS-003 | 原 FNOS-003 的 DSH 版本统一内容迁移到 FNOS-002，本需求改为 FPK 应用运行设置统一 |
| 2026-08-31 | 明确配置职责 | 确认 `wizard/config` 负责应用设置表单，`cmd/main` 负责生命周期，`cmd/config_callback` 负责保存后生效 |
| 2026-09-08 | 承接 FNOS-002 遗留验收 | 将 DSH FPK 版本与内置插件包、网关完整场景、Codex 动态模型和 CodeBuddy 管理面板的未完成目标环境验收纳入 FNOS-003 |
| 2026-09-09 | 迁入 CodeBuddy 需求 | 新增 FNOS-003-08、FNOS-003-09，承接原 FNOS-002-06 的多账号管理、账号切换、额度/有效期、签到、自动切换和 Token ECharts 统计图表需求 |
| 2026-09-11 | 新增状态源与切换策略收敛 | 新增 FNOS-003-10：Host 配置唯一权威、凭据写入串行化与 CAS、纯决策模块、`Retry-After` 等待与请求级已尝试账号 |
| 2026-09-11 | 修正 CodeBuddy 的验收环境 | CodeBuddy 插件与 fnOS 无关（只依赖 DSH 插件接缝，任一 DSH 客户端均可用），原文把其验收绑在「真实 NAS」上是错误描述。需求表中 6 条 CodeBuddy 需求（FNOS-003-08/09/12～15）与状态看板合计 7 处改为「本地已验证」，验收表述改为在 DSH 客户端完成；NAS/FPK 相关验收仍保留在 FPK 与网关条目上 |
| 2026-09-11 | 依据 v5.3.1 后实现刷新范围 | FNOS-003-01～04 从规划中改为已实现待验证；新增 FNOS-003-11～15（DSH 运行参数约束、多客户端登录、账号运营自动化、面板体验、模型图片输入） |
| 2026-09-11 | 明确字段命名与回调边界 | `wizard/config` 字段名按 Native（`wizard_*`）与 Docker（compose 裸名）分类；`cmd/config_callback` 不得占位，须按形态实现重载/重启或记录容器重建路径 |
