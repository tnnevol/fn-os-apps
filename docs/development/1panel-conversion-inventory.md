---
title: 1Panel 应用转换清单
description: 1Panel 应用商店 265 个应用的 fnOS 转换分级、改造点与批次明细。
---

# 1Panel 应用转换清单

本清单是 [FNOS-001](/requirements/FNOS-001-1panel-app-conversion) 与 [PLAN-FNOS-001](/plans/PLAN-FNOS-001-1panel-app-conversion) 的附录，记录上游 `1Panel-dev/appstore` 全部 265 个应用的静态盘点结果。上游仓库在本地工作区检出为 `appstore/`，本仓库只读参考它。

## 盘点口径

数据来源：`appstore/apps/<app>/data.yml` 与 `appstore/apps/<app>/<version>/docker-compose.yml`，盘点日期 2026-10-09，上游提交 `3b142d2`。

| 指标 | 数量 | 说明 |
| --- | --- | --- |
| 应用总数 | 265 | `appstore/apps/` 下的目录数 |
| 带向导表单（`formFields`） | 259 | **读取位置口径（写死）：只读版本级 `appstore/apps/<app>/<version>/data.yml`**，判定 `additionalProperties.formFields` 非空。**顶层 `appstore/apps/<app>/data.yml` 不含 `formFields`**（其 `additionalProperties` 只有展示元数据：`key`/`name`/`tags`/`shortDescZh`/`shortDescEn`/`type`/`crossVersionUpdate`/`limit`/`recommend`/`batchInstallSupport`/`website`/`github`/`description`/`architectures`），读错位置会得到"全部应用无表单"的错误结论（实测 265 个应用的顶层文件命中数为 **0**）。**多版本取值：任一版本命中即计入**（并集）；实测"任一版本"「全部版本」「第一个版本」三种取法均得 259，因为**没有任何应用在不同版本之间出现 `formFields` 有/无的差异**，故该取法不影响计数。另有 6 个应用确实没有表单：`caddy`、`dotnet`、`go`、`java`、`node`、`python`。`jupyter-notebook`、`oceanbase` 的 `data.yml` 含制表符缩进，严格 YAML 解析会失败，展开制表符后二者确有 `formFields`，故计入 259；按严格解析会误算为 257 |
| 多版本应用 | 40 | 同一应用目录下有多个版本子目录，转换时必须选定一个版本 |
| 使用 `1panel-network` 外部网络 | 257 | 全部需要删除该外部网络依赖 |
| 使用 `${CONTAINER_NAME}` | 263 | 全部改为 `fn-<app>` 固定容器名 |
| 使用 `./` 相对挂载 | 223 | 数据会落在容器工程目录，必须改到 fnOS 数据目录。**判定口径（写死，便于复算）**：按行首 `- ` 后接可选引号再接 `./` 的行匹配，正则 `^\s*-\s*['"]?\./`（引号必须可选：`newsnow`、`openldap` 写作单引号 `'./data:...'`，漏判会把它们错分到 T0）。该口径**不区分该行属于 `volumes:` 还是 `env_file:`**，共 223 个应用；其中**真实 `./` volume 挂载为 222 个**，差额 1 个是 `zitadel`——它仅在 `env_file:` 段出现 `./data/masterkey.env`，从 2.71.13 到 4.17.0 都没有任何 `./` volume 挂载（volumes 只有 `/etc/localtime`、`/etc/timezone` 两个宿主绝对路径）。反向不存在漏报。**该数字不影响分级**：用「行首正则」（223）与「仅 volume 挂载」（222）两种口径各跑一遍完整七步级联，结果完全一致（T0 14 / T1 98 / T2 74 / T3 46 / T4 33，无差异应用），因为受影响的 `zitadel`、`mailserver`、`outline`、`docmost` 都已因 `env_file` 命中更靠前的 T4 触发条件，走不到第 6 步的 T1 判据 |
| 使用外部命名卷（`external: true`） | 2 | `maddy-mail`、`synapse`，需改为绑定挂载 |
| 使用 `service`/`apps` 联动字段 | 74 处字段 | fnOS 没有服务选择器，必须改造成显式连接信息 |
| 绑定宿主 `/etc/timezone`、`/etc/localtime` | 22 | 需确认 fnOS 上是否可用，否则改用 `TZ` 环境变量 |
| 与本仓库现有应用同名 | 6 | `bitwarden`、`halo`、`hermes-agent`、`memos`、`new-api`、`zentao`，需先做对齐判定，不重复打包 |

## 分级总览

| 级别 | 名称 | 数量 | 去掉同名后 | 转换成本 | 批次 |
| --- | --- | --- | --- | --- | --- |
| T0 | 直接套模板 | 14 | 14 | 0.5 人日/应用 | 批次 1 |
| T1 | 状态落盘改造 | **125** | 125 | 0.5—1 人日/应用 | **已完成**（124/125，`deepseek-harness` 按边界不转换） |
| T2 | 资源集成改造 | **47** | 47 | 1—3 人日/应用 | **已完成**（47/47） |
| T3 | 运行环境 / 中间件 / 能力重复 | 46 | 46 | 需要宿主契约决策 | 暂不排期 |
| T4 | 高风险 | 33 | 33 | 需要权限模型决策 | 暂不排期 |
| 合计 | — | 265 | 265 | — | 可转换 186 / 已交付 185 |

> **数字口径**：T1 由原 98 增至 **125**、T2 由原 74 降至 **47**，是因为 **26 个应用经全量扫描后订正了分级**（原判 T2 但实测无外部数据库/中间件依赖，应归 T1）；T3/T4 不变。详见下方「变更记录」中 2026-10-14 的 D-03 订正。「去掉同名后」一列在此次订正后与「数量」一致——原先扣减的 6 个同名应用（`bitwarden`/`halo`/`hermes-agent`/`memos`/`new-api`/`zentao`）已计入不可转换，故本清单统计的是**可转换范围**。

分级判定顺序（第一个命中的条件决定级别）：

```text
1. 是语言运行时 / Web 服务器（php、php5/7/8、node、python、go、java、dotnet、openresty、openlitespeed、uuwaf）  → T3 运行环境
2. 是数据库 / 缓存（mysql、mariadb、postgresql、redis、mongodb、mssql、neo4j、oceanbase、greatsql、keydb、valkey 及 cluster）→ T3 能力重复
3. 是中间件 / 监控（kafka、rabbitmq、minio、elasticsearch、clickhouse、nacos、consul、prometheus、grafana、jaeger 等）→ T3 中间件
4. compose 需要 docker.sock / privileged / host 网络 / cap_add / devices / build / env_file                                          → T4 高风险
5. 多容器 / 多端口 / 外部数据库（PANEL_DB_* 或 DBHUB_DB_*）/ Redis / service-apps 联动字段                                            → T2 资源集成
6. 状态落 `./data` 相对目录（引号无关）/ 外部命名卷 / 仅 amd64                                                                          → T1 状态落盘
7. 其余（单容器、单端口、无状态或仅命名卷）                                                                                            → T0 直接套模板
```

第 5、6 步的两个判定按下列口径求值，口径错误会直接导致分级错位：

- **外部数据库（第 5 步）**：仅当 compose 使用 `PANEL_DB_*` **或 `DBHUB_DB_*`** 变量（即需要用户提供外部数据库实例）才算命中。容器内自带的 SQLite（`DB_DATABASE=...sqlite`、`*_DATABASE_DRIVER: sqlite`、`GOTIFY_DATABASE_DIALECT=sqlite3`）和镜像内置数据库（`MYSQL_INTERNAL=true`）**不算**外部依赖，按状态落盘归 T1。反面教训：按「env 里出现 `DATABASE` 字样」判定，会把 `2fauth`、`ai-gateway`、`gotify`、`zentao` 误升到 T2；只看 `PANEL_DB_*` 又会漏掉用 `DBHUB_DB_*` 的 `dbhub`（误留 T0）。
- **`./` 相对挂载（第 6 步）**：判定必须**引号无关**，使用 `^\s*-\s*['"]?\./`（行首 `- ` 后允许可选引号再接 `./`）。只匹配裸写法会把 `newsnow`、`openldap` 的单引号挂载漏掉，使其错留在 T0。

## 与本仓库现有应用的重名情况

