---
title: FNOS-001 1Panel 应用商店应用转换
description: 把 1Panel 应用商店的 265 个应用按可转换程度分级，并给出可执行的转换批次与验收条件。
id: FNOS-001
status: 规划中
owner: tnnevol
targetVersion: v7.x
lastVerified: 2026-10-09
---

# FNOS-001 1Panel 应用商店应用转换

| 字段 | 值 |
| --- | --- |
| 需求编号 | FNOS-001 |
| 提出日期 | 2026-10-09 |
| 需求状态 | <Badge type="warning" text="规划中" /> |
| 关联计划 | [PLAN-FNOS-001 1Panel 应用转换执行计划](/plans/PLAN-FNOS-001-1panel-app-conversion) |

## 需求背景与目标

1Panel 应用商店上游仓库（`1Panel-dev/appstore`，本地检出位于工作区的 `appstore/`）用 `apps/<app>/<version>/docker-compose.yml` + `data.yml` 描述应用；飞牛 fnOS 应用用 `manifest` + `cmd/` + `config/` + `wizard/` 打包成 FPK。两者的 Docker 编排能力接近，但配置模型、状态落盘位置、依赖声明方式和权限模型完全不同。

本需求的目标是把「上游 265 个应用中有哪些能转、按什么顺序转、每个应用要改什么」变成可执行、可验收的工程计划，而不是逐个应用凭感觉试。

当前状态：

- 上游仓库 265 个应用全部完成静态盘点，按可转换程度分成 7 级（T0—T4，见[转换清单](/development/1panel-conversion-inventory)）。
- 本仓库已有 14 个应用，其中 6 个与上游同名（memos、halo、new-api、zentao、bitwarden、hermes-agent），需要先做对齐判定，不重复打包。
- 尚未建立转换规约、图标资产管线和批次验收流程。

## 需求目标

1. 给出可直接排期的批次计划：每个应用属于哪一级、要改哪些文件、有没有阻断项。
2. 明确转换前后必须保持的行为：数据落盘位置、端口、镜像版本、依赖关系。
3. 明确哪些应用**不能**按现有 fnOS 权限模型转换，以及需要什么前置决策。
4. 让每一批应用都能用同一套验证流程验收，不依赖个人经验。
5. 已有实现的应用（与上游重名的 6 个）不与上游批次重复劳动。

## 涉及范围

| 对象 | 位置 | 职责 |
| --- | --- | --- |
| 上游应用源 | `appstore/apps/<app>/<version>/` | 只读参考：镜像、端口、卷、环境变量、表单字段 |
| 上游应用元数据 | `appstore/apps/<app>/data.yml` | 只读参考：标题、标签、推荐值、架构、表单字段定义 |
| 转换清单 | `docs/development/1panel-conversion-inventory.md` | 265 个应用的分级明细与改造点 |
| 转换规约 | `docs/development/1panel-conversion.md` | 字段映射表、改造模式、禁止项（本需求交付） |
| 目标应用 | `apps/fn-<app>/` | 每个应用的 FPK 目录、生命周期脚本、向导 |
| 文档与验收 | `docs/apps/`、`docs/validation/` | 应用说明页与真实 NAS 验收记录 |

上游仓库只作为契约与版本来源参考：**只读、不修改、不向上游提交补丁**。上游 `LICENSE` 为 GPL-3.0，本仓库为 Apache-2.0；转换时只复用配置事实（镜像标签、端口、卷路径），不复制上游文件内容，避免许可证混入。

## 功能列表

