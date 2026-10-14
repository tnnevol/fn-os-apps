---
title: 1Panel 转 fnOS 转换规约
description: 把 1Panel 应用商店应用转换为 fnOS FPK 应用的命名规约、字段映射表、compose 改造模式和禁止项。
---

# 1Panel 转 fnOS 转换规约

本规约是 [FNOS-001 需求](/requirements/FNOS-001-1panel-app-conversion) 与 [PLAN-FNOS-001 计划](/plans/PLAN-FNOS-001-1panel-app-conversion) 的执行细则，配合 [1Panel 应用转换清单](/development/1panel-conversion-inventory) 使用：清单回答「哪个应用属于哪一级、要改什么」，本文回答「具体怎么改」。

上游 `1Panel-dev/appstore`（工作区检出的 `appstore/`）**只读参考**，任何情况下都不修改、不复制其文件内容。文中的字段语义以飞牛应用开放平台文档为准，不自行发明字段。

## 使用方式

```text
1. 在清单里查到目标应用的分级与改造点
2. 按「命名规约」确定 appname、目录名、容器名和运行用户
3. 按「字段映射表」把上游变量逐个翻译成 fnOS 字段
4. 按「compose 改造模式」改写 app/docker/docker-compose.yaml
5. 按「配置文件模板」补齐 manifest、config/、wizard/、cmd/、app/ui/config
6. 按「自检清单」逐项确认后再进入构建与实机验收
```

分级口径见清单的「盘点口径」，本文不重复。级别与主要改造的对应关系：

| 级别 | 主要改造 |
| --- | --- |
| T0 | 命名、网络、入口；无状态落盘改造 |
| T1 | 相对挂载改 `TRIM_PKGVAR`；补卸载数据保留向导 |
| T2 | 联动字段拆成显式连接字段；多端口拆入口；多容器确认服务互通 |
| T3 / T4 | 不在本规约的批量改造范围内，先做能力与权限决策 |

## 命名规约

同一应用在六个位置必须使用同一个 `<app>` 词干，且全部小写、连字符分隔。

| 位置 | 规则 | 示例（上游 `it-tools`） |
| --- | --- | --- |
| 应用目录 | `apps/fn-<app>/` | `apps/fn-it-tools/` |
| `manifest.appname` | `fn-<app>` | `fn-it-tools` |
| 容器名 | `container_name` 固定为 `fn-<app>` | `fn-it-tools` |
| compose 项目名 | 生命周期脚本统一用 `-p "$TRIM_APPNAME"` | `-p fn-it-tools` |
| `config/privilege` | `username` / `groupname` 使用 `docker-fn-<app>` | `docker-fn-it-tools` |
| `config/resource` | `docker-project.projects[].name` 与共享目录顶级名用 `fn-<app>` | `fn-it-tools` |
| 桌面入口 ID | `<appname>.Application`，与 `desktop_applaunchname` 一致；**总长必须 ≤ 32 字符**，超限时改用 `<appname>.main` | `fn-it-tools.Application`（23） |
| 应用文档页 | `docs/apps/fn-<app>.md` | `docs/apps/fn-it-tools.md` |

派生规则：

- **下划线归一**：上游应用键含下划线时改连字符，例如 `act_runner` → `fn-act-runner`、`obsidian_livesync` → `fn-obsidian-livesync`（上游仅这两个）。仓库既有的 `fn-mysql_v8` 是历史命名，不据此推广。
- **容器名与项目名一致**：`container_name` 必须等于 `manifest.appname`，也等于 `-p $TRIM_APPNAME` 传入的项目名。三处不一致会导致 `cmd/main status` 检查不到容器。
- **不要用 `${CONTAINER_NAME}`**：上游 263 个应用使用该变量，全部改写为字面量 `fn-<app>`。
- **共享目录命名**：`data-share` 顶级目录用 `fn-<app>`，需要用户可见的子目录用 `fn-<app>/<用途>`（参考 [fn-halo](/apps/fn-halo) 的 `fn-halo/halo2`）。不要在版本之间改共享目录名，否则升级会让用户看不到老数据。

## 上游 → fnOS 字段映射表

### 端口

| 上游 | fnOS | 约束 |
| --- | --- | --- |
| `PANEL_APP_PORT_HTTP` | 向导字段 `APP_PORT`（`text` + 数字校验） | 默认值取上游该字段的 `default`；`${APP_PORT}:<容器端口>`；同时写入 `app/ui/config` 的 `port` |
| `PANEL_APP_PORT_HTTPS` | 独立向导字段 + 独立入口 | 证书由用户自备；默认只提供 HTTP 入口，HTTPS 入口不进 `desktop_applaunchname` |
| `PANEL_APP_PORT_SSH`、`PANEL_APP_PORT_*` 等非 HTTP 端口 | 各自独立向导字段 | 非 HTTP 端口**不建**桌面入口，只在向导和 compose 中体现 |
| 同一应用多个 HTTP 端口 | 每个端口一个字段、一个入口 | 入口标题区分用途，例如「管理台」「Web 客户端」 |

端口字段统一校验：必填；范围 1—65535 **用单条严格正则完整覆盖**，不依赖 `min`/`max`（其语义在官方文档中未明确定义，跨字段类型解释不一致）：

```text
^(?:[1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$
```

