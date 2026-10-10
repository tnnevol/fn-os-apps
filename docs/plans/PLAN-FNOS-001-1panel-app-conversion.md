---
title: PLAN-FNOS-001 1Panel 应用转换执行计划
description: 按 T0—T4 分级分批把 1Panel 应用商店应用转换为 fnOS FPK 应用的实施、验证与发布计划。
id: PLAN-FNOS-001
status: 规划中
owner: tnnevol
targetVersion: v7.x
lastVerified: 2026-10-09
---

# PLAN-FNOS-001 1Panel 应用转换执行计划

| 字段 | 值 |
| --- | --- |
| 计划编号 | PLAN-FNOS-001 |
| 计划日期 | 2026-10-09 |
| 对应需求 | [FNOS-001 1Panel 应用商店应用转换](/requirements/FNOS-001-1panel-app-conversion) |
| 计划状态 | 分阶段实施 |

## 计划目标

把上游 `1Panel-dev/appstore`（本地检出 `appstore/`，265 个应用）中**可转换**的应用，按转换成本从低到高分批产出 fnOS FPK，并沉淀一套可复用的转换规约、字段映射表和验证流程。

技术边界：

- 只转换应用形态与 fnOS Docker 应用模板兼容的应用；运行环境、数据库副本和高风险能力应用先做决策，不进入实施批次。
- 转换只复用上游的配置事实（镜像标签、端口、卷路径、环境变量），不复制上游文件内容；上游 `LICENSE` 为 GPL-3.0，本仓库为 AGPL-3.0。
- 明确不修改的范围：上游仓库任何文件、已上架的 6 个同名应用实现、`fn-memos` 等原生应用的技术形态。

## 实现范围和边界

| 模块 | 计划入口 | 实现责任 |
| --- | --- | --- |
| 应用/FPK | `apps/fn-<app>/` | `manifest`、`cmd/` 生命周期、`config/`、`wizard/`、`app/docker/docker-compose.yaml` |
| 应用配置 | `config/privilege`、`config/resource`、`app/ui/config` | 运行用户 `docker-fn-<app>`、数据共享目录、桌面入口与端口。入口键须以 `appname` 为前缀且总长 ≤32 字符（超限用 `<appname>.main`）；无 Web UI 的应用 `app/ui/config` 为 `{}` 且 `manifest` 不含入口字段 |
| 转换规约 | `docs/development/1panel-conversion.md` | 字段映射表、改造模式、命名规约、禁止项 |
| 转换清单 | `docs/development/1panel-conversion-inventory.md` | 265 个应用的分级、改造点与批次归属 |
| 文档 | `docs/apps/fn-<app>.md`、`docs/apps/index.md`、`docs/.vitepress/config.mts` | 应用说明页、目录表登记、导航条目 |
| 图标资产 | `apps/fn-<app>/ICON.PNG`、`ICON_256.PNG`、`app/ui/images/`、`docs/public/icons/` | 由上游 `logo.png` 生成合规图标 |
| 测试用例 | `docs/testing/FNOS-001-test-cases.md` | 按功能 ID 与验收条件编号的可复现用例（`<功能 ID>-TEST-##`），不含设备结论 |
| 验收 | `docs/validation/` | 真实 NAS 安装、启停、升级和卸载证据 |

上游 `1Panel-dev/appstore` 只作为契约、版本和行为参考：**只参考、不修改、不提交上游补丁**。

## 目标架构和数据流

```text
上游 appstore/apps/<app>/
  ├─ data.yml                 ── 展示名、标签、架构、formFields（端口/密钥/数据库）
  └─ <version>/docker-compose.yml ── 镜像、端口、卷、环境变量
                    │
                    │ 转换（本计划）
                    ▼
        apps/fn-<app>/
          ├─ manifest                     ← display_name/desc/maintainer/install_dep_apps
          ├─ app/docker/docker-compose.yaml ← 镜像不变；端口用向导变量；卷指向 TRIM_PKGVAR
          ├─ app/ui/config                ← 桌面入口，port 引用同一个向导变量
          ├─ config/privilege             ← run-as package + docker-fn-<app>
          ├─ config/resource              ← docker-project + 可选 data-share
          ├─ wizard/{install,config,uninstall}
          └─ cmd/{install,config,upgrade,uninstall}_init|callback、cmd/main
                    │
                    ▼
        fnpack build → fn-<app>.fpk → appcenter-cli install-local → 目标 NAS 验收
```