| 编号 | 优先级 | 功能 | 用户行为 | 状态 |
| --- | --- | --- | --- | --- |
| FNOS-001-01 | P0 | 转换清单与规约落库 | 维护者能从需求、计划和清单三处查到某个上游应用的分级、阻断项和目标批次 | <Badge type="warning" text="待完成" /> |
| FNOS-001-02 | P0 | 图标资产管线 | 任一转换批次开始前，能从上游 `logo.png` 生成合规的 `ICON.PNG`、`ICON_256.PNG` 和 `app/ui/images/icon_{64,256}.png` | <Badge text="待验证" /> |
| FNOS-001-03 | P0 | 转换矩阵（字段映射） | 维护者按固定映射表把 `data.yml` 表单字段翻译成 fnOS 向导字段，不逐个重新决策 | <Badge type="warning" text="规划中" /> |
| FNOS-001-04 | P1 | 批次 T0：直接套模板（14 个） | 用户能在应用中心安装、打开并使用这些应用，端口与上游默认一致 | <Badge type="warning" text="规划中" /> |
| FNOS-001-05 | P1 | 批次 T1：状态落盘改造（98 个，去掉同名后 93 个） | 用户卸载重装或升级后数据仍在，且数据位于 fnOS 应用数据目录而不是容器工程目录 | <Badge type="warning" text="规划中" /> |
| FNOS-001-06 | P1 | 批次 T2：资源集成改造（74 个，去掉同名后 73 个） | 需要数据库/Redis 的应用能通过向导填写连接信息，或通过 `install_dep_apps` 声明依赖 | <Badge type="warning" text="规划中" /> |
| FNOS-001-07 | P2 | 批次 T3：运行环境与中间件（46 个） | 需要先确认 fnOS 侧依赖契约，才能决定是否上架、如何上架 | <Badge text="待确认" /> |
| FNOS-001-08 | P2 | 批次 T4：高风险能力（33 个） | 需要 `docker.sock`、`privileged`、host 网络或设备直通的应用，逐项确认权限可行性 | <Badge text="待确认" /> |

## 交互和行为约束

### 分级规则（转换难度的唯一判定口径）

| 级别 | 数量 | 判定条件 | 主要改造 |
| --- | --- | --- | --- |
| T0 直接套模板 | 14 | 单容器、单端口、无持久化卷或仅命名卷，compose 与 fnOS 模板等价 | 改 `container_name`、去掉 `1panel-network`、写 `manifest`/`wizard`/`app/ui/config` |
| T1 状态落盘改造 | 98 | 单容器单端口，但把数据写进 `./data` 相对目录（含容器内自带 SQLite/内置数据库的应用） | 相对挂载改为 `${TRIM_PKGVAR}` 或 `data-share`，并在 `wizard/uninstall` 提供数据保留选项 |
| T2 资源集成改造 | 74 | 依赖**外部**数据库（`PANEL_DB_*`/`DBHUB_DB_*`）/Redis、多端口、多容器，或使用 `service`/`apps` 联动字段 | 联动字段拆成 fnOS 向导字段；按需 `install_dep_apps=redis`；多端口拆入口 |
| T3 运行环境/中间件/重复能力 | 46 | 语言运行时、Web 服务器、数据库缓存、中间件监控 | 需要宿主侧依赖契约决策，默认不排期 |
| T4 高风险 | 33 | `docker.sock`、`privileged`、`host` 网络、`cap_add`、设备直通、`env_file`、镜像构建 | 逐项确认 fnOS 权限模型是否允许 |

### 上游字段到 fnOS 的对应关系

| 上游 | fnOS | 约束 |
| --- | --- | --- |
| `PANEL_APP_PORT_HTTP` | 向导字段（建议 `APP_PORT`），写入 `app/ui/config` 的 `port` | 上游默认端口作为 `initValue`；必须校验 1—65535 |
| `TZ` / `TIME_ZONE` | 向导字段（建议 `TIME_ZONE`） | 默认 `Asia/Shanghai` |
| `PANEL_DB_*` + `type: apps`/`service` 联动 | 向导里的连接信息字段（参考 [fn-halo](/apps/fn-halo) 的 `DB_HOST`/`DB_USERNAME`/`DB_PASSWORD`） | fnOS 没有服务选择器，必须让用户显式填连接串 |
| `PANEL_REDIS_*` | `install_dep_apps=redis` + Redis 连接串字段（参考 [fn-new-api](/apps/fn-new-api)） | 依赖应用由宿主安装，不在包内固定地址 |
| `./data`、`./conf` 等相对挂载 | `${TRIM_PKGVAR}`、`config/resource` 的 `data-share` | 禁止把运行数据写进 FPK 安装目录 |
| `container_name: ${CONTAINER_NAME}` | 固定为 `fn-<app>` | 与 `-p $TRIM_APPNAME` 一致 |
| `networks: 1panel-network`（external） | 删除 | fnOS 由 compose 项目网络接管 |
| `PANEL_APP_PORT_HTTPS` | 独立向导字段 + 独立入口 | 证书由用户自备，应用默认只提供 HTTP 入口 |
| `labelEn`/`label` 多语言 | 中文 `label` + `helpText` | 文档与向导以中文为主 |