该正则已全量验证：1—65535 全部通过（无遗漏）；`0`、`65536`、`70000`、`-1`、`1.5`、`abc`、空串、`040116`（前导零）、前后空格、`+80`、`0x50` 全部拒绝。不要改用 `^[0-9]+$`：它不挡越界，与「范围 1—65535」并列会自相矛盾。

上游 `default` 是唯一默认值来源，不要自行改端口。

### 时区

| 上游 | fnOS | 约束 |
| --- | --- | --- |
| `TZ`、`TIME_ZONE` | 向导字段 `TIME_ZONE`，默认 `Asia/Shanghai`；compose 内写 `TZ=${TIME_ZONE}` | 上游两种变量名都收敛到同一个字段 |
| `/etc/timezone:/etc/timezone:ro`、`/etc/localtime:/etc/localtime:ro` 绑定挂载 | **删除挂载**，改用 `TZ` 环境变量 | 上游 22 个应用使用该写法；宿主 `/etc/timezone` 在 fnOS 上的可用性未确认，不依赖它 |

### 数据库与联动字段

上游 `type: apps` 字段（配 `child.type: service`）是 1Panel 的服务选择器：用户在 1Panel 里选一个已装数据库，平台自动填 `PANEL_DB_HOST`。**fnOS 没有等价的服务选择器**，必须改成用户显式填写的连接字段。

| 上游 | fnOS 向导字段 | 说明 |
| --- | --- | --- |
| `PANEL_DB_TYPE`（`type: apps`） | `DB_TYPE`（`select`） | 选项取自上游 `values`，例如 mysql / postgres / mariadb |
| `PANEL_DB_HOST`（`child`，由平台注入） | `DB_HOST`（`text`） | 用户手填，格式 `地址:端口/数据库名`，参考 [fn-halo](/apps/fn-halo) 的校验正则 |
| `PANEL_DB_PORT` | 合并进 `DB_HOST`，或单独 `DB_PORT` | 同一应用内只选一种写法，不要两处都填 |
| `PANEL_DB_NAME` | `DB_NAME`（`text`） | 上游 `random: true` 只在 1Panel 内生效，fnOS 侧给出建议值即可 |
| `PANEL_DB_USER` | `DB_USERNAME`（`text`） | — |
| `PANEL_DB_USER_PASSWORD` | `DB_PASSWORD`（`password`） | 不回显；不写进仓库、日志和示例 |
| `PANEL_DB_ROOT_USER`、`PANEL_DB_ROOT_PASSWORD`、`PANEL_DB_PASSWORD` | 默认**删除** | 只有应用确实需要 root 凭据时才保留为独立字段，并在计划中记录理由 |
| `type: service` 子字段本身 | 无对应物 | 它由平台自动填充，不是用户输入项 |
| `DBHUB_DB_*` | 各字段对应 `DB_TYPE`/`DB_NAME`/`DB_USER`/`DB_USER_PASSWORD`/`DB_ADDRESS`/`DB_PORT` | 与 `PANEL_DB_*` 同义，同样代表**需要外部数据库**，不要因为变量名不同就漏判 |

**判定「是否依赖外部数据库」的口径**（决定应用归 T2 还是 T1）：只有 compose 使用 `PANEL_DB_*` 或 `DBHUB_DB_*` 变量（即需要用户提供外部数据库实例）才算外部数据库依赖。容器内自带的 SQLite（`DB_DATABASE=...sqlite`、`*_DATABASE_DRIVER: sqlite`、`GOTIFY_DATABASE_DIALECT=sqlite3`）与镜像内置数据库（`MYSQL_INTERNAL=true`）**不算**，这类应用按状态落盘处理（T1），转换重点是卷路径而非连接字段。反面教训：按「env 里出现 `DATABASE` 字样」判断，会把 `2fauth`、`ai-gateway`、`gotify`、`zentao` 这类自带数据库的应用误判为 T2；只看 `PANEL_DB_*` 又会漏掉用 `DBHUB_DB_*` 的 `dbhub`。

`helpText` 必须给出连接串格式示例并说明连接失败的表现。上游靠平台保证连通性，fnOS 靠用户输入，这是转换后最大的行为差异。

### Redis 与其他中间件

| 上游 | fnOS | 约束 |
| --- | --- | --- |
| `PANEL_REDIS_HOST`、`PANEL_REDIS_PORT`、`PANEL_REDIS_ROOT_PASSWORD` | `manifest` 声明 `install_dep_apps=redis`，向导提供 `REDIS_CONN_STRING` | 依赖应用由宿主安装，**不在包内固定地址**；参考 [fn-new-api](/apps/fn-new-api) |
| `PANEL_VALKEY_ROOT_PASSWORD`、`PANEL_KEYDB_ROOT_PASSWORD` | 同 Redis：`install_dep_apps` + 连接串字段 | 以上游实际中间件类型为准，不要一律写成 redis |
| `PANEL_MINIO_ROOT_USER`、`PANEL_MINIO_ROOT_PASSWORD` | `install_dep_apps=minio` + 端点与凭据字段 | 见飞牛「中间件服务」文档的约定 |

`install_dep_apps` 只能声明应用名和最低版本（`>`），**无法声明**「PHP 8.2 + 指定扩展集」这类组合能力。因此运行时类应用（T3）不适用本节的映射，需要先做宿主依赖契约决策。

### 存储与挂载