以下 6 个上游应用在本仓库已有实现，转换批次中应跳过，只做版本对齐：

| 上游应用 | 上游镜像 | 本仓库现有应用 | 处理建议 |
| --- | --- | --- | --- |
| `memos` | `neosmemo/memos:0.31.0` | [fn-memos](/apps/fn-memos)（原生二进制） | 跳过上游版本，已有实现更轻 |
| `halo` | `halohub/halo-pro:2.26.1` | [fn-halo](/apps/fn-halo)（Docker） | 只对齐镜像版本 |
| `new-api` | `calciumion/new-api:v0.13.2` | [fn-new-api](/apps/fn-new-api)（Docker） | 只对齐镜像版本 |
| `zentao` | `hub.zentao.net/app/zentao:22.6` | [fn-zentao](/apps/fn-zentao)（Docker） | 只对齐镜像版本 |
| `bitwarden` | `vaultwarden/server:1.37.4-alpine` | [fn-bitwarden](/apps/fn-bitwarden)（Docker） | 只对齐镜像版本 |
| `hermes-agent` | `1panel/hermes-agent:2026.9.24` | [fn-hermes-agent](/apps/fn-hermes-agent)（原生） | 确认是否改用上游镜像 |

上游还有 `openclaw`、`clawswarm`、`copaw`、`deepseek-harness` 等 1Panel 自有镜像应用，与本仓库现有应用无关，按普通上游应用处理。

## 批次明细

### T0 直接套模板（14 个）

单容器单端口，无状态卷或仅命名卷；改命名、网络和入口即可。

| 优先级 | 上游应用 | 展示名 | 主镜像 | 关键改造点 | 上游版本数 |
| --- | --- | --- | --- | --- | --- |
| P1 | `lobe-chat` | LobeChat | `lobehub/lobe-chat:1.143.3` | 仅命名/网络差异 | 1 |
| P2 | `zabbix-agent` | Zabbix Agent | `zabbix/zabbix-agent:alpine-7.4.5` | 仅命名/网络差异 | 1 |
| P3 | `adminer` | Adminer | `adminer:6.1.1-standalone` | 仅命名/网络差异 | 1 |
| P3 | `browserless` | Browserless | `ghcr.io/browserless/chrome:v2.57.0` | 仅命名/网络差异 | 1 |
| P3 | `chatgpt-next-web` | ChatGPT-Next-Web | `yidadaa/chatgpt-next-web:v2.16.1` | 仅命名/网络差异 | 1 |
| P3 | `cloudflared` | cloudflared | `cloudflare/cloudflared:2026.10.0` | 仅命名/网络差异 | 1 |
| P3 | `cyberchef` | CyberChef | `ghcr.io/gchq/cyberchef:10.24.0` | 仅命名/网络差异 | 2 |
| P3 | `it-tools` | IT-Tools | `corentinth/it-tools:2024.10.22-7ca5933` | 仅命名/网络差异 | 1 |
| P3 | `linux-command` | Linux Command | `wcjiang/linux-command:1.22.0` | 仅命名/网络差异 | 1 |
| P3 | `llama-cpp` | llama.cpp | `ghcr.io/ggml-org/llama.cpp:server` | 用户模型目录挂载 `${MODEL_DIR}:/models`（默认 `./models`，`edit: true`）→ 向导字段 `MODEL_PATH` + 只读挂载；不声明 `data-share` | 1 |
| P3 | `memcached` | Memcached | `memcached:1.6.22-alpine3.18` | 仅命名/网络差异 | 1 |
| P3 | `web-check` | Web-Check | `lissy93/web-check:2.3.2` | 仅命名/网络差异 | 1 |
| P3 | `wechatmarkdowneditor` | WeChat Markdown Editor | `doocs/md:2.1.0` | 仅命名/网络差异 | 1 |
| P3 | `yesplaymusic` | YesPlayMusic | `fogforest/yesplaymusic:0.4.9` | 仅命名/网络差异 | 1 |

### T1 状态落盘改造（125 个）

单容器单端口，但状态写在 `./data` 相对目录，必须改到 `${TRIM_PKGVAR}` 或共享目录。