### 行为约束

- 镜像标签必须保持不变或明确升级并记录差异，不得使用 `latest` 以外的隐式漂移。
- 上游 `recommend` 值只用于排批次优先级，不写入 fnOS 的 `manifest`。
- 上游多版本应用（如 CyberChef 10/11、Uptime Kuma 1/2）在转换时必须选定一个版本，禁止把同一应用的多份 compose 塞进同一个 FPK。
- 卸载向导必须提供「保留数据 / 删除数据」二选一，默认保留。
- 应用数据默认不暴露为共享目录；确实需要用户可见时才在 `config/resource` 声明 `data-share`。
- **端口一致性**：`app/ui/config` 的 `port` 必须引用与 `wizard/install` 端口字段同名的变量（如 `${APP_PORT}`），不得写死端口号。这是「用户可改端口」的直接派生要求，写死后入口会与实际监听端口不一致。
- **端口占用处理**：向导是静态校验，无法在表单阶段可靠判定运行时占用，因此「向导表单校验拦截」或「安装后 `cmd/main status` 返回非 0、应用中心显示未运行」两条路径任一即算通过。硬性红线是**不得出现「安装成功且显示运行中但实际不可访问」**。
- **入口 ID 长度上限 32 字符**：`fnpack` 对 `app/ui/config` 的入口键做硬校验，超限直接拒绝打包（如实测 `fn-wechatmarkdowneditor.Application` 35 字符失败）。`fn-` + `<app>` + `.Application` 超过 32 字符等价于 **`<app>` 长度 ≥ 18 字符时必然超限**，此时后缀改用 `.main`。实测边界：32 通过、33 拒绝。
- **入口键必须以 `appname` 为前缀**：否则 `fnpack` 报 `The entry name "..." in "app/ui/config" should start with <appname>`；入口键还必须与 `manifest.desktop_applaunchname` 逐字符一致。
- **无 Web UI 的应用不建桌面入口**：`app/ui/config` 写 `{}`，并从 `manifest` 删除 `desktop_uidir` 与 `desktop_applaunchname`（仓库既有先例 `fn-mysql_v8`、`fn-nvm`、`fn-uv`）。非 HTTP 端口（如 memcached 的 11211、zabbix-agent 的 10050）不得建桌面入口。

## 不在本次范围内

- 不修改上游 `appstore/` 的任何文件，也不向上游提交补丁。
- 不重写本仓库已有的 14 个应用；其中的同名应用只做对齐判定。
- 不承诺把 T4 的高风险应用全部转换完成，它们必须先解决权限模型决策。
- 不为 T3 的运行环境类应用设计新的依赖机制（那是宿主能力，不是本仓库能决定的）。
- 不在本需求中定义应用商店上架审核规则和签名流程。

## 验收条件与完成状态

### 阶段一：清单与规约