| 上游 | fnOS | 约束 |
| --- | --- | --- |
| `./data`、`./conf` 等相对挂载 | `${TRIM_PKGVAR}/<子目录>`（目标 NAS 路径 `/var/apps/fn-<app>/var/`） | 禁止把运行数据写进 FPK 安装目录（`TRIM_APPDEST` 只放只读资源）。上游按「行首 `- ` 后接可选引号再接 `./`」口径计为 223 个应用，其中真实 `./` volume 挂载 222 个，差额 1 个是仅出现在 `env_file:` 段的 `zitadel`（该口径不影响分级）；复算方式见[转换清单](/development/1panel-conversion-inventory)的「盘点口径」 |
| 用户需要直接看到/导入/导出的数据（媒体库、下载目录、书签文件） | `config/resource` 声明 `data-share`，路径从 `TRIM_DATA_SHARE_PATHS` 取 | 声明后卸载向导必须能区分「删应用」与「删用户数据」 |
| 外部命名卷（`volumes:` 下 `external: true`） | 改为 `${TRIM_PKGVAR}` 绑定挂载 | 上游仅 `maddy-mail`、`synapse` 两处；外部卷在 fnOS 上不会被自动创建 |
| 挂载源是**宿主绝对路径**（`/etc/1panel`、`/showdoc_data` 等） | **删除该行**，其余相对挂载照常改造 | fnOS 上不存在这些路径，保留会导致挂载失败。判据是**挂载源是否为宿主绝对路径**，与是否 1Panel 专属无关。已命中：`ai-gateway`（`/etc/1panel`）、`showdoc`（`/showdoc_data:/showdoc_data_old`，版本迁移遗留） |
| `PANEL_WEBSITE_DIR` | 需要用户授权目录时用 `TRIM_DATA_ACCESSIBLE_PATHS` / `data-share` | 上游 16 处，集中在 T3 Web 服务器类，需随依赖契约一并决策 |

### 网络、标签与其他

| 上游 | fnOS | 约束 |
| --- | --- | --- |
| `networks: - 1panel-network` 与顶层 `networks: 1panel-network: external: true` | **整体删除** | fnOS 由 compose 项目网络接管；上游 257 个应用命中 |
| `labels: createdBy: "Apps"` | **删除** | 1Panel 应用商店自有标记，fnOS 无对应概念 |
| 镜像标签为**可变引用**（`:latest`、`:master`、`:main`、`:dev`、`:edge`、`:stable`、无标签） | **不转换**，先选定固定版本再进批次 | 可变标签会随上游更新漂移，构建不可复现。**全量扫描（265 个应用）共命中 14 个**：`affine`(`stable`)、`dvwa`、`excalidraw`、`huginn`、`jsonhero`、`jupyter-notebook`、`koodo-reader`(`master`)、`lsky-pro`、`mcsmanager-daemon`、`mcsmanager-web`、`openvpn`、`palworld`、`redis-commander`、`teable`（均 `:latest`）。**筛选时须用宽判据，不能只匹配 `:latest`** |
| `labels: skipStatusCheck: "true"` | **删除** | 1Panel 状态检查专用；多容器迁移任务在 fnOS 侧改为 `cmd/main` 的实际探测逻辑 |
| `${CONTAINER_NAME}` | 字面量 `fn-<app>` | — |
| `env_file` | 展开成 compose 内的 `environment` | fnOS 侧不保证 `env_file` 路径存在；上游 4 个应用命中，属 T4 待确认项 |
| `build:` | **不使用** | 包内不含构建上下文，必须换用可拉取的镜像 |
| 镜像标签 | 保持上游标签，或明确升级并在变更记录写明差异 | 上游 12 处 `:latest` 必须先解析为具体版本标签；含 `${PANEL_DB_TYPE}` 这类插值的镜像（如 `umami`）必须选定一个具体镜像写死 |
| `restart`、`healthcheck`、`depends_on`、`command`、`entrypoint` | 保留 | 只删除 1Panel 专有语义，不动应用自身编排逻辑 |

### 表单多语言

上游 `data.yml` 的 `formFields` 用 `label` 对象承载十几种语言（`labelZh`、`labelEn`、`label` 的 `en`/`ja`/`ko` 等）。fnOS 向导只保留**中文**：

| 上游 | fnOS | 约束 |
| --- | --- | --- |
| `labelZh` / `label.zh` | 向导字段的 `label` | 取中文文案；没有中文时用 `labelEn` 翻译，不要直接留英文 |
| `labelEn` 及其他语言 | 丢弃 | 仓库文档、向导 `label` 和 `helpText` 一律用中文 |
| `label` 里没有对应语言 | 回退到 `labelEn` | 回退后仍需通顺，必要时改写 |
| `default` | 向导字段的 `initValue` | 默认值语义与上游保持一致 |
| `required`、`rule: paramPort` | `rules` 的 `required` 与端口正则 | `paramPort` 翻译为上一节的严格正则，不要照抄上游规则名 |
| `random: true` | 丢弃，改给建议值 | 随机生成只在 1Panel 内生效，fnOS 侧给可运行的默认值 |
| `type: number` / `password` / `select` / `text` | `text`（配数字正则）/ `password` / `select` / `text` | 控件类型按飞牛「用户向导」文档的字段类型映射 |
| 应用展示信息 `name`、`shortDescZh` | `manifest.display_name`、`manifest.desc` | 见「配置文件模板」；`recommend`、`tags` 等 1Panel 排序字段不写入 manifest |

## compose 改造模式