| 优先级 | 上游应用 | 展示名 | 主镜像 | 关键改造点 | 上游版本数 |
| --- | --- | --- | --- | --- | --- |
| P1 | `new-api` | New API | `calciumion/new-api:v0.13.2` | 状态落 `./data` | 1 |
| P1 | `n8n` | n8n | `n8nio/n8n:2.42.3` | 状态落 `./data` | 1 |
| P1 | `bitwarden` | Bitwarden | `vaultwarden/server:1.37.4-alpine` | 状态落 `./data` | 1 |
| P1 | `newsnow` | NewsNow | `ghcr.io/ourongxing/newsnow:v0.0.41` | 状态落 `./data`（单引号写法 `'./data:...'`） | 1 |
| P1 | `openldap` | OpenLDAP | `bitnamilegacy/openldap:2.6.10` | 状态落 `./data`（单引号写法 `'./data:...'`） | 1 |
| P2 | `ai-gateway` | 1Panel AI 网关 | `1panel/ai-gateway:v1.3.0` | 状态落 `./data`；容器内自带 SQLite（非外部数据库） | 1 |
| P2 | `zentao` | 禅道 | `hub.zentao.net/app/zentao:22.6` | 状态落 `./data`；镜像内置 MySQL（`MYSQL_INTERNAL=true`，非外部数据库） | 1 |
| P2 | `tomcat` | Apache Tomcat | `bitnamilegacy/tomcat:10.1.43` | 状态落 `./data` | 3 |
| P2 | `qinglong` | 青龙 | `whyour/qinglong:2.22.0-debian` | 状态落 `./data` | 1 |
| P2 | `ollama` | Ollama | `ollama/ollama:0.40.1` | 状态落 `./data` | 1 |
| P2 | `upage` | UPage | `halohub/upage:1.0.1` | 状态落 `./data` | 2 |
| P2 | `clawswarm` | ClawSwarm | `1panel/clawswarm:v1.0.5` | 状态落 `./data` | 1 |
| P2 | `phpmyadmin` | phpMyAdmin | `phpmyadmin:5.2.3` | 状态落 `./data` | 1 |
| P2 | `hermes-agent` | Hermes Agent | `1panel/hermes-agent:2026.9.24` | 状态落 `./data` | 1 |
| P2 | `copaw` | QwenPaw | `agentscope/qwenpaw:v2.2.1` | 状态落 `./data` | 1 |
| P2 | `openclaw` | OpenClaw | `1panel/openclaw:2026.9.8` | 状态落 `./data` | 1 |
| P2 | `maxkb` | MaxKB | `1panel/maxkb:v2.10.6-lts` | 状态落 `./data` | 1 |
| P2 | `deepseek-harness` | DeepSeek Harness | `1panel/deepseek-harness:0.2.0-rc.2` | 状态落 `./data` | 1 |
| P2 | `laya-server` | Laya Server | `1panel/laya-server:v0.1.2` | 状态落 `./data` | 1 |
| P3 | `ai-portal` | 1Panel AI 门户 | `1panel/ai-portal:v1.0.8` | 状态落 `./data` | 1 |
| P3 | `2fauth` | 2FAuth | `2fauth/2fauth:8.0.2` | 状态落 `./data`；容器内自带 SQLite（非外部数据库） | 1 |
| P3 | `gotify` | Gotify | `gotify/server:3.1.1` | 状态落 `./data`；容器内自带 SQLite（非外部数据库）；仅 amd64 | 1 |
| P3 | `answer` | Answer | `apache/answer:2.0.2` | 状态落 `./data` | 1 |
| P3 | `archivebox` | ArchiveBox | `archivebox/archivebox:0.9.73` | 状态落 `./data` | 1 |
| P3 | `artalk` | Artalk | `artalk/artalk-go:2.10` | 状态落 `./data`；仅 amd64 | 1 |
| P3 | `audiobookshelf` | Audiobookshelf | `advplyr/audiobookshelf:2.37.1` | 状态落 `./data` | 1 |
| P3 | `beszel` | Beszel | `henrygd/beszel:0.21.0` | 状态落 `./data` | 1 |
| P3 | `bililive-go` | Bililive-go | `chigusa/bililive-go:v0.8.3` | 状态落 `./data` | 1 |
| P3 | `bytebase` | Bytebase | `bytebase/bytebase:3.23.0` | 状态落 `./data` | 1 |
| P3 | `calibre-web` | Calibre-Web | `linuxserver/calibre-web:0.6.27` | 状态落 `./data` | 1 |
| P3 | `certimate` | Certimate | `certimate/certimate:v0.4.34` | 状态落 `./data` | 1 |
| P3 | `changedetectionio` | Changedetection.io | `dgtlmoon/changedetection.io:0.60.8` | 状态落 `./data` | 1 |
| P3 | `cloudbeaver` | CloudBeaver | `dbeaver/cloudbeaver:26.2.2` | 状态落 `./data` | 1 |
| P3 | `code-server` | code-server | `linuxserver/code-server:4.140.0` | 状态落 `./data` | 1 |
| P3 | `comfyui` | ComfyUI | `1panel/comfyui:v0.33.1` | 状态落 `./data` | 1 |
| P3 | `convertx` | ConvertX | `c4illin/convertx:v0.19.0` | 状态落 `./data` | 1 |
| P3 | `dashy` | Dashy | `lissy93/dashy:4.7.19` | 状态落 `./data` | 1 |
| P3 | `domain-admin` | Domain Admin | `mouday/domain-admin:v1.6.78` | 状态落 `./data` | 1 |
| P3 | `dosgame` | 中文 DOS 游戏 | `firezmc/dosgame-web-docker:v3.9.6` | 状态落 `./data` | 1 |
| P3 | `easyimage2` | EasyImage2.0 | `ddsderek/easyimage:v2.8.6` | 状态落 `./data` | 1 |
| P3 | `excalidraw` | Excalidraw | `excalidraw/excalidraw:latest` | 仅 amd64 | 1 |
| P3 | `ezbookkeeping` | ezBookkeeping | `mayswind/ezbookkeeping:2.0.1` | 状态落 `./data` | 1 |
| P3 | `filebrowser` | File Browser | `filebrowser/filebrowser:v2.63.23` | 状态落 `./data` | 1 |
| P3 | `filecodebox` | FileCodeBox | `lanol/filecodebox:2.7.1` | 状态落 `./data` | 1 |
| P3 | `focalboard` | Focalboard | `mattermost/focalboard:7.11.4` | 状态落 `./data`；仅 amd64 | 1 |
| P3 | `freshrss` | FreshRSS | `linuxserver/freshrss:1.30.1` | 状态落 `./data` | 1 |
| P3 | `gatus` | Gatus | `twinproduction/gatus:v5.37.0` | 状态落 `./data` | 1 |
| P3 | `glance` | Glance | `glanceapp/glance:v0.8.6` | 状态落 `./data` | 1 |
| P3 | `huginn` | Huginn | `ghcr.io/huginn/huginn:latest` | 状态落 `./data`；仅 amd64 | 1 |
| P3 | `jellyfin` | Jellyfin | `jellyfin/jellyfin:10.11.11` | 状态落 `./data` | 1 |
| P3 | `jsonhero` | JSON Hero | `henryclw/jsonhero-web:latest` | 仅 amd64 | 1 |
| P3 | `jupyter-notebook` | Jupyter Notebook | `jupyter/scipy-notebook:latest` | 状态落 `./data` | 1 |
| P3 | `kibana` | Kibana | `kibana:8.19.23` | 状态落 `./data` | 2 |
| P3 | `kirara-agent` | Kirara AI | `lss233/kirara-agent-framework:v3.2.0` | 状态落 `./data` | 1 |
| P3 | `kkfileview` | kkFileView | `keking/kkfileview:4.1.0` | 仅 amd64 | 1 |
| P3 | `kodbox` | Kodbox | `kodcloud/kodbox:v1.4505` | 状态落 `./data` | 1 |
| P3 | `komari` | Komari | `ghcr.io/komari-monitor/komari:1.5.1` | 状态落 `./data` | 1 |
| P3 | `komga` | Komga | `gotson/komga:1.28.1` | 状态落 `./data` | 1 |
| P3 | `koodo-reader` | Koodo Reader | `ghcr.io/koodo-reader/koodo-reader:master` | 状态落 `./data` | 1 |
| P3 | `linkding` | linkding | `sissbruecker/linkding:1.47.0-plus` | 状态落 `./data` | 1 |
| P3 | `localai` | LocalAI | `localai/localai:v3.12.1-aio-cpu` | 状态落 `./data` | 1 |
| P3 | `lsky-pro` | Lsky-pro | `halcyonazure/lsky-pro-docker:latest` | 状态落 `./data` | 1 |
| P3 | `mblog` | MBlog | `kingwrcy/mblog:1.1.0` | 状态落 `./data`；仅 amd64 | 1 |
| P3 | `mcsmanager-web` | MCSManager | `githubyumao/mcsmanager-web:latest` | 状态落 `./data` | 1 |
| P3 | `memos` | Memos | `neosmemo/memos:0.31.0` | 状态落 `./data` | 1 |
| P3 | `mkdocs-material` | Material for MkDocs | `squidfunk/mkdocs-material:9.7.7` | 状态落 `./data` | 1 |
| P3 | `music-tag-web` | Music Tag Web | `xhongc/music_tag_web:2.7.8` | 状态落 `./data` | 1 |
| P3 | `navidrome` | Navidrome | `deluan/navidrome:0.64.2` | 状态落 `./data` | 1 |
| P3 | `nextcloud` | Nextcloud | `linuxserver/nextcloud:35.0.1` | 状态落 `./data` | 1 |
| P3 | `nexus` | Nexus Repository | `sonatype/nexus3:3.96.4` | 状态落 `./data`；仅 amd64 | 1 |
| P3 | `nezha` | 哪吒监控 | `ghcr.io/nezhahq/nezha:v2.3.18` | 状态落 `./data` | 1 |
| P3 | `node-red` | Node-RED | `nodered/node-red:5.0.7` | 状态落 `./data` | 1 |
| P3 | `nodebb` | NodeBB | `ghcr.io/nodebb/nodebb:4.16.2` | 状态落 `./data` | 1 |
| P3 | `ntfy` | ntfy | `binwiederhier/ntfy:v2.29.0` | 状态落 `./data` | 1 |
| P3 | `obsidian_livesync` | Obsidian LiveSync | `couchdb:3.5.2` | 状态落 `./data` | 1 |
| P3 | `octop` | Octop | `ghcr.io/tencentcloud/octop:1.0.1` | 状态落 `./data`；仅 amd64 | 1 |
| P3 | `ollama-webui` | OpenWebUI | `ghcr.io/open-webui/open-webui:v0.11.4` | 状态落 `./data` | 1 |
| P3 | `onlyoffice` | ONLYOFFICE Docs | `onlyoffice/documentserver:9.4.0.1` | 状态落 `./data` | 1 |
| P3 | `opengist` | Opengist | `ghcr.io/thomiceli/opengist:1.15.2` | 状态落 `./data` | 1 |
| P3 | `palworld-server-tool` | Palworld Server Tool | `jokerwho/palworld-server-tool:0.12.2` | 状态落 `./data` | 1 |
| P3 | `pgadmin4` | PGAdmin4 | `dpage/pgadmin4:9.18` | 状态落 `./data` | 1 |
| P3 | `qiandao` | QD | `a76yyyy/qiandao:20250803` | 状态落 `./data` | 1 |
| P3 | `showdoc` | ShowDoc | `star7th/showdoc:v3.9.4` | 状态落 `./data`；仅 amd64 | 1 |
| P3 | `siyuan` | 思源笔记 | `b3log/siyuan:v3.8.6` | 状态落 `./data` | 1 |
| P3 | `stirling-pdf` | Stirling-PDF | `frooodle/s-pdf:3.1.0` | 状态落 `./data` | 1 |
| P3 | `sun-panel` | Sun-Panel | `hslr/sun-panel:1.8.1` | 状态落 `./data` | 1 |
| P3 | `synapse` | Synapse | `matrixdotorg/synapse:v1.162.0` | 状态落 `./data` | 1 |
| P3 | `tinyrdm` | Tiny RDM | `ghcr.io/tiny-craft/tiny-rdm:1.2.7` | 状态落 `./data` | 1 |
| P3 | `trendradar` | TrendRadar | `wantcat/trendradar:6.10.0` | 状态落 `./data` | 1 |
| P3 | `trilium` | Trilium | `triliumnext/trilium:v0.106.0` | 状态落 `./data` | 1 |
| P3 | `twikoo` | Twikoo | `imaegoo/twikoo:2.0.12` | 状态落 `./data` | 2 |
| P3 | `uptime-kuma` | Uptime Kuma | `louislam/uptime-kuma:1.23.17` | 状态落 `./data` | 2 |
| P3 | `vane` | Vane | `itzcrazykns1337/vane:v1.12.2` | 状态落 `./data` | 1 |
| P3 | `verdaccio` | Verdaccio | `verdaccio/verdaccio:6.10.5` | 状态落 `./data` | 1 |
| P3 | `waline` | Waline | `lizheming/waline:1.43.4` | 状态落 `./data` | 1 |
| P3 | `wallos` | Wallos | `bellamy/wallos:5.8.3` | 状态落 `./data` | 1 |
| P3 | `xiaomusic` | XiaoMusic | `hanxi/xiaomusic:v0.6.1` | 状态落 `./data` | 1 |
| P3 | `zfile` | ZFile | `zhaojun1998/zfile:5.0.9` | 状态落 `./data` | 1 |
| P1 | `sqlbot` | SQLBot | `dataease/sqlbot:v1.10.2` | 状态落 `./data`（含容器内自带 PostgreSQL）；多端口×2；仅 amd64。**分级订正**：原 T2，但实测 `PANEL_DB_*`/`DBHUB_DB_*` 命中 0 处，上游注释写明「all-in-one containerized database」，按外部数据库判据应归 T1 | 1 |
| P2 | `nginx-proxy-manager` | Nginx Proxy Manager | `jc21/nginx-proxy-manager:2.16.0` | 状态落 `./data`；多端口×3 | 1 |
| P2 | `sftpgo` | SFTPGo | `drakkan/sftpgo:v2.7.6-alpine` | 状态落 `./data`；多端口×5 | 1 |
| P2 | `openlist` | OpenList | `（变量镜像）` | 状态落 `./data`；多端口×2 | 1 |
| P2 | `cordys-crm` | Cordys CRM | `1panel/cordys-crm:v1.9.3` | 状态落 `./data`；外部数据库；多端口×2；仅 amd64 | 1 |
| P3 | `adguardhome` | AdGuardHome | `adguard/adguardhome:v0.107.79` | 状态落 `./data`；多端口×14 | 1 |
| P3 | `alist` | AList | `xhofe/alist:v3.64.0` | 状态落 `./data`；多端口×2 | 1 |
| P3 | `astrbot` | AstrBot | `soulter/astrbot:v4.28.2` | 状态落 `./data`；多端口×6 | 1 |
| P3 | `certd` | Certd | `greper/certd:1.45.0` | 状态落 `./data`；多端口×2 | 1 |
| P3 | `discuz` | Discuz! | `tencentci/discuz:v3.4` | 多端口×2；仅 amd64 | 1 |
| P3 | `drawio` | Draw.io | `jgraph/drawio:32.3.0` | 多端口×2 | 1 |
| P3 | `gsmanager` | GSManager | `xiaozhu674/gameservermanager:3.14.0` | 状态落 `./data`；多端口×2；仅 amd64 | 1 |
| P3 | `heimdall` | Heimdall | `linuxserver/heimdall:2.8.3` | 状态落 `./data`；多端口×2 | 1 |
| P3 | `koishi` | Koishi | `koishijs/koishi:v1.16.0` | 状态落 `./data`；服务选择器联动 | 1 |
| P3 | `langbot` | LangBot | `rockchin/langbot:v4.10.11` | 状态落 `./data`；多端口×2；多容器×2 | 1 |
| P3 | `maddy-mail` | Maddy Mail Server | `foxcpp/maddy:0.9.6` | 状态落 `./data`；多端口×5 | 1 |
| P3 | `manticoresearch` | Manticore Search | `manticoresearch/manticore:29.9.0` | 状态落 `./data`；多端口×2 | 1 |
| P3 | `neko` | Neko | `（变量镜像）` | 状态落 `./data`；多端口×2 | 1 |
| P3 | `palworld` | Palworld Server | `thijsvanloef/palworld-server-docker:v2.8.0` | 状态落 `./data`；多端口×4 | 2 |
| P3 | `qbittorrent` | qBittorrent | `linuxserver/qbittorrent:5.2.4` | 状态落 `./data`；多端口×3 | 1 |
| P3 | `redpanda-console` | Redpanda Console | `redpandadata/console:v3.12.0` | 服务选择器联动 | 1 |
| P3 | `rocketmq` | RocketMQ | `apache/rocketmq:5.5.0` | 状态落 `./data`；多端口×3；多容器×4；仅 amd64 | 1 |
| P3 | `rustdesk` | RustDesk | `rustdesk/rustdesk-server-s6:1.1.16` | 状态落 `./data`；多端口×6 | 1 |
| P3 | `rustfs` | RustFS | `rustfs/rustfs:1.0.1` | 状态落 `./data`；多端口×2 | 1 |
| P3 | `screego` | screego | `ghcr.io/screego/server:1.12.6` | 多端口×3 | 1 |
| P3 | `sentinel-dashboard` | Sentinel Dashboard | `bladex/sentinel-dashboard:1.8.10` | 多端口×2 | 1 |
| P3 | `stalwart-mail` | Stalwart Mail Server | `stalwartlabs/stalwart:v0.16.25-alpine` | 状态落 `./data`；多端口×10 | 1 |