- FNOS-001-01-AC-01：`docs/development/1panel-conversion-inventory.md` 覆盖上游全部 265 个应用，每个应用有分级、展示名、主镜像和改造点。
- FNOS-001-01-AC-02：清单统计与上游仓库实际内容一致（应用总数 265、有 `formFields` 的 259、使用 `1panel-network` 的 257、使用 `./` 相对挂载的 223、使用外部命名卷的 2）。
- FNOS-001-01-AC-03：`pnpm run check -- --all` 通过（SDD 文档结构校验 + 文档站构建）。
- FNOS-001-01-AC-04：清单里每个应用有唯一的分级归属，不需要人工解释的口径分歧；总量守恒（14 + 98 + 74 + 46 + 33 = 265）。
- FNOS-001-03-AC-01：`docs/development/1panel-conversion.md` 存在，其字段映射表覆盖本需求「上游字段到 fnOS 的对应关系」表的全部 9 行；且每个映射项都能在上游 `data.yml` 或 `docker-compose.yml` 中找到对应来源。

### 阶段二：单应用验收（每批次适用）

- FNOS-001-04-AC-01：`fnpack build` 产出 `.fpk`；顶层含 `manifest`、`app.tgz`、`cmd/`、`config/`、`wizard/`、`ICON.PNG`、`ICON_256.PNG`；`app.tgz` 解开后含 `docker/docker-compose.yaml`、`ui/config`、`ui/images/icon_{64,256}.png`。
- FNOS-001-04-AC-02：在目标 NAS 上 `appcenter-cli install-local` 安装成功，应用卡片能打开且指向正确端口。
- FNOS-001-04-AC-03：安装 → 启动 → 停止 → 卸载 → 重装流程不报错；选择「保留数据」后重装能读回原有数据。
- FNOS-001-04-AC-04：应用以 `docker-fn-<app>` 用户运行，不申请 root 和额外 `join-groups`（除非在计划中显式记录理由）。
- FNOS-001-04-AC-05：`app/ui/config` 的 `port` 引用与 `wizard/install` 端口字段**同名的变量**（如 `${APP_PORT}`），不得写死端口；用户改端口后入口随之变化。
- FNOS-001-04-AC-06：端口被占用时，**向导表单校验拦截** 或 **安装后 `cmd/main status` 返回非 0 使应用中心显示未运行**，两条路径任一即算通过；不得出现「安装成功且显示运行中但实际不可访问」。
- FNOS-001-04-AC-07：有 Web UI 的应用，`app/ui/config` 的入口键**长度 ≤ 32 字符**且**以 `manifest.appname` 为前缀**，并与 `desktop_applaunchname` 逐字符一致（`fnpack build` 能通过这两项硬校验）；无 Web UI 的应用 `app/ui/config` 为 `{}` 且 `manifest` 不含 `desktop_uidir`/`desktop_applaunchname`。
- FNOS-001-05-AC-01：数据目录位于 `/var/apps/fn-<app>/var/`（目标 NAS 路径）或声明的共享目录，容器删除后数据不丢。
- FNOS-001-06-AC-01：需要数据库的应用，向导能收集连接信息，且连接失败时有用户可见的错误提示。
- FNOS-001-02-AC-01：生成的 `ICON.PNG`、`ICON_256.PNG` 为正方形、PNG 格式、单文件不超过 1024 KB，`icon_64.png`/`icon_256.png` 与入口配置一致。

### 状态看板