三个例子都是上游真实片段，改造后可直接作为同类应用的模板。

### 模式 A：T0 直接套模板（it-tools）

上游 `appstore/apps/it-tools/2024.10.22-7ca5933/docker-compose.yml`：

```yaml
services:
  it-tools:
    image: corentinth/it-tools:2024.10.22-7ca5933
    container_name: ${CONTAINER_NAME}
    restart: always
    networks:
      - 1panel-network
    ports:
      - ${PANEL_APP_PORT_HTTP}:80
    labels:
      createdBy: "Apps"
networks:
  1panel-network:
    external: true
```

改造后 `apps/fn-it-tools/app/docker/docker-compose.yaml`：

```yaml
services:
  it-tools:
    image: corentinth/it-tools:2024.10.22-7ca5933
    container_name: fn-it-tools
    restart: always
    ports:
      - "${APP_PORT}:80"
```

改动点：容器名写死；删 `networks` 与顶层 `networks` 块；删 `labels`；端口变量换成向导字段 `APP_PORT`（默认值取上游 `default`，即 40116）。应用无状态，不需要 `volumes`。

### 模式 B：T1 状态落盘改造（n8n）

上游 `appstore/apps/n8n/2.42.3/docker-compose.yml`：

```yaml
services:
  n8n:
    image: n8nio/n8n:2.42.3
    container_name: ${CONTAINER_NAME}
    restart: always
    networks:
      - 1panel-network
    ports:
      - ${PANEL_APP_PORT_HTTP}:5678
    volumes:
      - ./data:/home/node/.n8n
    environment:
      N8N_SECURE_COOKIE: false
    labels:
      createdBy: "Apps"
networks:
  1panel-network:
    external: true
```

改造后 `apps/fn-n8n/app/docker/docker-compose.yaml`：

```yaml
services:
  n8n:
    image: n8nio/n8n:2.42.3
    container_name: fn-n8n
    restart: always
    ports:
      - "${APP_PORT}:5678"
    volumes:
      # 目标 NAS 运行时数据目录（TRIM_PKGVAR 由 fnOS 注入），不是开发机路径
      - "${TRIM_PKGVAR}/data:/home/node/.n8n"
    environment:
      - N8N_SECURE_COOKIE=false
      - TZ=${TIME_ZONE}
```

改动点：`./data` 相对挂载改为 `${TRIM_PKGVAR}/data`；补 `TZ`（上游未标注时区，仍按统一字段补齐）；`environment` 从映射写法统一为列表写法以匹配仓库现有风格；容器名、网络、标签同上。

> 上例中的 `/home/node/.n8n` 是 **n8n 镜像内部**的运行目录，不是开发机路径；`${TRIM_PKGVAR}` 才是指向目标 NAS 的路径，由 fnOS 在生命周期中注入。

n8n 的 `wizard/uninstall` 必须提供「保留数据 / 删除数据」二选一，`cmd/uninstall_callback` 依据 `wizard_data_action` 处理 `${TRIM_PKGVAR}`。

### 模式 B 的三个补充裁决（T1 批次实测沉淀）

以下三项在 T1 第 1 组施工中由实际应用暴露，均已裁决并有真机取证。**T1 后续批次直接照用，不要重新发明。**

#### 1. `PUID`/`PGID` 必须改用 `${TRIM_UID}`/`${TRIM_GID}`

linuxserver 系镜像（`linuxserver/code-server`、`linuxserver/freshrss` 等）硬编码 `PUID=1000`/`PGID=1000`。**在 fnOS 上这是错的**，真机取证：

```
fnOS 包用户 UID 是动态分配的，不是 1000：
  docker-fn-it-tools  UID 928      docker-fn-cyberchef UID 927
  docker-fn-halo      UID 969      docker-fn-reader    UID 975
uid 1000 在本机是普通登录用户 tnnevol

数据目录权限：
  /vol4/@appdata/fn-halo    owner=docker-fn-halo(969)  mode=770
  /vol4/@appdata/fn-reader  owner=docker-fn-reader(975) mode=770
```

目录属主是**包用户**、权限 **770**（组与其他用户无权），因此容器以 uid 1000 写入必然失败。

```yaml
# 错误（上游原样）
- PUID=1000
- PGID=1000

# 正确
- PUID=${TRIM_UID}
- PGID=${TRIM_GID}
```

`TRIM_UID`（应用用户 ID）与 `TRIM_GID`（应用用户组 ID）见飞牛《环境变量》文档「用户和权限上下文」章节。

**依据强度说明（重要，勿高估）**：官方《环境变量》文档**列出了**这两个变量，但**没有任何 compose 示例使用它们**——官方 Docker 案例只出现 `${TRIM_APPDEST}` 与 `${TRIM_SERVICE_PORT}`，本仓库既有 33 个应用在 compose 中使用 `${TRIM_PKGVAR}` 亦为旁证。**这些只能证明「fnOS 会把部分 `TRIM_*` 注入 compose 环境」，不能证明 `TRIM_UID`/`TRIM_GID` 也在其中。**

> **待真机验证（优先级最高）**：若这两个变量未被注入 compose，compose **不会报错**，而是**静默传入空值**：
>
> ```text
> warning: The "TRIM_UID" variable is not set. Defaulting to a blank string.
> PUID: ""        ← PUID 变为空字符串
> exit=0          ← 不失败
> ```
>
> 属**静默失败**，构建与解析环节都拦不住，只能靠真机看容器日志里 `PUID` 是否为 9xx、数据能否写入。**使用这两个变量的应用必须在真机验收时优先验证**；若确认未注入，需改为其他权限方案并重新裁决。