> **分级订正（D-03，2026-10-14）**：以下应用原列 T2，但按**广义外部依赖判据**（扫描 `PANEL_DB_*`/`DBHUB_DB_*`/`FORGEJO__database__*`/`GITEA__database__*`/`KC_DB_*`/`DATABASE_URL`/`MB_DB_*` 等 DB 变量，以及 `PANEL_REDIS*`/`REDIS_HOST`/`PANEL_MINIO*` 等中间件变量）实测**均无外部依赖**，且原记录改造点为「状态落 `./data`」「多端口×N」——**属 T1 特征**，移入 T1。

> **两点说明**：① **判据不能只看 `PANEL_DB_*` 前缀**——`forgejo` 的 DB 变量是 `FORGEJO__database__*`、`gitea` 是 `GITEA__database__*`、`keycloak` 是 `KC_DB_*`，都不吃 1Panel 命名，只按前缀扫会误判为 T1。② **依赖中间件（Redis/MinIO）也算 T2**——`rsshub` 无数据库但依赖外部 Redis，保留在 T2。


### T2 资源集成改造（47 个）

需要外部数据库/Redis、多端口、多容器或服务选择器联动字段。

| 优先级 | 上游应用 | 展示名 | 主镜像 | 关键改造点 | 上游版本数 |
| --- | --- | --- | --- | --- | --- |
| P1 | `umami` | Umami | `ghcr.io/umami-software/umami:3.4.0` | 外部数据库（`PANEL_DB_*`）。**版本订正**：原登记「（变量镜像）」不可用——`2.20.2` 的镜像为 `umami:${PANEL_DB_TYPE}-v2.20.2` 含变量插值，规约禁止；`3.4.0` 是唯一无插值版本 | 2 |
| P1 | `dbhub` | DBHub | `bytebase/dbhub:1.4.0` | 需外部数据库，`DBHUB_DB_*` 连接信息由向导收集 | 1 |
| P2 | `zabbix-server` | Zabbix Server | `zabbix/zabbix-server-mysql:alpine-7.4.5` | 服务选择器联动；外部数据库；多容器×3 | 1 |
| P2 | `gitea` | Gitea | `commitgo/gitea-ee:27.3.4` | 状态落 `./data`；服务选择器联动；外部数据库；多端口×2 | 1 |
| P2 | `wordpress` | WordPress | `wordpress:7.1.3` | 状态落 `./data`；服务选择器联动；外部数据库 | 1 |
| P2 | `halo` | Halo | `halohub/halo-pro:2.26.1` | 状态落 `./data`；服务选择器联动 | 1 |
| P2 | `zabbix-proxy` | Zabbix Proxy | `zabbix/zabbix-proxy-mysql:alpine-7.4.5` | 服务选择器联动；外部数据库 | 1 |
| P2 | `dbx` | DBX | `t8y2/dbx:0.6.35` | 状态落 `./data`；外部数据库 | 1 |
| P2 | `dataease` | DataEase | `registry.cn-qingdao.aliyuncs.com/dataease/dataease:v2.10.27` | 状态落 `./data`；服务选择器联动；外部数据库 | 2 |
| P3 | `affine` | AFFiNE | `ghcr.io/toeverything/affine:0.27.4` | 状态落 `./data`；服务选择器联动；外部数据库；Redis；多容器×2 | 2 |
| P3 | `bettafish` | BettaFish | `ghcr.io/666ghj/bettafish:v3.0.0` | 状态落 `./data`；服务选择器联动；外部数据库；多端口×4 | 1 |
| P3 | `blinko` | Blinko | `blinkospace/blinko:1.8.8` | 状态落 `./data`；服务选择器联动；外部数据库 | 1 |
| P3 | `casdoor` | Casdoor | `casbin/casdoor:4.18.0` | 状态落 `./data`；服务选择器联动；外部数据库 | 1 |
| P3 | `cloudreve` | Cloudreve | `cloudreve/cloudreve:4.19.1` | 状态落 `./data`；服务选择器联动；外部数据库；Redis | 1 |
| P3 | `discourse` | Discourse | `bitnamilegacy/discourse:3.5.0` | 状态落 `./data`；服务选择器联动；外部数据库；Redis；多容器×2 | 1 |
| P3 | `dvwa` | DVWA | `ghcr.io/digininja/dvwa:latest` | 服务选择器联动；外部数据库；仅 amd64 | 1 |
| P3 | `emlog` | emlog | `emlog/emlog:pro-latest-php8.2-nginx` | 状态落 `./data`；服务选择器联动；外部数据库 | 1 |
| P3 | `firefly-iii` | Firefly III | `fireflyiii/core:version-6.4.2` | 状态落 `./data`；服务选择器联动；外部数据库 | 1 |
| P3 | `flarum` | Flarum | `crazymax/flarum:1.8.19` | 状态落 `./data`；服务选择器联动；外部数据库 | 1 |
| P3 | `forgejo` | Forgejo | `（变量镜像）` | 状态落 `./data`；服务选择器联动；外部数据库；多端口×2 | 2 |
| P3 | `ghost` | Ghost | `ghost:6.69.0` | 状态落 `./data`；服务选择器联动；外部数据库 | 1 |
| P3 | `keycloak` | Keycloak | `keycloak/keycloak:26.8.0` | 服务选择器联动；外部数据库 | 1 |
| P3 | `langflow` | Langflow | `langflowai/langflow:1.12.5` | 状态落 `./data`；服务选择器联动；外部数据库 | 1 |
| P3 | `logto` | Logto | `svhd/logto:1.44.0` | 服务选择器联动；外部数据库；多端口×2 | 1 |
| P3 | `mattermost` | Mattermost | `mattermost/mattermost-team-edition:11.11.1` | 状态落 `./data`；服务选择器联动；外部数据库；多端口×3 | 1 |
| P3 | `metabase` | Metabase | `metabase/metabase:v0.64.1` | 状态落 `./data`；服务选择器联动；外部数据库；仅 amd64 | 1 |
| P3 | `miniflux` | Miniflux | `miniflux/miniflux:2.3.3` | 服务选择器联动；外部数据库 | 1 |
| P3 | `mliev-dwz` | 木雷短网址 | `docker.cnb.cool/mliev/dwz/dwz-server:v2.24.0` | 状态落 `./data`；服务选择器联动；外部数据库；Redis | 1 |
| P3 | `mongo-express` | mongo-express | `mongo-express:1.0.2-20` | 服务选择器联动；外部数据库 | 1 |
| P3 | `nocobase` | NocoBase | `nocobase/nocobase:2.2.21` | 状态落 `./data`；服务选择器联动；外部数据库 | 1 |
| P3 | `nocodb` | NocoDB | `nocodb/nocodb:0.301.5` | 状态落 `./data`；服务选择器联动；外部数据库 | 1 |
| P3 | `odoo` | Odoo | `odoo:18.0` | 状态落 `./data`；服务选择器联动；外部数据库 | 2 |
| P3 | `photoprism` | PhotoPrism | `photoprism/photoprism:251130-ce` | 状态落 `./data`；服务选择器联动；外部数据库 | 1 |
| P3 | `planka` | Planka | `ghcr.io/plankanban/planka:2.2.1` | 状态落 `./data`；服务选择器联动；外部数据库 | 1 |
| P3 | `redis-commander` | Redis-Commander | `rediscommander/redis-commander:latest` | 服务选择器联动；外部数据库；Redis；仅 amd64 | 1 |
| P3 | `roundcube` | Roundcube | `roundcube/roundcubemail:1.7.4-apache` | 状态落 `./data`；服务选择器联动；外部数据库 | 1 |
| P3 | `rsshub` | RSSHub | `diygod/rsshub:chromium-bundled-2026-04-19` | 服务选择器联动；Redis | 1 |
| P3 | `sonarqube` | SonarQube | `sonarqube:10.7.0-community` | 状态落 `./data`；服务选择器联动；外部数据库 | 3 |
| P3 | `sub2api` | Sub2API | `weishaw/sub2api:0.2.14` | 状态落 `./data`；服务选择器联动；外部数据库；Redis | 1 |
| P3 | `tailchat` | Tailchat | `moonrailgun/tailchat:1.11.18` | 服务选择器联动；外部数据库；Redis；多容器×2 | 1 |
| P3 | `teable` | Teable | `ghcr.io/teableio/teable:latest` | 状态落 `./data`；服务选择器联动；外部数据库；Redis | 1 |
| P3 | `teamspeak` | TeamSpeak | `teamspeak:3.13.8` | 状态落 `./data`；服务选择器联动；外部数据库；多端口×3；仅 amd64 | 1 |
| P3 | `twenty` | Twenty | `twentycrm/twenty:v2.45.6` | 状态落 `./data`；服务选择器联动；外部数据库；Redis；多容器×2 | 1 |
| P3 | `typecho` | Typecho | `joyqi/typecho:1.3.0-php8.2-apache` | 状态落 `./data`；服务选择器联动；外部数据库 | 1 |
| P3 | `vexdb` | VexDB | `shuzhiyinhang/vexdb:3.0.0.28146` | 状态落 `./data`；外部数据库 | 1 |
| P3 | `wikijs` | Wiki.js | `requarks/wiki:2.5.316` | 服务选择器联动；外部数据库 | 1 |
| P3 | `yourls` | YOURLS | `yourls:1.10.6` | 状态落 `./data`；服务选择器联动；外部数据库 | 1 |