生命周期时序：

```text
安装：wizard/install 收集端口与连接信息 → cmd/install_init → cmd/install_callback（准备目录、落盘配置）→ cmd/main status 检查容器
运行：应用中心 start/stop → cmd/main start|stop|status（docker compose -p $TRIM_APPNAME）
配置：应用设置 → wizard/config → cmd/config_init → cmd/config_callback
升级：wizard/upgrade → cmd/upgrade_init → cmd/upgrade_callback
卸载：wizard/uninstall（保留/删除数据）→ cmd/uninstall_callback
```

## 分阶段任务

计划内的阶段只有四个：准备阶段和 T0/T1/T2 三个实施批次。T3、T4 属于需求中已登记的待决策范围，不进入本计划的阶段任务、测试和完成状态。

### 阶段 0：转换准备（规划中）

目标：把重复劳动消除掉，让后续每个应用只剩「填参数」的工作量。

| 任务 | 内容 | 验收 |
| --- | --- | --- |
| PLAN-FNOS-001-T00-01 | 输出转换规约 `docs/development/1panel-conversion.md`：命名规约、字段映射表、compose 改造模式、禁止项 | 文档进入文档站导航，`pnpm run check -- --all` 通过 |
| PLAN-FNOS-001-T00-02 | 图标管线：由上游 `logo.png` 生成 `ICON.PNG`(64²)、`ICON_256.PNG`(256²)、`app/ui/images/icon_{64,256}.png`、`docs/public/icons/fn-<app>.png` | 用 `it-tools`、`memcached` 验证四个产物存在且满足 [图标规范](https://developer.fnnas.com/docs/core-concepts/icon) |
| PLAN-FNOS-001-T00-03 | 建立应用骨架生成方式：`fnpack create <app> --template docker` 后按规约改写（**不使用** `--template` 之外的模板参数，也不删除模板保留文件） | 生成一个空应用后 `fnpack build` 成功 |
| PLAN-FNOS-001-T00-04 | 确定同名应用对齐策略：6 个同名应用只对齐镜像版本，不新建目录 | 在清单中登记结论 |
| PLAN-FNOS-001-T00-05 | 确认端口分配规约：沿用上游默认端口，冲突时在清单中记录替代端口 | 批内无端口冲突 |

前置条件与风险：图标管线依赖本地图像工具。当前环境**没有** ImageMagick/`sips`/Pillow/sharp，必须先选定方案（安装图像工具或引入构建依赖），否则 T00-02 阻塞，T0/T1/T2 全部批次受影响。

### 阶段 1：T0 批次（规划中）

目标：14 个直接套模板应用产出 FPK。

| 任务 | 内容 |
| --- | --- |
| PLAN-FNOS-001-T01-01 | 按清单 T0 表逐个建目录：`manifest` 写入 `display_name`、`desc`、`maintainer`、`maintainer_url`、`platform`，`desktop_applaunchname` 用 `<appname>.Application` |
| PLAN-FNOS-001-T01-02 | compose 改造：删除 `1panel-network` 与 `labels.createdBy`，`container_name` 固定 `fn-<app>`，`${PANEL_APP_PORT_HTTP}` → 向导端口变量 |
| PLAN-FNOS-001-T01-03 | 向导：`wizard/install` 与 `wizard/config` 字段一致；有密钥/可选参数的应用（如 `lobe-chat`）用 `password`/`text` 字段补全；端口字段使用规约的 1—65535 严格正则 |
| PLAN-FNOS-001-T01-04 | 卸载向导 `wizard/uninstall` 提供「保留数据/删除数据」，`cmd/uninstall_callback` 依据 `wizard_data_action` 处理 |
| PLAN-FNOS-001-T01-05 | 文档：新增 `docs/apps/fn-<app>.md`，登记 `docs/apps/index.md` 与 `docs/.vitepress/config.mts` 导航 |
| PLAN-FNOS-001-T01-06 | 构建与实机验证：`fnpack build` + 目标 NAS `appcenter-cli install-local` |

推荐首批（按上游 `recommend` 排序）：`lobe-chat`(340) → `zabbix-agent`(63) → `it-tools` → `memcached` → `cyberchef` → `linux-command` → `web-check`。

### 阶段 2：T1 批次（规划中）

目标：93 个（98 个去掉 5 个同名应用）状态落盘改造应用。

| 任务 | 内容 |
| --- | --- |
| PLAN-FNOS-001-T02-01 | 卷改造：`./data` 相对挂载 → `${TRIM_PKGVAR}/data`；需要用户可见文件的（媒体库、下载目录）额外声明 `config/resource` 的 `data-share` |
| PLAN-FNOS-001-T02-02 | 权限对齐：`config/privilege` 用 `docker-fn-<app>`；容器内需要固定 UID/GID 的应用在 compose 里显式声明，不使用 root 运行 |
| PLAN-FNOS-001-T02-03 | 引导字段补全：把上游 `formFields` 的密码/密钥/时区字段翻译成向导字段 |
| PLAN-FNOS-001-T02-04 | 多版本应用按清单选定版本（如 `uptime-kuma` 选 2.5.5、`cyberchef` 选 11.5.0），只保留一套 compose |
| PLAN-FNOS-001-T02-05 | 同一套构建、文档与实机验证流程，按 10—15 个/批拆分提交 |

顺序建议：先无状态或弱状态（`it-tools` 类已归 T0）→ 单目录状态（`n8n`、`qinglong`、`filebrowser`）→ 媒体类（`navidrome`、`komga`、`jellyfin`，涉及共享目录与只读挂载）→ 业务类（`siyuan`、`stirling-pdf`、`trilium`）。

**Lead 实施分组（2026-10-10 侦察确定，按难度由易到难）**：

| 组 | 数量 | 特征 |
| --- | --- | --- |
| A | 57 | 单挂载目录，`./data → /xxx` 直接替换 |
| B | 23 | 2—3 条目录挂载 |
| C | 7 | 含**真·单文件**挂载（`./data/conf.yml → /app/conf.yml`，如 `dashy`、`glance`、`focalboard`） |
| D | 6 | 用户可见数据（媒体库：`navidrome`、`calibre-web`、`audiobookshelf` 等），需 `data-share` 决策 |

**第 1 组进度（A 组前 14 个，2026-10-10）**：`qinglong`、`clawswarm`、`maxkb`、`ai-portal`、`2fauth`、`gotify`、`answer`、`artalk`、`bytebase`、`certimate`、`changedetectionio`、`code-server`、`freshrss`、`linkding` 已产出，14/14 构建通过并经 Lead 独立复验。

**原列表中的 `excalidraw` 已移出 T1**：实测无任何卷挂载（无状态，不属 T1 形态），且镜像标签为 `latest`（规约禁止版本漂移）。

**本组新增的三条裁决**（详见 [1Panel 转换规约](/development/1panel-conversion) 的「模式 B 的三个补充裁决」）：

1. `PUID`/`PGID` 硬编码 1000 → 改用 `${TRIM_UID}`/`${TRIM_GID}`。真机取证：fnOS 包用户 UID 为动态分配的 9xx，数据目录 `mode=770` 属主为包用户，故 1000 必然失败。**该两个变量能否用于 compose 未经真机验证**（最高风险）。
2. 向导字段按「安装时必须由用户决定」取舍。`gotify` 29 字段（18 required）收敛为核心 6 个，省略项须在应用文档留出口。
3. 上游数据落盘缺陷必须修正而非照搬。`2fauth` 的 `DB_DATABASE` 原值落在挂载点之外（数据库会丢弃），已改到挂载内并在 `install_callback` 预创建目录；`APP_KEY` 由固定占位值改为必填随机值。

**TODO（PLAN-FNOS-001-T02-02 的细化）**：本条要求「容器内需要固定 UID/GID 的应用在 compose 里显式声明，不使用 root 运行」——经本组施工，细化为**使用 `${TRIM_UID}`/`${TRIM_GID}` 而非硬编码值**。

### 阶段 3：T2 批次（规划中）

目标：73 个（74 个去掉 1 个同名应用）资源集成类应用；本阶段先做 5 个试点，验证数据库联动方案后再放量。

| 任务 | 内容 |
| --- | --- |
| PLAN-FNOS-001-T03-01 | 数据库联动方案：把上游 `type: apps`/`service` 联动字段拆成 fnOS 向导的显式连接字段（参考 [fn-halo](/apps/fn-halo) 的 `DB_TYPE`/`DB_HOST`/`DB_USERNAME`/`DB_PASSWORD`） |
| PLAN-FNOS-001-T03-02 | Redis 类：`manifest` 声明 `install_dep_apps=redis`，连接串由向导提供（参考 [fn-new-api](/apps/fn-new-api)） |
| PLAN-FNOS-001-T03-03 | 多端口应用（`nginx-proxy-manager`、`sftpgo`、`adguardhome`、`openlist`）拆成独立向导字段与入口，非 HTTP 端口默认不暴露桌面入口 |
| PLAN-FNOS-001-T03-04 | 多容器应用（`affine`、`discourse`、`tailchat`、`twenty`、`zabbix-server`、`rocketmq`、`langbot`）确认 compose 内服务互通与数据卷归属 |
| PLAN-FNOS-001-T03-05 | 试点 5 个：`umami`(350)、`nginx-proxy-manager`(90)、`sftpgo`(80)、`openlist`(65)、`gitea`(53)；试点通过后再排剩余 68 个 |

前置条件：`zabbix-agent`、`zabbix-proxy`、`zabbix-server`、`gitea` 这类应用在 1Panel 里靠「服务选择器」自动填数据库地址，fnOS 没有等价能力，必须先在交互上验证「手填连接串 + 连接失败提示」是可接受的用户路径。

### 阶段 4：决策与收敛（不在本计划实施范围内）

| 主题 | 需要确认的事实 | 影响 |
| --- | --- | --- |
| T3 运行环境（12 个） | fnOS 是否提供等价的运行时依赖应用；`install_dep_apps` 只能声明应用名，无法声明「PHP 8.2 + 扩展集」 | 决定 `php*`、`node`、`python`、`java` 等是否上架 |
| T3 数据库/中间件（34 个） | 与 fnOS 已有 `redis` 等应用是否重复；是否改为依赖而非独立上架 | 决定 20 个中间件与 14 个数据库应用的归属 |
| T4 高风险（33 个） | fnOS 是否允许 `docker.sock`、`privileged`、host 网络、设备直通；`run-as: package` 是否足够 | 决定 `home-assistant`(320)、`ddns-go`(300)、`frpc`/`frps` 等是否可转 |

其中确定不建议转换的：`windows`（需要 `/dev/kvm` 与 `NET_ADMIN`，与 NAS 场景和权限模型冲突）、`vllm`（需要 GPU 设备直通，fnOS 已有 `trim.ai-runtime-*` 运行时）、`docker-registry`（与 fnOS 内置镜像能力重叠，建议先做单点确认）。

## 详细交互

### P0：转换准备（维护者流程）

1. 维护者从[转换清单](/development/1panel-conversion-inventory)挑选目标应用，确认级别与改造点。
2. 执行 `fnpack create fn-<app> --template docker`，得到基础骨架（不删除模板文件）。
3. 按规约改写 `manifest`、compose、`config/*`、`wizard/*`；图标由管线生成。
4. 本地 `fnpack build`；目标 NAS 上 `appcenter-cli install-local`。
5. 验收通过后追加 `docs/apps/fn-<app>.md`，写 `docs/validation/<功能 ID>-<环境>-<日期>.md`。

失败处理：`fnpack build` 失败优先检查图标尺寸与 JSON 格式；安装失败看 `TRIM_TEMP_LOGFILE` 输出；容器起不来检查端口占用与卷权限。

### P1：用户安装交互（所有批次共用）

1. 用户在应用中心搜索应用名，点击安装。
2. 弹出安装向导：第一屏是端口与基础配置，第二屏（仅 T1/T2 应用）是数据目录与数据库/Redis 连接信息。
3. 端口字段：必填、数字、范围 1—65535；默认值为上游默认端口；冲突时提示用户改端口。
4. 密钥类字段使用 `password` 类型，不回显；提交后写入应用配置目录，随向导变量注入容器。
5. 安装完成后桌面出现入口；入口端口与用户填写的端口一致（`app/ui/config` 的 `port` 引用同一个向导变量）。
6. 应用设置页可再次打开向导（`wizard/config`）修改配置；保存后 `cmd/config_callback` 负责重载容器。
7. 卸载时第二屏询问「保留数据（推荐）/ 删除所有数据」；选择删除时提示不可恢复；默认保留。

状态与反馈：

| 场景 | 期望表现 |
| --- | --- |
| 端口被占用 | 安装向导校验或启动后 `cmd/main status` 返回非 0，应用中心显示未运行 |
| 数据库连接信息错误 | 应用能启动但功能页报错；安装向导的 `helpText` 必须给出连接串格式示例 |
| 首次访问无数据 | 应用自身初始化页面负责，不额外做空状态 |
| 卸载选择保留数据 | 重装后数据仍在，端口沿用上次或重新选择 |

## 数据、权限和错误处理

- **数据持久化**：容器数据统一落 `${TRIM_PKGVAR}`（目标 NAS 路径为 `/var/apps/fn-<app>/var/`），用户可见内容才进 `data-share`。
- **敏感信息**：向导收集的密码通过环境变量注入，不写入仓库、不写进文档示例；`wizard/uninstall` 删除数据前必须二次确认。
- **权限边界**：默认 `run-as: package` + `docker-fn-<app>`；需要访问共享目录时由 `data-share` 的 `permission` 授权，不使用 `join-groups` 提权。
- **错误分类**：构建错误（图标/JSON）、安装错误（依赖缺失、端口占用）、运行错误（卷权限、数据库连不上）、卸载错误（数据删除失败）分开处理，并在文档中给出排查路径。
- **重试策略**：`cmd/main status` 在容器缺失时负责重建（参考 [fn-zentao](/apps/fn-zentao) 的 `ensure_containers_created`），不依赖用户手动 `docker compose up`。

## 依赖、风险和决策

| 项 | 说明 | 处理 |
| --- | --- | --- |
| 图标生成工具缺失 | 本机无 ImageMagick/`sips`/Pillow/sharp；183/265 上游图标小于 256²（多为 180²），需放大 | 阶段 0 必须先选定方案，否则全部批次阻塞 |
| 上游 GPL-3.0 vs 本仓库 AGPL-3.0 | 直接复制上游文件可能引入许可问题 | 只提取配置事实，不复制文件内容，在规约中写死 |
| fnOS 无服务选择器 | 上游 74 处 `service`/`apps` 联动字段必须改为手填 | T2 试点先验证用户路径 |
| 端口语义差异 | 1Panel 端口由表单分配（默认值多样），fnOS 由 `manifest.service_port` 与入口共同体现 | 规约固定「沿用上游默认端口 + 向导可改」 |
| 22 个应用绑定宿主 `/etc/timezone` | fnOS 上路径可能存在但权限不同 | 统一改用 `TZ` 环境变量，需在试点中验证 |
| 多版本应用选型 | 上游 40 个应用有多版本 | 每个应用只选一个版本，在清单中记录选择结果 |
| 上游持续更新 | 上游 `renovate` 每周自动升级镜像标签 | 转换完成的镜像版本以本仓库 `manifest`/compose 为准，不做自动跟随 |
| 工作量大 | 转换 + 实机验证约 180 个应用（T0—T2 去重后） | 按批次提交，T0 → T1 → T2 逐级验证后再放量 |

## 测试、打包和发布

- **工具链级**：`pnpm install` → `pnpm run check -- --all`（SDD 结构校验 + VitePress 构建）、`pnpm run lint`。
- **应用级**：`fnpack build` 产物包含 `manifest`、`app/`、`cmd/`、`config/`、`wizard/`、两个图标；compose 能被 `docker compose config` 解析。
- **目标 NAS 验收**：`appcenter-cli install-local` 或 `appcenter-cli install-fpk` 安装，验证启动、桌面入口、重启保留、卸载保留数据、升级读取旧数据；证据写入 `docs/validation/`（目标 NAS 路径不能替代本地构建结论）。
- **文档**：`pnpm run build -- --docs`；新增应用必须同时更新 `docs/apps/index.md` 与 `.vitepress/config.mts` 导航（`check` 不校验导航，需人工确认）。
- **发布**：按批次提交，走现有 `v<版本号>` tag 流程；应用版本与项目版本由 `pnpm run version` 统一处理。
- **回滚**：应用出问题时从 Release 撤下对应 FPK；已安装用户通过应用中心卸载，卸载向导默认保留数据，禁止在回滚流程中删除用户数据。

## 参考资料

| 能力 | 链接 | 用途 |
| --- | --- | --- |
| fnOS 应用开发文档首页 | https://developer.fnnas.com/ | 官方文档入口 |
| Docker 应用案例 | https://developer.fnnas.com/docs/examples/docker | 模板结构与最小示例 |
| Manifest | https://developer.fnnas.com/docs/core-concepts/manifest | 字段语义与取值范围 |
| 应用资源 | https://developer.fnnas.com/docs/core-concepts/resource | `docker-project`、`data-share` |
| 应用权限 | https://developer.fnnas.com/docs/core-concepts/privilege | `run-as`、运行用户 |
| 用户向导 | https://developer.fnnas.com/docs/core-concepts/wizard | 向导字段类型与校验 |
| 环境变量 | https://developer.fnnas.com/docs/core-concepts/environment-variables | `TRIM_*` 路径与运行时上下文 |
| 应用依赖 | https://developer.fnnas.com/docs/core-concepts/dependency | `install_dep_apps` |
| 中间件服务 | https://developer.fnnas.com/docs/core-concepts/middleware | Redis/MinIO/RabbitMQ 约定 |
| 图标规范 | https://developer.fnnas.com/docs/core-concepts/icon | 尺寸、格式与入口图标 |
| 打包工具 | https://developer.fnnas.com/docs/cli/fnpack | `fnpack create/build` |
| 应用中心 CLI | https://developer.fnnas.com/docs/cli/appcentercli | `install-local`、`install-fpk` |
| 上游应用商店 | https://github.com/1Panel-dev/appstore | 应用源与版本来源 |
| 库存参考应用 | `apps/fn-zentao`、`apps/fn-halo`、`apps/fn-new-api`、`apps/fn-bitwarden` | 现成的 compose、向导和生命周期实现 |

本仓库内引用：转换清单 `docs/development/1panel-conversion-inventory.md`、SDD 规范 `/development/sdd-workflow`、仓库结构 `/development/repository-structure`。

## 完成状态

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| 阶段 0 转换准备 | 待完成 | 转换清单（14/98/74/46/33）与转换规约已完成；图标管线 `scripts/generate-icons.mjs` 已交付并通过本地验证。**本机 `appcenter-cli` 因权限不可用，无法执行 `appcenter-cli install-local` 做安装回归，故阶段 0 维持「待完成」而非「已完成」** |
| 阶段 1 T0 批次（14） | 待完成 | **14 个应用全部产出**：首批 3 个（`fn-it-tools`/`fn-linux-command`/`fn-adminer`）+ 本轮 11 个（`fn-browserless`、`fn-chatgpt-next-web`、`fn-cloudflared`、`fn-cyberchef`、`fn-llama-cpp`、`fn-lobe-chat`、`fn-memcached`、`fn-web-check`、`fn-wechatmarkdowneditor`、`fn-yesplaymusic`、`fn-zabbix-agent`），逐个构建通过并由 Lead 独立复验 11/11；静态规范核对（图标四件套、权限、向导字段同名、入口 ID ≤32 且前缀正确、无上游残留）全量通过。**覆盖范围提示**：正式测试用例目前只覆盖首批 3 个应用（[T0 第一轮报告](/testing/FNOS-001-t0-round1-report)），11 个新应用尚未用例化。**真机验证（2026-10-10）**：`fn-it-tools` 安装成功、端口正常服务、启停与卸载（删除数据）全通过，**04-AC-02 通过**、**04-AC-03 部分通过**；**04-AC-06、05-AC-01、06-AC-01 仍未执行**。阶段状态维持「待完成」——本地构建完成不等于批次完成 |
| 阶段 2 T1 批次（93） | 规划中 | 未开始 |
| 阶段 3 T2 批次（73，先 5 个试点） | 规划中 | 未开始；需先确认数据库联动方案（fnOS 无服务选择器） |

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-09 | 建立计划：确定 T0—T4 分级口径、四个阶段与批次顺序；登记图标管线缺失为阶段 0 阻塞项。 |
| 2026-10-09 | 同步分级口径修正：`cap_add` 归入 T4，T1 调整为 88（去重后）、T2 调整为 75（去重后）。 |
| 2026-10-09 | 同步权威分级（14/98/74）：阶段 1 目标 17→14，阶段 2 目标 88（92−4）→93（98−5），阶段 3 目标 75（77−2）→73（74−1），剩余试点后数量 70→68；推荐首批移除 `dbhub`（已由 T0 调整为 T2），T01-03 的向导示例同步。 |
| 2026-10-09 | 登记测试用例目录 `docs/testing/`（文件命名 `FNOS-001-test-cases.md`）到「实现范围和边界」，明确它与 `docs/validation/` 的分工；新增转换规约 `docs/development/1panel-conversion.md`（阶段 0 的 T00-01 产出，导航登记与图标管线仍在进行）。 |
| 2026-10-09 | 更新完成状态：阶段 0 改为「待完成」（图标管线已交付，但受 `appcenter-cli` 权限阻塞无法做安装回归）；阶段 1 改为「待完成」（试点 3 应用已产出并通过本地验收，5 个依赖目标 NAS 的验收条件仍阻塞）。登记 D-01 修复与 D-02 订正对阶段判读的影响。 |
| 2026-10-10 | T0 收尾：剩余 11 个应用完成。新发现并修复 `fn-wechatmarkdowneditor` 入口 ID 超 32 字符导致打包失败（改用 `.main`），该规则已写入转换规约。11/11 应用由 Lead 独立复验构建通过。 |
| 2026-10-10 | 在「实现范围和边界」登记入口约束：入口键须以 `appname` 为前缀且 ≤32 字符、无 Web UI 应用 `app/ui/config` 为 `{}`；完成状态补「测试用例目前只覆盖首批 3 个应用」的覆盖范围提示，避免把 11 个新应用的构建通过读成用例化验收。 |
| 2026-10-10 | T1 批次启动：确定 A/B/C/D 四组实施分组；第 1 组 14 个应用完成（14/14 构建通过）。新增三条裁决（PUID→`TRIM_UID`、向导字段取舍、上游落盘缺陷修正）。`excalidraw` 移出 T1（无状态 + `latest` 镜像）。`T02-02` 的权限要求细化为使用 `TRIM_UID`/`TRIM_GID`。 |