#### 2. 向导字段按「安装时必须由用户决定」取舍，不照搬上游全量

上游把整个应用配置文件暴露成向导字段的情况存在（`gotify` 有 **29 个 envKey、其中 18 个 required**，涵盖 SSL/CORS/流配置）。**全部搬进安装向导不可取**——这些是部署后可按需调整的高级配置，不是安装时的必经决策。

取舍原则：

| 类别 | 处理 |
| --- | --- |
| 安装时必须决定的（端口、时区、初始管理员账号、访问令牌） | 搬进向导 |
| 部署后可改的高级配置（SSL、CORS、外发 SMTP、插件路径） | 省略，用镜像默认值 |
| 平台专属凭据（`PANEL_DB_ROOT_*` 等） | 默认删除，见「数据库与联动字段」 |

**省略字段必须留出口**：在 `docs/apps/fn-<app>.md` 增「高级配置」小节，列出被省略的字段名与修改方式。减功能不能让用户找不到路。

#### 3. 上游数据落盘缺陷要修正，不要照搬

`2fauth` 上游 compose 存在**真实缺陷**：

```yaml
volumes:
  - ./data:/2fauth
environment:
  - DB_DATABASE="/srv/database/database.sqlite"   # /srv/database 不在 /2fauth 挂载内
```

数据库落在**容器可写层**，容器重建即丢——而 T1 的全部意义就是修这个问题，**照搬等于没做 T1**。

**做法**：改到挂载目录内（`DB_DATABASE=/2fauth/database/sqlite.db`），并在 `cmd/install_callback` 预创建目录（`mkdir -p "${TRIM_PKGVAR}/data/database"`）。

**同类问题**：若某个上游应用的持久化路径落在挂载点之外，按此处理并**在遗留风险里单列**，因为「镜像是否接受任意路径」需要真机确认。

另注意 `2fauth` 的 `APP_KEY=SomeRandomStringOf32CharsExactly` 是**示例占位值**——固定密钥意味着所有安装共享同一加密密钥，属安全风险，必须改为向导字段（`password`、`required`，`helpText` 说明「32 位随机字符串，安装后不要更改」）。

**通用原则**：上游配置**不总是正确的**。发现数据落盘路径不在挂载内、示例占位凭据、平台专属路径等问题时，**修正并登记**，而不是忠实照搬。

### 模式 C：T2 资源集成改造（gitea）

上游 `appstore/apps/gitea/27.3.4/docker-compose.yml`：

```yaml
services:
  gitea:
    image: commitgo/gitea-ee:27.3.4
    container_name: ${CONTAINER_NAME}
    environment:
      - USER_UID=1000
      - USER_GID=1000
      - GITEA__database__DB_TYPE=${PANEL_DB_TYPE}
      - GITEA__database__HOST=${PANEL_DB_HOST}:${PANEL_DB_PORT}
      - GITEA__database__NAME=${PANEL_DB_NAME}
      - GITEA__database__USER=${PANEL_DB_USER}
      - GITEA__database__PASSWD=${PANEL_DB_USER_PASSWORD}
    restart: always
    networks:
      - 1panel-network
    volumes:
      - ./data:/data
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
    ports:
      - "${PANEL_APP_PORT_HTTP}:3000"
      - "${PANEL_APP_PORT_SSH}:22"
    labels:
      createdBy: "Apps"
networks:
  1panel-network:
    external: true
```

改造后 `apps/fn-gitea/app/docker/docker-compose.yaml`：

```yaml
services:
  gitea:
    image: commitgo/gitea-ee:27.3.4
    container_name: fn-gitea
    environment:
      - USER_UID=1000
      - USER_GID=1000
      - TZ=${TIME_ZONE}
      # 上游由 1Panel 服务选择器注入，fnOS 改为向导显式填写
      - GITEA__database__DB_TYPE=${DB_TYPE}
      - GITEA__database__HOST=${DB_HOST}
      - GITEA__database__NAME=${DB_NAME}
      - GITEA__database__USER=${DB_USERNAME}
      - GITEA__database__PASSWD=${DB_PASSWORD}
    restart: always
    volumes:
      - "${TRIM_PKGVAR}/data:/data"
    ports:
      - "${APP_PORT}:3000"
      - "${APP_SSH_PORT}:22"
```

改动点：

- 联动字段拆成显式连接字段；`PANEL_DB_HOST:${PANEL_DB_PORT}` 合并为一个 `DB_HOST`，`helpText` 写明 `地址:端口` 格式。
- 删两个时区绑定挂载，改用 `TZ=${TIME_ZONE}`。
- 两个端口分别建向导字段；`APP_SSH_PORT` 是 SSH 端口，只进向导不进桌面入口。
- 数据库初始化（建库、建用户）由用户在向导里填已有实例，**不要**在 `cmd/install_callback` 里尝试连接并建库；连接失败时应用能启动但功能页报错，向导 `helpText` 必须说明这一点。

## 配置文件模板

### manifest