### T4 高风险待确认（33 个）

需要 docker.sock、privileged、host 网络、cap_add 或设备直通，超出默认权限模型。

| 优先级 | 上游应用 | 展示名 | 主镜像 | 关键改造点 | 上游版本数 |
| --- | --- | --- | --- | --- | --- |
| P1 | `home-assistant` | Home Assistant | `homeassistant/home-assistant:2026.10.0` | 状态落 `./data`；host 网络；cap_add | 1 |
| P1 | `ddns-go` | ddns-go | `jeessy/ddns-go:v6.17.7` | 状态落 `./data`；host 网络 | 1 |
| P2 | `metersphere` | MeterSphere | `metersphere/metersphere-ce-allinone:v3.6.9-lts` | 状态落 `./data`；privileged | 1 |
| P2 | `jumpserver` | JumpServer | `jumpserver/jms_all:v5.0.0` | 状态落 `./data`；服务选择器联动；外部数据库；Redis；多端口×2；privileged | 1 |
| P2 | `frpc` | frp 客户端 | `snowdreamtech/frpc:0.71.0-alpine` | 状态落 `./data`；host 网络；cap_add；设备直通 | 1 |
| P2 | `frps` | frp 服务端 | `snowdreamtech/frps:0.71.0-alpine` | 状态落 `./data`；host 网络 | 1 |
| P3 | `act_runner` | Act Runner | `gitea/act_runner:0.6.1` | 状态落 `./data`；docker.sock | 1 |
| P3 | `arcadia` | Arcadia | `supermanito/arcadia:1.1.0` | 状态落 `./data`；cap_add | 1 |
| P3 | `caddy` | Caddy | `caddy:2.11.7` | 状态落 `./data`；host 网络；cap_add | 1 |
| P3 | `dockge` | Dockge | `louislam/dockge:1.5.0` | 状态落 `./data`；docker.sock | 1 |
| P3 | `docmost` | Docmost | `docmost/docmost:0.96.0` | 状态落 `./data`；服务选择器联动；外部数据库；Redis；env_file | 1 |
| P3 | `easytier` | EasyTier | `easytier/easytier:v2.7.0` | 状态落 `./data`；privileged；host 网络 | 1 |
| P3 | `forgejo-runner` | Forgejo Actions Runner | `code.forgejo.org/forgejo/runner:13.2.0` | 状态落 `./data`；多容器×2；docker.sock；privileged | 1 |
| P3 | `gitlab` | GitLab | `gitlab/gitlab-ce:19.4.1-ce.0` | 状态落 `./data`；多端口×2；cap_add | 1 |
| P3 | `harness` | Harness | `harness/harness:3.3.0` | 状态落 `./data`；多端口×2；docker.sock | 1 |
| P3 | `homepage` | Homepage | `ghcr.io/gethomepage/homepage:v2.4.0` | 状态落 `./data`；docker.sock | 1 |
| P3 | `jenkins` | Jenkins | `jenkins/jenkins:2.580.1-lts` | 状态落 `./data`；docker.sock；privileged | 1 |
| P3 | `kubepi` | KubePi | `1panel/kubepi:v2.0.3` | 状态落 `./data`；privileged | 1 |
| P3 | `mailserver` | Mailserver | `ghcr.io/docker-mailserver/docker-mailserver:16.0.1` | 状态落 `./data`；多端口×5；env_file | 1 |
| P3 | `mcsmanager-daemon` | MCSManager | `githubyumao/mcsmanager-daemon:latest` | 状态落 `./data`；docker.sock | 1 |
| P3 | `netdata` | Netdata | `netdata/netdata:v2.12.0` | 状态落 `./data`；docker.sock；cap_add | 1 |
| P3 | `npc` | NPC | `yisier1/npc:v0.26.35` | host 网络 | 1 |
| P3 | `nps` | NPS | `yisier1/nps:v0.26.35` | 状态落 `./data`；host 网络 | 1 |
| P3 | `onedev` | OneDev | `1dev/server:16.8.6` | 状态落 `./data`；多端口×2；docker.sock | 1 |
| P3 | `openvpn` | OpenVPN | `openvpn/openvpn-as:latest` | 状态落 `./data`；多端口×3；cap_add | 1 |
| P3 | `outline` | Outline | `outlinewiki/outline:1.10.1` | 状态落 `./data`；服务选择器联动；外部数据库；Redis；env_file | 1 |
| P3 | `portainer-ce` | Portainer-CE | `portainer/portainer-ce:2.45.2-alpine` | 状态落 `./data`；多端口×2；docker.sock | 1 |
| P3 | `vllm` | vLLM | `（变量镜像）` | 状态落 `./data`；privileged；host 网络；设备直通 | 6 |
| P3 | `watchtower` | watchtower | `containrrr/watchtower` | docker.sock | 1 |
| P3 | `windows` | Windows | `dockurr/windows:6.06` | 状态落 `./data`；cap_add；设备直通 | 1 |
| P3 | `woodpecker` | Woodpecker CI | `woodpeckerci/woodpecker-server:v3.19.0-alpine` | 状态落 `./data`；多容器×2；docker.sock | 1 |
| P3 | `zabbix-xinchuang-edition` | Zabbix 信创版 | `zabbix/zabbix-server-mysql:ubuntu-7.0.27` | 状态落 `./data`；服务选择器联动；外部数据库；多容器×7；privileged | 1 |
| P3 | `zitadel` | ZITADEL | `ghcr.io/zitadel/zitadel:v2.71.13` | 状态落 `./data`；服务选择器联动；外部数据库；env_file | 3 |