| 阶段 | 状态 | 下一步 |
| --- | --- | --- |
| 清单与规约 | <Badge type="warning" text="待完成" /> | 清单与规约已落地；待解除 `appcenter-cli` 权限阻塞后做安装回归 |
| T0 批次 | <Badge type="warning" text="待完成" /> | **14 个应用全部产出**（首批 3 个 + 收尾 11 个），逐个 `fnpack build` 通过；11 个新应用的构建由 Lead 独立复验 11/11。静态规范核对已全量通过（图标四件套尺寸、`config/privilege` 的 `docker-fn-<app>`、`wizard/install` 与 `wizard/config` 字段同名、卸载向导 `wizard_data_action`、入口 ID ≤32 字符且以 `appname` 为前缀、无 `1panel-network`/`createdBy` 残留）。但**正式测试用例目前只覆盖首批 3 个应用**（`docs/testing/FNOS-001-t0-round1-report.md`），11 个新应用尚无对应用例，其"通过"仅为构建通过 + 静态核对，未经用例化验收。真机仅 `fn-it-tools` 一个（04-AC-02 通过、04-AC-03 部分通过）；**04-AC-06、05-AC-01、06-AC-01 仍未执行**，T0 不得标记为已完成 |
| T1 批次 | <Badge type="info" text="后续计划" /> | 同上 |
| T2 批次 | <Badge type="info" text="后续计划" /> | 需要先确定数据库联动方案 |
| T3 批次 | <Badge text="待确认" /> | 需要宿主依赖契约决策 |
| T4 批次 | <Badge text="待确认" /> | 需要权限模型决策 |

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-09 | 建立需求：完成上游 265 应用静态盘点，确定 T0—T4 分级、字段映射和批次顺序。 |
| 2026-10-09 | 修正分级口径：`cap_add` 归入 T4 触发条件，T4 由 30 调整为 33，T1 由 93 调整为 92，T2 由 79 调整为 77。 |
| 2026-10-09 | 订正盘点计数与分级（D-02）：`./` 相对挂载判定改为引号无关、外部数据库判据收紧为 `PANEL_DB_*`/`DBHUB_DB_*`；T0 17→14、T1 92→98、T2 77→74（守恒 `14+98+74+46+33=265`），AC-02 的 `formFields` 257→259、`./` 挂载 221→223，AC-04 守恒式同步。 |
| 2026-10-09 | 订正 AC-01 包结构（实测为 `app.tgz` 而非字面 `app/`）；补 FNOS-001-03（P0）缺失的验收条件；新增 AC-05（入口 `port` 必须引用同名向导变量）与 AC-06（端口占用的两条通过路径与红线）；在行为约束中补端口一致性与端口占用口径。 |
| 2026-10-09 | T0 试点 3 个应用（`fn-it-tools`、`fn-linux-command`、`fn-adminer`）已产出并通过本地验收，本地可执行范围全部通过；5 个依赖目标 NAS 的验收条件（04-AC-02/03/06、05-AC-01、06-AC-01）仍阻塞，T0 批次**不得标记为已完成**。见 [T0 第一轮报告](/testing/FNOS-001-t0-round1-report)。 |
| 2026-10-10 | 真机验证（`trim-cli`，设备 `192.168.119.6`）：`fn-it-tools` 安装成功并正常服务。**04-AC-02 转为通过**、**04-AC-03 部分通过**（启动/停止/重启已验证，卸载与重装因 CLI 不支持卸载向导参数、需转 App Center UI）；**04-AC-06 明确为未执行**（本次未构造端口冲突场景，不得因安装成功而判通过）。T0 批次仍**不得标记为已完成**。见 [验收记录](/validation/FNOS-001-fnos-nas-2026-10-09)。 |
| 2026-10-10 | T0 批次 14 个应用全部产出：首批 3 个 + 收尾 11 个，逐个构建通过并由 Lead 独立复验。发现并修复入口 ID 超 32 字符问题（`fn-wechatmarkdowneditor`）。**真机验收与 04-AC-06/05-AC-01/06-AC-01 仍未完成**，T0 不得标记为已完成。 |
| 2026-10-10 | 补登两条 `fnpack` 硬校验为行为约束并新增 AC-07：入口 ID ≤32 字符（32 通过/33 拒绝，`<app>` ≥18 字符必然超限，超限改用 `.main`）、入口键须以 `appname` 为前缀；另登记无 Web UI 应用的入口形态（`app/ui/config` 为 `{}`，`manifest` 去掉 `desktop_uidir`/`desktop_applaunchname`）。 |
| 2026-10-10 | 订正状态看板的 T0 措辞：原文「14 个应用全部产出并本地验收通过」对收尾 11 个不成立——正式测试用例目前只覆盖首批 3 个应用，11 个新应用仅为构建通过 + 静态核对；改为区分「全部产出」与「用例化验收覆盖范围」，并保留 04-AC-06/05-AC-01/06-AC-01 未执行的结论。 |