```ini
appname               = fn-<app>
version               = <版本号>
display_name          = <上游 data.yml 的 name>
desc                  = <上游 shortDescZh，去掉营销词>
platform              = x86
source                = thirdparty
maintainer            = <上游项目方>
maintainer_url        = <上游官网>
distributor           = tnnevol
distributor_url       = https://github.com/tnnevol/fn-os-apps
os_min_version        = 1.1.8
desktop_uidir         = ui
desktop_applaunchname = fn-<app>.Application
disable_authorization_path = true
```

规则：

- `desc` 用中文，取上游 `additionalProperties.shortDescZh`；`display_name` 取 `additionalProperties.name`。上游 `recommend` 只用于排批次，**不写入** `manifest`。
- `platform` 按清单的架构信息填写：上游只声明 `amd64` 的应用写 `x86`，同时声明 `arm64` 的应用仍按实际构建产物填写，不凭镜像支持列表推断。
- `os_min_version` 填已在设备上验证过的版本，不照抄开发文档的最低版本要求。
- `install_dep_apps` 只在确实依赖宿主提供的中间件应用时声明，多个依赖用 `:` 分隔。
- `service_port` 只在需要宿主做端口检查时声明；使用向导动态端口时不要写死。

字段语义以飞牛官方 Manifest 文档和仓库 [Manifest 配置](/development/manifest) 为准。

### config/privilege

```json
{
  "defaults": {
    "run-as": "package"
  },
  "username": "docker-fn-<app>",
  "groupname": "docker-fn-<app>"
}
```

默认 `run-as: package`，不使用 root，不使用 `join-groups` 提权。需要访问共享目录时由 `data-share` 的 `permission` 授权，见 [权限与入口](/development/permissions)。

### config/resource

```json
{
  "docker-project": {
    "projects": [
      {
        "name": "fn-<app>",
        "path": "docker"
      }
    ]
  },
  "data-share": {
    "shares": [
      {
        "name": "fn-<app>",
        "permission": {
          "rw": ["docker-fn-<app>"]
        }
      }
    ]
  }
}
```

`data-share` 按需声明：只有用户需要看到或管理的数据才声明，纯内部状态放 `${TRIM_PKGVAR}` 即可，不必声明共享。

### wizard

| 文件 | 内容 |
| --- | --- |
| `wizard/install` | 端口、时区、数据库/Redis 连接、初始化账号；字段与 `wizard/config` 保持一致 |
| `wizard/config` | 与 `wizard/install` 同名字段，供安装后修改 |
| `wizard/uninstall` | `radio` 字段 `wizard_data_action`，选项 `keep`（默认）/`delete` |

固定契约名（不要改）：端口 `APP_PORT`、时区 `TIME_ZONE`、卸载动作 `wizard_data_action`。其余自定义字段参考现成实现的命名，不要使用 `TRIM_` 前缀。字段语义与控件类型见飞牛「用户向导」文档和仓库 [用户向导](/development/wizard)。

端口字段必须使用上面给出的 1—65535 严格正则。不要依赖 `min`/`max` 表达范围。

### cmd 与入口

- `cmd/main` 用 `docker compose -p "$TRIM_APPNAME"` 检查与重建容器，容器缺失时 `up -d`，失败返回非 0；参考 [fn-zentao](/apps/fn-zentao) 的 `ensure_containers_created`。
- **`cmd/uninstall_callback` 不能保留模板原样**。fnpack 模板给的是空实现（仅一段注释加 `exit 0`），必须按规约实现数据保留分支：`wizard_data_action=delete` 时删除数据，否则保留。删除必须用 `${VAR:?}` 防误删（变量为空时 `:?` 让命令直接失败，而不是让 `rm -rf` 拿到空路径）：

  ```bash
  #!/bin/bash

  ### This script is called after the user uninstalls the application.

  if [ "$wizard_data_action" = "delete" ]; then
      echo "Deleting application data..."
      # ${TRIM_PKGVAR:?} / ${TRIM_PKGHOME:?} 的 :? 防止变量为空时误删根目录
      rm -rf "${TRIM_PKGVAR:?}"
      rm -rf "${TRIM_PKGHOME:?}"
      echo "Application data deleted."
  else
      echo "Keeping application data for future reinstallation."
  fi

  exit 0
  ```

  完整示例见 `apps/fn-zentao/cmd/uninstall_callback` 与 `apps/fn-it-tools/cmd/uninstall_callback`。
- **模板文件缺末尾换行，必须补齐**。fnpack 模板 `cmd/` 下的 9 个文件（`main` 与 8 个回调）**末尾都没有换行符**，会触发仓库的 shfmt 规则（`shell-format/format`）报 lint error。生成骨架后先给这 9 个文件各补一个 `\n`，再按规约改内容。补齐后，**7 个保持模板语义的文件**（`install_init`、`install_callback`、`config_init`、`config_callback`、`upgrade_init`、`upgrade_callback`、`uninstall_init`）与 `apps/fn-zentao/cmd/*` **逐字节一致**；另外 2 个按规约必须重写（`main` 改 `docker compose -p "$TRIM_APPNAME"` 探测逻辑，`uninstall_callback` 实现数据保留分支），因此不与模板一致。补换行属于「修改模板文件内容」，不违反禁止项第 1 条（该条禁止的是**删除**模板文件）——避免用删除文件的方式绕开 lint。
- `cmd/install_init`、`cmd/config_init`、`cmd/upgrade_init` 等模板自带的空脚本保留并返回 0，不删除（补换行即可，不要加入额外逻辑）。
- **入口 ID 长度上限 32 字符**。`fnpack` 对 `app/ui/config` 的入口键做硬校验，超过 32 字符直接拒绝打包：

  ```text
  Packing failed. The entry ID "fn-wechatmarkdowneditor.Application" exceeds the 32-character limit.
  ```

  `fn-` + `<app>` + `.Application` 超过 32 字符，等价于 **`<app>` 长度 ≥ 18 字符时必然超限**。此时把后缀换成 `.main`（官方《应用入口》文档示例即用 `myapp.main`；仓库先例 `fn-memos.main`、`fn-xiaoya-only.main`），仍以 `appname` 为前缀、满足前缀校验。实测边界：ID 长度 32 通过、33 拒绝。

  **注意**：`fnpack` 在此情况下**仍返回退出码 0**，只有依赖产物存在性判定（见下）才能发现；且 `manifest` 的 `desktop_applaunchname` 必须与 `app/ui/config` 的键**逐字符一致**。

  另一个相邻的硬校验：入口键必须**以 `manifest.appname` 为前缀**，否则报 `should start with <appname>`。