### T3 运行环境型（12 个）

语言运行时与 Web 服务器，与 fnOS `install_dep_apps` 依赖模型不兼容。

| 优先级 | 上游应用 | 展示名 | 主镜像 | 关键改造点 | 上游版本数 |
| --- | --- | --- | --- | --- | --- |
| P1 | `dotnet` | .NET | `（变量镜像）` | 状态落 `./data` | 5 |
| P1 | `python` | Python | `（变量镜像）` | 状态落 `./data` | 5 |
| P1 | `go` | Go | `（变量镜像）` | 状态落 `./data` | 6 |
| P1 | `node` | Node.js | `（变量镜像）` | 状态落 `./data` | 9 |
| P1 | `java` | Java | `（变量镜像）` | 状态落 `./data` | 6 |
| P1 | `php7` | PHP 7 | `（变量镜像）` | 状态落 `./data` | 5 |
| P1 | `php8` | PHP 8 | `（变量镜像）` | 状态落 `./data` | 5 |
| P1 | `php` | PHP | `（变量镜像）` | 状态落 `./data`；cap_add；镜像构建 | 3 |
| P2 | `openresty` | OpenResty | `1panel/openresty:1.21.4.3-3-3-focal` | 状态落 `./data`；host 网络；镜像构建 | 3 |
| P3 | `openlitespeed` | OpenLiteSpeed | `litespeedtech/openlitespeed:1.8.1-lsphp74` | 状态落 `./data`；多端口×4；仅 amd64 | 2 |
| P3 | `php5` | PHP 5 | `（变量镜像）` | 状态落 `./data`；仅 amd64 | 3 |
| P3 | `uuwaf` | uuWAF | `uusec/waf:7.2.5` | 状态落 `./data`；外部数据库；多端口×3；多容器×2；仅 amd64 | 1 |

### T3 能力重复（14 个）

数据库与缓存，与 fnOS 已有中间件应用能力重复。

| 优先级 | 上游应用 | 展示名 | 主镜像 | 关键改造点 | 上游版本数 |
| --- | --- | --- | --- | --- | --- |
| P1 | `redis-cluster` | Redis-Cluster | `bitnamilegacy/redis:6.2` | 状态落 `./data`；Redis | 6 |
| P1 | `postgresql-cluster` | PostgreSQL-Cluster | `bitnamilegacy/postgresql:13` | 状态落 `./data`；外部数据库 | 10 |
| P1 | `mysql-cluster` | MySQL-Cluster | `bitnamilegacy/mysql:5.7` | 状态落 `./data`；外部数据库 | 6 |
| P1 | `mariadb` | MariaDB | `mariadb:10.11.19` | 状态落 `./data`；外部数据库 | 4 |
| P1 | `postgresql` | PostgreSQL | `postgres:12.22-alpine` | 状态落 `./data`；外部数据库 | 7 |
| P2 | `redis` | Redis | `redis:6.2.24` | 状态落 `./data` | 3 |
| P2 | `mysql` | MySQL | `mysql:5.6.51` | 状态落 `./data`；外部数据库 | 4 |
| P3 | `greatsql` | GreatSQL | `greatsql/greatsql:8.0.32-27` | 状态落 `./data`；外部数据库 | 1 |
| P3 | `keydb` | KeyDB | `（变量镜像）` | 状态落 `./data`；仅 amd64 | 1 |
| P3 | `mongodb` | MongoDB | `mongo:6.0.28` | 状态落 `./data`；外部数据库 | 3 |
| P3 | `mssql` | Microsoft SQL Server | `mcr.microsoft.com/mssql/server:2017-latest` | 状态落 `./data`；仅 amd64 | 4 |
| P3 | `neo4j` | Neo4j | `neo4j:5.26.31` | 状态落 `./data`；多端口×2 | 1 |
| P3 | `oceanbase` | OceanBase | `oceanbase/oceanbase-ce:4.4.2-lts` | 状态落 `./data` | 1 |
| P3 | `valkey` | Valkey | `valkey/valkey:7.2.14` | 状态落 `./data` | 4 |

### T3 中间件型（20 个）

中间件与监控，通常作为依赖被引用而非独立上架。