- `app/ui/config` 的入口端口必须与向导字段同名引用：`"port": "${APP_PORT}"`。默认 `type: "url"`；需要宿主内嵌时用 `iframe`，并在真机验证静态资源、API 与 SSE 不被网关重写。

## 禁止项

1. **不得删除 fnpack 模板自带文件**。`fnpack create <app> --template docker` 生成的结构（`cmd/` 各回调、`config/`、`wizard/`、`ICON*.PNG`）只能在基础模板上修改内容或新增文件；不需要的回调保持安全、可重复执行并返回成功。

   **例外：`.DS_Store` 属于 macOS 系统垃圾文件，不算「模板自带文件」，可以删除。** fnpack 模板会带入 5 个 `.DS_Store`（`app/`、`app/ui/`、`app/ui/images/`、`cmd/`、`config/` 各一个），其中 `cmd/.DS_Store` 与 `config/.DS_Store` 会被打进 FPK 顶层，其余随 `app/` 进入 `app.tgz`。它们不是 fnpack 模板的结构性文件，保留只会让垃圾文件随包发给用户；本仓库既有 14 个应用也均无此类文件。批量转换时在自检清单确认 `.DS_Store` 计数为 0。
2. **不得把运行数据写进 FPK 安装目录**。`TRIM_APPDEST` 只放只读资源，可写状态一律落 `${TRIM_PKGVAR}` 或声明的共享目录。
3. **不得用 root 运行**。默认 `run-as: package` + `docker-fn-<app>`；确需特权时在计划中记录理由，不能靠放宽权限绕过路径或端口配置错误。
4. **不得复制上游文件内容**。上游 `LICENSE` 是 GPL-3.0，本仓库是 AGPL-3.0。只提取配置事实（镜像标签、端口、卷路径、环境变量名和默认值），不搬运 YAML 注释、README、脚本或表单文案。
5. **不得修改上游 `appstore/`**，也不向上游提交补丁。它是只读的契约与版本来源。
6. **不得把同一应用的多份 compose 塞进一个 FPK**。上游 40 个应用有多版本，每个应用只选定一个版本，多版本差异通过升级而非并行入口体现。
7. **不得在仓库内写入开发机绝对路径**。脚本内定位同目录文件时基于脚本位置推导；fnOS 设备端路径（`TRIM_*`、`/var/apps/...`）可以出现，但要注明它指向目标 NAS。完整规则见 [SDD 规格驱动维护规范](/development/sdd-workflow) 的「路径约束」。
8. **不得在文档、向导 `helpText`、示例和日志里出现真实密码或 Token**。

## 自检清单

单个应用提交前逐项确认：

- [ ] `apps/fn-<app>/` 目录名、`manifest.appname`、`container_name`、`-p $TRIM_APPNAME`、`docker-fn-<app>` 五者词干一致。
- [ ] compose 无 `1panel-network`、无 `createdBy` 标签、无 `${CONTAINER_NAME}`、无 `env_file`、无 `build:`。
- [ ] 所有 `./` 相对挂载已改为 `${TRIM_PKGVAR}` 或声明的共享目录；用户可见数据已声明 `data-share`。
- [ ] 端口、时区字段在 `wizard/install` 与 `wizard/config` 中同名且默认值一致；端口字段使用 1—65535 严格正则。
- [ ] `wizard/uninstall` 提供保留/删除二选一，`cmd/uninstall_callback` 已实现 `wizard_data_action` 分支（**不是模板原样的空 `exit 0`**），删除分支使用 `rm -rf "${TRIM_PKGVAR:?}"`。
- [ ] **`cmd/` 下 9 个模板文件已补末尾换行**，`pnpm run lint` 不被 shfmt 规则判错。
- [ ] **`.DS_Store` 计数为 0**：`tar tzf <app>.fpk | grep -c DS_Store` 输出 0（模板会带入 5 个，须按禁止项 1 的例外删除）。
- [ ] `app/ui/config` 的 `port` 与向导字段同名（`${APP_PORT}`，不写死）；非 HTTP 端口没有桌面入口（`app/ui/config` 写 `{}` 且 `manifest` 不含 `desktop_*` 两行）。
- [ ] **入口 ID ≤ 32 字符**（`<app>` ≥ 18 字符时用 `<appname>.main`），且入口键以 `appname` 为前缀、与 `manifest.desktop_applaunchname` 逐字符一致。
- [ ] 镜像标签不是 `latest`，也没有未解析的变量插值。
- [ ] 文档内没有开发机绝对路径，设备端路径已注明指向目标 NAS。
- [ ] `bash -n apps/fn-<app>/cmd/*` 通过；`pnpm run check -- --all`、`pnpm run lint`、`git diff --check` 通过。