| 优先级 | 上游应用 | 展示名 | 主镜像 | 关键改造点 | 上游版本数 |
| --- | --- | --- | --- | --- | --- |
| P3 | `clickhouse` | ClickHouse | `clickhouse/clickhouse-server:26.9.12-alpine` | 状态落 `./data`；多端口×2 | 1 |
| P3 | `consul` | Consul | `hashicorp/consul:2.0.4` | 状态落 `./data`；多端口×2 | 1 |
| P3 | `docker-registry` | Docker Registry | `registry:3.1.2` | 状态落 `./data` | 1 |
| P3 | `elasticsearch` | Elasticsearch | `elasticsearch:7.17.28` | 状态落 `./data` | 3 |
| P3 | `emqx` | EMQX | `emqx/emqx:6.3.1` | 状态落 `./data`；多端口×5 | 1 |
| P3 | `grafana` | Grafana | `grafana/grafana:12.4.12` | 状态落 `./data` | 2 |
| P3 | `influxdb` | InfluxDB | `influxdb:2.9.1` | 状态落 `./data` | 1 |
| P3 | `jaeger` | Jaeger | `jaegertracing/all-in-one:1.76.0` | 仅命名/网络差异 | 1 |
| P3 | `kafka` | Kafka | `bitnamilegacy/kafka:4.0.0` | 仅命名/网络差异 | 1 |
| P3 | `logstash` | Logstash | `logstash:8.19.23` | 状态落 `./data`；多端口×2 | 2 |
| P3 | `meilisearch` | MeiliSearch | `getmeili/meilisearch:v1.54.3` | 状态落 `./data` | 1 |
| P3 | `minio` | MinIO | `minio/minio:RELEASE.2025-04-22T22-12-26Z` | 状态落 `./data`；多端口×2 | 2 |
| P3 | `nacos` | Nacos | `nacos/nacos-server:v3.2.4` | 状态落 `./data`；多端口×3 | 1 |
| P3 | `node-exporter` | Node Exporter | `prom/node-exporter:v1.12.1` | 仅命名/网络差异 | 1 |
| P3 | `prometheus` | Prometheus | `prom/prometheus:v3.15.0` | 状态落 `./data` | 1 |
| P3 | `rabbitmq` | RabbitMQ | `rabbitmq:4.3.6-management-alpine` | 状态落 `./data`；多端口×2 | 1 |
| P3 | `starrocks` | StarRocks | `starrocks/allin1-ubuntu:4.1.6` | 状态落 `./data`；多端口×3 | 1 |
| P3 | `tdengine` | TDengine | `tdengine/tsdb:3.4.2.8` | 状态落 `./data`；多端口×8 | 1 |
| P3 | `typesense` | Typesense | `typesense/typesense:30.2` | 状态落 `./data` | 1 |
| P3 | `vector` | Vector | `timberio/vector:0.59.0-debian` | 状态落 `./data` | 1 |

## 维护方式

本清单由静态扫描生成，扫描口径见「盘点口径」。上游应用新增版本或新增应用后，需要重新扫描并更新计数；不手工维护单个应用的分级。

重新盘点时至少核对：应用总数、`1panel-network` 使用数、`./` 相对挂载数、外部命名卷数、多版本应用数，以及本清单各分级的数量之和是否等于应用总数（14 + 125 + 47 + 46 + 33 = 265）。

### 分级判定条件的互斥性与复算

「分级总览」的七条判定按**第一个命中的条件决定级别**，是有序的互斥级联：一条命中即终止，因此任一应用只属于一个级别，不会同时落入两级。总量守恒（14 + 125 + 47 + 46 + 33 = 265）正是互斥性的检验：只要出现重复归属或遗漏，五个数之和就不等于 265。

复算时按同一顺序逐条求值即可，不需要人工判断：

| 步骤 | 判定 | 命中级别 |
| --- | --- | --- |
| 1 | 应用键属于运行环境集合（php/php5/php7/php8/node/python/go/java/dotnet/openresty/openlitespeed/uuwaf） | T3 运行环境 |
| 2 | 应用键属于数据库/缓存集合（mysql/mariadb/postgresql/redis/mongodb/mssql/neo4j/oceanbase/greatsql/keydb/valkey 及 cluster） | T3 能力重复 |
| 3 | 应用键属于中间件/监控集合（kafka/rabbitmq/minio/elasticsearch/clickhouse/nacos/consul/prometheus/grafana/jaeger 等） | T3 中间件 |
| 4 | 任一版本目录的 compose 命中 `docker.sock`、`privileged: true`、`network_mode: host`、`cap_add`、`devices:`、`build:`、`env_file` | T4 |
| 5 | 多容器、或多端口、或使用 `PANEL_DB_*` / `DBHUB_DB_*` / `PANEL_REDIS_*`、或 `data.yml` 的 `formFields` 含 `type: apps`/`service` 联动字段 | T2 |
| 6 | 任一版本目录的 compose 存在 `./` 相对挂载（引号无关）或外部命名卷（`external: true`），或 `architectures` 未声明 `arm64` | T1 |
| 7 | 以上均不命中（单容器、单端口、无状态或仅命名卷） | T0 |

第 5、6 步有两个容易踩的坑，判定口径必须按下面执行：

- **外部数据库只认连接变量**：`PANEL_DB_*` 与 `DBHUB_DB_*` 才代表「需要用户提供外部数据库实例」。容器内自带的 SQLite（`DB_DATABASE=...sqlite`、`*_DATABASE_DRIVER: sqlite`、`GOTIFY_DATABASE_DIALECT=sqlite3`）与镜像内置数据库（`MYSQL_INTERNAL=true`）**不算**外部依赖，按状态落盘归 T1。反面教训：按「env 里出现 `DATABASE` 字样」判定会把 `2fauth`、`ai-gateway`、`gotify`、`zentao` 误升到 T2；只看 `PANEL_DB_*` 又会漏掉用 `DBHUB_DB_*` 的 `dbhub`，使其误留 T0。
- **相对挂载判定引号无关**：使用正则 `^\s*-\s*['"]?\./`（行首 `- ` 后允许可选引号再接 `./`）。只匹配裸写法会漏掉 `newsnow`、`openldap` 的单引号挂载 `'./data:...'`，使其错留在 T0。

1—3 步按应用键匹配，与 compose 内容无关，只要集合定义不变，结果稳定；4—7 步只读 `appstore/apps/<app>/*/docker-compose.yml` 与 `data.yml`，输入是仓库内的静态文件，因此**同一份 compose 重新跑一遍扫描，应得到完全相同的分级结果**。

扫描实现约定（复算时保持与首次盘点一致）：

- **扫描范围**：`appstore/apps/` 下一级目录为应用；遍历该应用下每个版本子目录，**任一版本命中即该应用命中**（不是「全部版本命中」）。
- **读取位置必须区分两类字段**（这是本轮踩过的坑）：`formFields` **只在版本级** `appstore/apps/<app>/<version>/data.yml` 里，顶层 `appstore/apps/<app>/data.yml` 的 `additionalProperties` 只有展示元数据，**永远不含 `formFields`**；而 `architectures` **顶层和版本级都可能出现**，两处都要读并取并集。把 `formFields` 误按顶层读，会得到「265 个应用全部无表单」的错误结论。
- **多版本取值**：`formFields` 按**任一版本命中即计入**（并集）。实测「任一版本」「全部版本」「第一个版本」三种取法结果均为 259，因为没有任何应用在不同版本之间出现 `formFields` 有/无的差异，所以取法不影响计数。
- **YAML 解析容错**：`data.yml` 存在制表符缩进（`oceanbase`、`jupyter-notebook`），YAML 严格解析会失败；扫描器需先把制表符展开为空格再解析。这两个应用确实有 `formFields`，容错后「带向导表单」为 259 个；漏掉容错会误算为 257。
- **判定用值与展示值**：清单表里的「主镜像」取该应用**排序后第一个**版本目录的 `image`，「上游版本数」取该目录下的版本子目录数；分级判定与展示值无关，只依赖上面的七条。
- **环境集合**：1—3 步的应用键集合是本清单自定义的口径，不是上游 `tags` 字段，新增应用时需要先判断是否应并入集合。

### 复算自检

按上述七条与两条判定口径复算 265 个应用，结果应与本清单完全一致，**无残留偏差**：

```text
T0 = 14   T1 = 98   T2 = 74   T3 = 46   T4 = 33
合计 = 14 + 125 + 47 + 46 + 33 = 265 ✓
```

复算时重点核对两处曾经出错的判据，它们是口径正确性的探针：

| 探针应用 | 正确归属 | 判据写错时的错误结果 |
| --- | --- | --- |
| `dbhub` | T2（用 `DBHUB_DB_*`） | 只看 `PANEL_DB_*` → 误判 T0 |
| `newsnow`、`openldap` | T1（单引号 `./data` 挂载） | 只匹配裸写法 → 误判 T0 |

**关于「相对挂载」计数的两种口径**：盘点口径表的 223 用「行首 `- ` 正则」，它会把 `env_file` 内的相对路径一并计入（当前多算 `zitadel` 一个，**单向 +1，不存在反向漏报**）；若改用「仅解析 `volumes:` 挂载」的严格口径则为 222。**两种口径下七步级联的分级结果完全相同**，因为受影响的 `zitadel`、`mailserver`、`outline`、`docmost` 都已被更靠前的 `env_file` 条件判入 T4，不会走到第 6 步。复算时无论采用哪种口径，分级数字都应是 `14 / 98 / 74 / 46 / 33`；只有「相对挂载」这一个统计值会随之在 222 与 223 之间变化，选 223 时需按上表注明它含 1 个 `env_file` 命中项。
| `2fauth`、`ai-gateway`、`gotify`、`zentao` | T1（容器内自带数据库） | 见 `DATABASE` 就算外部库 → 误判 T2 |

### 已知遗留

| 项 | 说明 | 处理 |
| --- | --- | --- |
| `apps/fn-mysql_v8/` 目录名含下划线，而 `docs/apps/fn-mysql-v8.md`、`docs/public/icons/fn-mysql-v8.png` 用连字符 | `HEAD` 中既存的历史命名，早于本清单的命名规约（`fn-<app>` 全小写、连字符分隔、下划线归一为连字符） | **有意保留不改**：`appname` 是已发布应用的升级主键，改目录名与 `manifest.appname` 会断掉已安装用户的升级路径。**新批次一律用连字符**（如 `act_runner` → `fn-act-runner`、`obsidian_livesync` → `fn-obsidian-livesync`），既存应用不追溯改名 |

**分类维度的已知局限（2026-10-10 登记）**：T1/T2 的分级判据只检查「是否存在 `./` 相对挂载」与「是否依赖外部数据库」，**未区分「应用内部状态」与「用户可见数据」**。后果是部分媒体库/网盘类应用被划入 T1，但其数据目录实际是用户要直接管理的文件，应属 D 组口径（需在 `config/resource` 声明 `data-share`）。

已识别的受影响应用：`zfile`（在线网盘）、`komga`（漫画服务器）、以及已单独划入 D 组的 `navidrome`、`calibre-web`、`audiobookshelf`、`music-tag-web`、`xiaomusic`。

**处理方式**：不返工已完成的转换（本轮均按 `TRIM_PKGVAR` 实现、功能可用），但**逐个登记为「应补 `data-share`」**，在 D 组批次统一补齐 `config/resource` 声明与卸载向导语义。补齐前需真机验证用户文件在 `data-share` 下的读写权限。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-09 | 首次盘点，覆盖上游提交 `3b142d2` 的全部 265 个应用。 |
| 2026-10-09 | 修正分级口径：`cap_add` 归入 T4 触发条件，`arcadia`、`gitlab`、`openvpn` 由 T1/T2 调整到 T4；T4 由 30 增至 33，T1 由 93 调整为 92，T2 由 79 调整为 77。 |
| 2026-10-09 | 补充「维护方式」的互斥性与复算说明：登记级联求值表、扫描实现约定，以及 6 处级联复算偏差（见「已知偏差」）。 |
| 2026-10-09 | 订正分级与计数（D-02）：`./` 相对挂载判定改为引号无关，补回被漏判的 `newsnow`、`openldap`；外部数据库判据收紧为 `PANEL_DB_*`/`DBHUB_DB_*`，`2fauth`、`ai-gateway`、`gotify`、`zentao`（容器内自带数据库）由 T2 回 T1，`dbhub` 由 T0 移入 T2。T0 17→14、T1 92→98、T2 77→74，守恒 `14+98+74+46+33=265`；`formFields` 257→259、`./` 挂载 221→223。「已知偏差」章节收敛为 0 项，改为「复算自检」。 |
| 2026-10-09 | 订正「相对挂载 223」的口径表述：写死判定正则为行首 `- ` 后接可选引号再接 `./`（含 `env_file` 内联项），构成 = **真实 `./` volume 挂载 222 个 + 1 个仅因 `env_file` 相对路径而命中的 `zitadel` = 223（单向 +1，无反向漏报）**；并注明该值不影响分级（222/223 双口径跑完整级联结果完全一致，`14/98/74/46/33`，无差异应用）。 |
| 2026-10-10 | 补登 `llama-cpp` 的挂载事实：上游有 `${MODEL_DIR}:/models`（`MODEL_DIR` 默认 `./models`、`edit: true`），原「仅命名/网络差异」表述不完整。**分级不变**（仍 T0，单容器单端口），但转换时需加 `MODEL_PATH` 向导字段与只读挂载。 |
| 2026-10-10 | 写死 `formFields` 的**读取位置口径**：只在版本级 `appstore/apps/<app>/<version>/data.yml`，顶层 `data.yml` 永不包含（实测 265 个顶层文件命中 0，读错位置会误得「全部无表单」）；多版本按并集取，但实测并集/全部/首个三种取法均得 259（无应用跨版本出现有/无差异）。复算确认 259 在该口径下成立，数字不变。同时新增「已知遗留」章节（登记 `fn-mysql_v8` 下划线命名的历史遗留，有意保留不改）。 |
| 2026-10-10 | 登记分类维度局限：T1/T2 判据只看挂载形态，未区分「应用内部状态」与「用户可见数据」，致 `zfile`/`komga` 等媒体类应用错落 T1（应属 D 组）。不返工，逐个登记待补 `data-share`。同时确立**多版本应用的选版口径 = 取清单登记版本**（依据：本清单为唯一权威来源；要改版本须改清单，不在实现中偏离）。 |
| 2026-10-14 | 订正两处：① `umami` 版本登记由「（变量镜像）」改为 `3.4.0`（`2.20.2` 镜像含 `${PANEL_DB_TYPE}` 插值不可复现，`3.4.0` 是唯一无插值版本）；② `sqlbot` 由 T2 移入 T1（实测 `PANEL_DB_*`/`DBHUB_DB_*` 命中 0，上游为容器内自带 PostgreSQL）。T1 计数 +1、T2 计数 −1。 |
| 2026-10-14 | **分级订正（D-03）**：26 个应用由 T2 移入 T1。判据从「只看 `PANEL_DB_*`/`DBHUB_DB_*`」扩到**广义外部依赖扫描**——`forgejo`(`FORGEJO__database__*`)、`gitea`(`GITEA__database__*`)、`keycloak`(`KC_DB_*`) 都不吃 1Panel 命名，只按前缀扫会误判；`rsshub` 无数据库但依赖外部 Redis，保留 T2。T1 99→125、T2 73→47。 |
| 2026-10-16 | **同步两条用户裁决对分级的影响**：① **镜像标签口径改为「1panel 用什么就用什么」**——原先因可变标签（`:latest`/`:master` 等）被列为「不可转换」的应用**全部解除阻塞**，本清单的「可变标签」不再构成阻塞依据（详见[规约](/development/1panel-conversion)）。② **运行身份「优先非 root」**——`PUID=0` 与镜像层默认 root 不再阻塞，改变量或加 `user:` 即可。**受此影响可转换的应用**：`openlist`、`gsmanager`、`neko`、`excalidraw`、`huginn`、`jsonhero`、`jupyter-notebook`、`koodo-reader`、`lsky-pro`、`mcsmanager-web`、`komga`（其中 8 个已交付）。 |
| 2026-10-19 | **同步分级总览与交付状态**：① 总览表 T1/T2 数量由过期的 98/74 订正为 **125/47**（对应 2026-10-14 的 D-03 订正，当时只改了章节标题未改总览表）；② 合计行「去掉同名后」由 259 改为 265，并补「可转换 186 / 已交付 185」；③ 加「数字口径」说明，解释为何两列现在一致。 |