## 待确认

以下事实尚未确认，转换时遇到对应场景应先暂停并上报，不要按猜测实现：

| 事项 | 影响 | 现状 |
| --- | --- | --- |
| fnOS 是否提供与 1Panel `service` 选择器等价的自动填地址能力 | 清单登记的 74 处联动字段只能手填，用户路径需试点验证 | 计划阶段 3 试点确认 |
| `install_dep_apps` 能否表达运行时版本与扩展集（PHP 8.2 + 扩展） | 决定 T3 运行环境类是否上架 | 需求中登记为待确认 |
| `env_file`、`devices`、`cap_add`、`privileged`、host 网络在 fnOS 的可用性 | 决定 T4 33 个应用能否转换 | 需求中登记为待确认 |
| `/etc/timezone`、`/etc/localtime` 在 fnOS 宿主上的存在性与权限 | 上游 22 个应用；本规约统一改为 `TZ` 环境变量，需真机确认时区生效 | 待真机验证 |
| 1Panel 宿主路径（如 `/etc/1panel`）挂载的替代方案 | 影响 `ai-gateway` 等应用的数据目录设计 | 待确认 |
| 既有 14 个已发布应用的端口校验是否统一为严格正则 | 既有应用普遍用 `^[0-9]+$`（不挡越界），与本规约的 1—65535 严格正则不一致；**本次不回溯**，如需统一须另开需求 | 已登记，由计划维护者决定是否单独排期 |
| `.fpk` 字节级不可复现 | fnpack 会向包内 `manifest` 注入一行随构建时刻变化的 `checksum`，tar 成员 mtime 也随之变化。实测：同一目录**同一秒内**连续构建结果一致，**跨秒**则 `.fpk` 大小与哈希均不同。`.fpk` 大小/哈希**不能作为验收判据**，CI 也不应做产物哈希断言 | 已知事实；要校验产物请比对解包内容：`app.tgz` 内层解包后 `diff -r` 无输出，顶层 `manifest` 仅 `checksum` 一行不同 |

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-09 | 建立转换规约。 |
| 2026-10-09 | 端口校验改为单条严格正则完整覆盖 1—65535（原表述 `^[0-9]+$` 与「范围 1—65535」并列自相矛盾），不依赖 `min`/`max`。 |
| 2026-10-09 | 沉淀 fnpack 模板两处坑：`cmd/` 下 9 个文件缺末尾换行会触发 shfmt 规则；`cmd/uninstall_callback` 模板为空实现，必须实现 `wizard_data_action` 数据保留分支。 |
| 2026-10-09 | 禁止项 1 增加例外：`.DS_Store` 属系统垃圾文件可删除（模板会带入 5 个，其中 2 个会进 FPK 顶层）；自检清单同步增加 `.DS_Store` 计数为 0 的检查项。 |
| 2026-10-09 | 登记两项已知事实：既有 14 应用的端口正则不回溯统一（须另开需求）；`.fpk` 字节级不可复现，不作为验收或 CI 哈希判据。 |
| 2026-10-09 | 移除已过期的「清单分级与复算结果的 6 处偏差」待确认项——该偏差已在清单订正中收敛为 0 项。 |
| 2026-10-10 | 补入口 ID 长度上限（≤32 字符）与 `appname` 前缀硬校验：`fn-wechatmarkdowneditor.Application`（35 字符）实测打包失败，改用 `.main`（28 字符）通过。实测边界 32 通过 / 33 拒绝。同步补自检清单的无入口应用形态（`app/ui/config` 为 `{}`）。 |
| 2026-10-10 | 新增「模式 B 的三个补充裁决」（T1 第 1 组实测）：① `PUID`/`PGID` 改用 `${TRIM_UID}`/`${TRIM_GID}`（真机取证 fnOS 包用户 UID 是动态值、数据目录 mode 770）；② 向导字段按「安装时必须由用户决定」取舍，`gotify` 29 字段收敛为核心 5 个并要求文档留出口；③ 上游数据落盘缺陷（`2fauth` 的 `DB_DATABASE` 在挂载外、`APP_KEY` 为占位示例值）必须修正而非照搬。 |
| 2026-10-10 | 订正 `${TRIM_UID}`/`${TRIM_GID}` 的依据强度：原表述称「fnOS 在 compose 中会展开 `TRIM_*`（官方 Docker 案例使用 …）」并引用了官方案例，但该案例实际只含 `${TRIM_APPDEST}`/`${TRIM_SERVICE_PORT}`，**未出现 `TRIM_UID`/`TRIM_GID`**，属引用不实。改为「文档列出变量但无 compose 示例」，并补充未注入时的**静默空值**实测输出（`exit=0`、`PUID: ""`）。 |
| 2026-10-10 | 补两处泛化：① 宿主路径挂载条款判据从「`/etc/1panel` 等 1Panel 路径」改为「**挂载源是否为宿主绝对路径**」，并补录 `showdoc` 的 `/showdoc_data` 案例；② 新增**可变镜像标签**禁令（`:latest`/`:master`/`:main` 等一律不转换），补录 6 个暂缓应用。 |
