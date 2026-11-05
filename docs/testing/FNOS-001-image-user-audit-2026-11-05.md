---
title: FNOS-001 镜像运行身份审计（2026-11-05）
description: 逐个查询镜像 config.User，判定「容器会不会以 root 写数据」，把 186 个 Docker 应用分成 A/B/C/D 四类并给出整改批量方案。
feature: FNOS-001
lastVerified: 2026-11-05
---

# FNOS-001 镜像运行身份审计（2026-11-05）

## 为什么要做这次审计

[同步批次安装测试报告](/testing/FNOS-001-sync-2026-11-05-install-report) 定案了一条规则：compose 需要写 `user:` 时
一律用 `user: "${TRIM_UID}:${TRIM_GID}"`，并已由 `pnpm run check -- --apps` 机器校验。

但那条校验只覆盖「**写了 `user:` 但值不对**」。真正决定容器身份的还有另一半：**compose 不写 `user:` 时，
容器以镜像层 `config.User` 运行**——镜像没设置就是 **root**。以 root 写数据正是「卸载选删除所有数据仍残留」的
根因，所以必须把每个应用的镜像默认身份查清楚，不能只看 compose。

## 方法

| 项 | 说明 |
| --- | --- |
| 数据来源 | registry 的 image config blob（`config.User`），**不拉镜像层**，只看身份字段 |
| 覆盖 | 186 个 Docker 应用（另有 7 个原生应用无 compose，不在范围内） |
| 工具 | `node scripts/audit-image-user.mjs`（可重复运行，结果缓存到 `tmp/image-user-cache.json`） |
| 平台 | 取 manifest 列表里的 `linux/amd64`，与转换登记的目标平台一致 |
| 容器变量镜像 | `${IMAGE_NAME}` 这类变量引用无法静态解析（如 `fn-neko`），单列 D 类 |

分类口径：

| 类别 | 含义 | 后果 |
| --- | --- | --- |
| **A** | 镜像默认 root **且** compose 未写 `user:` | 容器以 root 写挂载目录 → 卸载「删除所有数据」残留（**缺陷候选**） |
| **B** | 镜像默认 root 且 compose 写了 `user:` | 已按规约对齐包用户，运行身份正确 |
| **C** | 镜像自带非 root 且 compose 未写 `user:` | 容器以镜像内固定 uid 运行；`install_callback` 建的目录属包用户、mount `770`，该 uid 可能**无权写**（属主待验证） |
| **D** | 查询失败 | 私有仓库鉴权、Docker Hub 匿名限流（HTTP 429）或变量镜像，需稍后重跑补齐 |

## 结论

| 类别 | 数量 | 占比 |
| --- | --- | --- |
| A（root 且无 `user:`，缺陷候选） | **96** | 51.6% |
| B（已对齐包用户） | 15 | 8.1% |
| C（镜像自带非 root，属主待验证） | 31 | 16.7% |
| D（未解析） | 38 | 20.4% |
| 合计 | 186 | 100% |

**A 类远多于此前估计**：本轮修复的 3 个应用只是其中极小一部分，说明「容器以 root 写数据」是转换批次的
**系统性问题**，不是个别应用的手误。

## 整改方案（分批，需真机逐个验证）

不能机械地给 96 个应用一起加 `user:`——有几类镜像加了会起不来：

| 情形 | 处置 |
| --- | --- |
| 普通 Web 应用（自己不需要 root 初始化） | 直接加 `user: "${TRIM_UID}:${TRIM_GID}"` + `install_callback` 预建挂载源目录 |
| 镜像初始化强依赖 root（s6 / supervisord / 启动必执行 `chown`） | 保持原样，`user: "0:0"` + `# USER-EXCEPTION: <原因>`，并接受「数据可能是 root 属主」这一既知限制 |
| 数据库/有状态服务（`postgres`/`mysql` 等以自有 uid 建数据目录） | 加 `user:` 让数据属包用户；需验证 initdb/初始化在非 root 下仍成立 |
| 运行时把 `HOME`/缓存写进镜像层路径的（如 `fn-upage`） | 加 `user:` 的同时把 `HOME`/缓存目录指到已挂载、属主为包用户的路径 |

验证方式沿用既有批量验收器 `scripts/batch-verify.mjs`：它逐应用执行「安装 → 等 running → 探入口 → 卸载（删除数据）
→ 记录残留条目」，正好能对 A 类逐个判定「加 `user:` 后是否仍可用、残留是否归零」。

**本轮未改动 A 类的任何应用**：批量改 96 个应用必须配同样的批量真机验证，否则等于用未验证的改动替换已验证的漏洞。

## 第一批样例（已真机验证，4 个应用 / 3 种形态）

按「先跑不同形态」的原则，从 A 类里挑了 4 个：单容器 Web、带上传目录、带 SQLite 库、带**外部 MySQL**。

| 应用 | 形态 | 改动 | 结果 |
| --- | --- | --- | --- |
| `fn-glance` | Go 单二进制 + 单文件挂载 | 只加 `user:` | 包用户运行、入口 `200`、卸载残留 **0** |
| `fn-gotify` | 带上传目录（`data/images`）+ SQLite | 加 `user:` + `install_callback` 预建 `data` | 包用户运行（`User=913:908`）、入口 `200`、`gotify.db`/`images`/`plugins` 全属包用户、卸载残留 **0** |
| `fn-mblog` | 带 SQLite 数据库 | 加 `user:` + 预建 `data` | 包用户运行（`889:882`）、入口 `200`、`data.sqlite` 属包用户、卸载残留 **0** |
| `fn-sun-panel` | 多目录（`conf`/`uploads`/`database`） | 见下方「变体一」 | 包用户运行（`843:836`）、入口 `200`、卸载残留 **0** |

### 变体一：应用会往**镜像层目录**写东西（`fn-sun-panel`）

加了 `user:` 后容器反复重启，日志依次报：

1. `panic: failed to create log file ./runtime/runlog/running.log` —— 应用在 WorkDir(`/app`) 下的 `./runtime/runlog` 写日志；
2. 补挂 `/app/runtime` 后改为 `ERROR lang/lang.go:23 输出语言文件出错: mkdir lang: permission denied` —— 它还要在 `/app/lang` 导出语言文件。

两者在镜像里都属 `root`（`runtime/runlog` 存在、`lang` 不存在），非 root 写不了。处置：把这两处也挂到应用数据目录并预创建

```yaml
- "${TRIM_PKGVAR}/data/runtime:/app/runtime"
- "${TRIM_PKGVAR}/data/lang:/app/lang"
```

**教训**：给「镜像层默认 root」的应用加 `user:` 时，要先看它启动时往镜像层哪些路径写。`/app/runtime`、`/app/lang` 这类**运行期产物目录**单独挂出来即可（镜像内为空，不遮蔽静态资源）；一旦发现，批量整改时同类应用要一并处理。

### 变体二：镜像**自己降权**，不需要也不应该加 `user:`（`fn-flarum`）

`fn-flarum` 在 A 类名单里（镜像 `config.User` 为空），但 compose 里已有：

```yaml
- PUID=${TRIM_UID}
- PGID=${TRIM_GID}
```

真机验证：容器虽以 root 启动，但镜像内的 s6 初始化按 `PUID/PGID` 降权，**写入的文件属主全是包用户**（`/vol2/@appdata/fn-flarum/data/{assets,extensions,storage}` 均属 `docker-fn-flarum`）。所以它**不会**产生「卸载删不掉」的残留，也没有改 compose；这类镜像加 `user:` 反而会打断 s6 初始化。

**结论**：审计只能筛出「可疑」，最终定性要看镜像是否自带降权机制（`PUID/PGID`、`NB_UID`、s6/supervisord 内部 `runuser` 等）。判定顺序与[转换规约](/development/1panel-conversion)的「裁决 B」一致。

### 同时观测到的两类目录残留（与本轮改动无关）

| 现象 | 实测 | 说明 |
| --- | --- | --- |
| `@appconf/<app>` 空目录不回收 | 设备上累计 **195 个**（每个装过的应用一个，均为 0 条目） | 框架创建后不随卸载删除；属平台侧行为，批量整改时需确认是否可安全清理 |
| `@appdata/<app>` 父目录保留 | 卸载「删除所有数据」后父目录仍在、条目数 **0** | 与既有结论一致：平台保留目录，应用只删内容 |

## A 类批量推进与第 1 批真机结果（2026-11-05 下午）

机械改造：76 个应用加 `user: "${TRIM_UID}:${TRIM_GID}"`，35 个 `install_callback` 补「由包用户预建挂载源目录」。
排除 10 个自带降权变量的镜像（`PUID/PGID/NB_UID/CHOWN_HOME`）。

第 1 批（6 个无外部依赖应用，逐装-探-卸）：

| 应用 | 判定 | 说明 |
| --- | --- | --- |
| `fn-beszel` / `fn-gatus` / `fn-artalk` | **PASS** | 入口 200 / 200 / 302 |
| `fn-it-tools` | FAIL → **PASS** | nginx 非 root 建不了 `/var/cache/nginx/client_temp`；补挂 `cache`+`run` 后 200 |
| `fn-kirara-agent` | FAIL → **PASS** | Python 在工作目录建 `logs` 被拒；补挂 `logs` 后 200 |
| `fn-jsonhero` | FAIL → **PASS** | 该镜像需要 root 重建前端（原注释已写），撤销 `user:` 并标 `# USER-EXCEPTION`，200 |

### 教训：批量脚本会覆盖「已记录的例外」

`fn-jsonhero`/`fn-emlog`/`fn-lsky-pro`/`fn-music-tag-web` 四个应用的 compose 里**原本就有真机结论**
写明「必须 root、加 `user:` 会 Permission denied」。机械改造把它们一起改了。已全部撤销并补
`# USER-EXCEPTION: <原因>` 标记（check 现在会放行带标记的例外）。

**因此在批量整改前应先扫一遍「注释里已有 root 结论」的应用**，判据是 compose 注释含
「不指定 user / 需要 root / Permission denied / 降权失败」等字样——本次用这条规则找回了 4 个。

### 加 `user:` 后常见的两类补救（真机验证）

| 现象（容器日志） | 原因 | 补救 |
| --- | --- | --- |
| `mkdir() "/var/cache/nginx/client_temp" failed (13: Permission denied)` | nginx 临时目录在镜像层、归 root | 挂 `${TRIM_PKGVAR}/cache:/var/cache/nginx`、`${TRIM_PKGVAR}/run:/var/run` |
| `PermissionError: [Errno 13] Permission denied: 'logs'`（相对路径） | 应用在 WorkDir 建目录 | 挂 `${TRIM_PKGVAR}/logs:<对应路径>` |
| `EACCES ... /.npm` / `HOME` 不可写 | Home 指向 `/` | 设 `HOME`/`XDG_CACHE_HOME`/`npm_config_cache` 到已挂载的可写目录 |
| s6/supervisord 初始化失败 | 镜像初始化强依赖 root | 不加 `user:`，标 `# USER-EXCEPTION` |

## 第 2、3 批真机结果（2026-11-05 晚）

第 2 批（5 个）：`fn-clawswarm` PASS(200)、`fn-kkfileview` PASS(302)、`fn-certd` PASS(200)、
`fn-bililive-go` PASS(200)、`fn-ai-portal` PASS(200)——后三者首轮 FAIL，按下表修好后复测通过。

第 3 批（5 个）：`fn-adguardhome` PASS(302)；`fn-koishi` / `fn-archivebox` / `fn-laya-server`
属**安装轮询超时**（镜像拉取慢，非应用缺陷），预拉镜像后重测；`fn-llama-cpp` 判定 **BLOCKED**：
容器日志 `failed to load model '/models/model.gguf'`——该应用需要用户自备模型文件，属环境依赖。

### 本轮新增的 root 例外（真机证据）

| 应用 | 容器日志 | 结论 |
| --- | --- | --- |
| `fn-bililive-go` | `chown: .../opt/bililive: Operation not permitted` + `failed switching to "0:0"` | entrypoint 必须 root chown 后 gosu 切换 |
| `fn-koishi` | `chown: /koishi: Operation not permitted` | 启动要 chown 应用目录 |
| `fn-ai-portal` | `su: must be suid to work properly`（反复） | 镜像 entrypoint 内部用 `su` 降权 |
| `fn-adguardhome` | `is the first launch of adguard home; you must run it as administrator` | 首启要求管理员身份 |
| `fn-jsonhero`/`fn-emlog`/`fn-lsky-pro`/`fn-music-tag-web` | 见上节 | 批量前已存在的既有结论，被我误改后回滚 |

以上均按规则撤销 `user:` 并加 `# USER-EXCEPTION: <原因>`，`check --apps` 放行。

### 可修的失败（非例外）

| 应用 | 日志 | 补救 |
| --- | --- | --- |
| `fn-certd` | `EACCES ... open 'logs/app.log'`（log4js） | 挂 `${TRIM_PKGVAR}/logs:/app/logs` |
| `fn-archivebox` | `archivebox user cannot write to /data ... Current owner is 0:0` | 历史残留（改造前以 root 建目录）；清掉 `@appdata/fn-archivebox` 重装即通过预建 |
| `fn-it-tools` | nginx 缓存目录 | 见上节 |
| `fn-kirara-agent` | `logs` 相对目录 | 见上节 |

## 明细## 明细

### A 类：镜像默认 root 且 compose 未写 `user:`（96 个）

| 应用 | 镜像 |
| --- | --- |
| `fn-adguardhome` | `adguard/adguardhome:v0.107.79` |
| `fn-affine` | `ghcr.io/toeverything/affine:0.27.4` |
| `fn-ai-portal` | `1panel/ai-portal:v1.0.10` |
| `fn-alist` | `xhofe/alist:v3.66.0` |
| `fn-answer` | `apache/answer:2.0.3` |
| `fn-archivebox` | `archivebox/archivebox:0.9.77` |
| `fn-artalk` | `artalk/artalk-go:2.10` |
| `fn-astrbot` | `soulter/astrbot:v4.29.3` |
| `fn-beszel` | `henrygd/beszel:0.21.1` |
| `fn-bettafish` | `ghcr.io/666ghj/bettafish:v3.0.0` |
| `fn-bililive-go` | `chigusa/bililive-go:v0.8.3` |
| `fn-bitwarden` | `vaultwarden/server:latest` |
| `fn-blinko` | `blinkospace/blinko:1.8.8` |
| `fn-bytebase` | `bytebase/bytebase:3.24.0` |
| `fn-calibre-web` | `linuxserver/calibre-web:0.6.27` |
| `fn-certd` | `greper/certd:1.46.0` |
| `fn-certimate` | `certimate/certimate:v0.4.36` |
| `fn-changedetectionio` | `dgtlmoon/changedetection.io:0.60.10` |
| `fn-chatgpt-next-web` | `yidadaa/chatgpt-next-web:v2.16.1` |
| `fn-clawswarm` | `1panel/clawswarm:v1.0.5` |
| `fn-cloudbeaver` | `dbeaver/cloudbeaver:26.2.3` |
| `fn-cloudreve` | `cloudreve/cloudreve:4.19.1` |
| `fn-code-server` | `linuxserver/code-server:4.143.1` |
| `fn-comfyui` | `1panel/comfyui:v0.33.1` |
| `fn-convertx` | `c4illin/convertx:v0.20.0` |
| `fn-copaw` | `agentscope/qwenpaw:v2.2.2` |
| `fn-cordys-crm` | `1panel/cordys-crm:v1.9.6` |
| `fn-dbhub` | `bytebase/dbhub:1.5.0` |
| `fn-dbx` | `t8y2/dbx:0.6.61` |
| `fn-discuz` | `tencentci/discuz:v3.4` |
| `fn-domain-admin` | `mouday/domain-admin:v1.6.78` |
| `fn-dosgame` | `firezmc/dosgame-web-docker:v3.9.6` |
| `fn-easyimage2` | `ddsderek/easyimage:v2.8.7` |
| `fn-emlog` | `emlog/emlog:pro-latest` |
| `fn-filecodebox` | `lanol/filecodebox:2.8.5` |
| `fn-flarum` | `crazymax/flarum:2.0.2` |
| `fn-forgejo` | `codeberg.org/forgejo/forgejo:16.0.7` |
| `fn-freshrss` | `linuxserver/freshrss:1.30.4` |
| `fn-gatus` | `twinproduction/gatus:v5.38.0` |
| `fn-gitea` | `commitgo/gitea-ee:27.3.9` |
| `fn-glance` | `glanceapp/glance:v0.8.7` |
| `fn-gotify` | `gotify/server:3.1.1` |
| `fn-halo` | `registry.fit2cloud.com/halo/halo-pro:2.24` |
| `fn-heimdall` | `linuxserver/heimdall:2.8.4` |
| `fn-it-tools` | `corentinth/it-tools:2024.10.22-7ca5933` |
| `fn-jellyfin` | `jellyfin/jellyfin:10.11.11` |
| `fn-jsonhero` | `henryclw/jsonhero-web:latest` |
| `fn-kirara-agent` | `lss233/kirara-agent-framework:v3.2.0` |
| `fn-kkfileview` | `keking/kkfileview:4.1.0` |
| `fn-kodbox` | `kodcloud/kodbox:1.70.03` |
| `fn-koishi` | `koishijs/koishi:v1.16.0` |
| `fn-langbot` | `rockchin/langbot:v4.11.4` |
| `fn-laya-server` | `1panel/laya-server:v0.1.2` |
| `fn-linkding` | `sissbruecker/linkding:1.47.0-plus` |
| `fn-llama-cpp` | `ghcr.io/ggml-org/llama.cpp:server` |
| `fn-localai` | `localai/localai:v3.12.1-aio-cpu` |
| `fn-logto` | `svhd/logto:1.45.0` |
| `fn-lsky-pro` | `halcyonazure/lsky-pro-docker:latest` |
| `fn-maddy-mail` | `foxcpp/maddy:0.9.6` |
| `fn-manticoresearch` | `manticoresearch/manticore:29.9.0` |
| `fn-maxkb` | `1panel/maxkb:v2.10.8-lts` |
| `fn-mblog` | `kingwrcy/mblog:1.1.0` |
| `fn-metabase` | `metabase/metabase:v0.65.2` |
| `fn-mkdocs-material` | `squidfunk/mkdocs-material:9.8.0` |
| `fn-mliev-dwz` | `docker.cnb.cool/mliev/dwz/dwz-server:v2.24.1` |
| `fn-music-tag-web` | `xhongc/music_tag_web:2.8.0` |
| `fn-new-api` | `calciumion/new-api:latest` |
| `fn-newsnow` | `ghcr.io/ourongxing/newsnow:v0.0.41` |
| `fn-nextcloud` | `linuxserver/nextcloud:35.0.2` |
| `fn-nezha` | `ghcr.io/nezhahq/nezha:v2.6.1` |
| `fn-nginx-proxy-manager` | `jc21/nginx-proxy-manager:2.16.0` |
| `fn-nocobase` | `nocobase/nocobase:2.2.36` |
| `fn-nocodb` | `nocodb/nocodb:0.301.5` |
| `fn-octop` | `ghcr.io/tencentcloud/octop:1.0.2` |
| `fn-ollama` | `ollama/ollama:0.40.13` |
| `fn-ollama-webui` | `ghcr.io/open-webui/open-webui:v0.12.5` |
| `fn-onlyoffice` | `onlyoffice/documentserver:10.0.0.1` |
| `fn-opengist` | `ghcr.io/thomiceli/opengist:1.15.3` |
| `fn-palworld` | `thijsvanloef/palworld-server-docker:v2.8.1` |
| `fn-palworld-server-tool` | `jokerwho/palworld-server-tool:0.12.2` |
| `fn-photoprism` | `photoprism/photoprism:251130-ce` |
| `fn-qbittorrent` | `linuxserver/qbittorrent:5.3.0` |
| `fn-qiandao` | `a76yyyy/qiandao:20250803` |
| `fn-qinglong` | `whyour/qinglong:2.24.0-debian` |
| `fn-quark-auto-save` | `ghcr.io/fish2018/pansou:latest` |
| `fn-roundcube` | `roundcube/roundcubemail:1.7.5-apache` |
| `fn-rsshub` | `diygod/rsshub:chromium-bundled-2026-04-19` |
| `fn-rustdesk` | `rustdesk/rustdesk-server-s6:1.1.16` |
| `fn-showdoc` | `star7th/showdoc:v3.9.5` |
| `fn-siyuan` | `b3log/siyuan:v3.8.9` |
| `fn-sqlbot` | `dataease/sqlbot:v1.10.2` |
| `fn-stirling-pdf` | `frooodle/s-pdf:3.2.2` |
| `fn-sub2api` | `weishaw/sub2api:0.2.19` |
| `fn-sun-panel` | `hslr/sun-panel:1.8.1` |
| `fn-trilium` | `triliumnext/trilium:v0.106.1` |
| `fn-zentao` | `hub.zentao.net/app/zentao:22.1` |

### B 类：镜像默认 root 且 compose 已写 `user:`（21 个）

| 应用 | 镜像 | compose user |
| --- | --- | --- |
| `fn-ai-gateway` | `1panel/ai-gateway:v1.5.1` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-audiobookshelf` | `advplyr/audiobookshelf:2.37.2` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-dataease` | `registry.cn-qingdao.aliyuncs.com/dataease/dataease:v3.1.0` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-dvwa` | `ghcr.io/digininja/dvwa:latest` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-excalidraw` | `excalidraw/excalidraw:latest` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-focalboard` | `mattermost/focalboard:7.11.4` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-gsmanager` | `xiaozhu674/gameservermanager:3.14.2` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-huginn` | `ghcr.io/huginn/huginn:latest` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-komari` | `ghcr.io/komari-monitor/komari:1.6.1` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-komga` | `gotson/komga:1.29.2` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-koodo-reader` | `ghcr.io/koodo-reader/koodo-reader:master` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-mcsmanager-web` | `githubyumao/mcsmanager-web:latest` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-navidrome` | `deluan/navidrome:0.64.2` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-nexus` | `sonatype/nexus3:3.97.3` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-node-red` | `nodered/node-red:5.0.9` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-ntfy` | `binwiederhier/ntfy:v2.34.0` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-openlist` | `openlistteam/openlist:v4.2.9` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-sentinel-dashboard` | `bladex/sentinel-dashboard:1.8.10` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-teable` | `ghcr.io/teableio/teable:latest` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-tinyrdm` | `ghcr.io/tiny-craft/tiny-rdm:1.2.7` | `"0:0"` |
| `fn-verdaccio` | `verdaccio/verdaccio:7.0.2` | `"${TRIM_UID}:${TRIM_GID}"` |

### C 类：镜像自带非 root 且 compose 未写 `user:`（31 个）

| 应用 | 镜像 | 镜像 USER |
| --- | --- | --- |
| `fn-2fauth` | `2fauth/2fauth:9.0.0` | `1000:1000` |
| `fn-browserless` | `ghcr.io/browserless/chrome:v2.58.0` | `blessuser` |
| `fn-casdoor` | `casbin/casdoor:v4.25.0` | `1000` |
| `fn-cloudflared` | `cloudflare/cloudflared:2026.10.6` | `65532:65532` |
| `fn-cyberchef` | `ghcr.io/gchq/cyberchef:11.5.0` | `101` |
| `fn-dashy` | `lissy93/dashy:4.9.8` | `1000:1000` |
| `fn-drawio` | `jgraph/drawio:32.6.1` | `tomcat` |
| `fn-ezbookkeeping` | `mayswind/ezbookkeeping:2.1.1` | `1000:1000` |
| `fn-filebrowser` | `filebrowser/filebrowser:v2.63.23` | `user` |
| `fn-firefly-iii` | `fireflyiii/core:version-6.4.2` | `www-data` |
| `fn-jupyter-notebook` | `jupyter/scipy-notebook:latest` | `1000` |
| `fn-keycloak` | `keycloak/keycloak:26.8.1` | `1000` |
| `fn-langflow` | `langflowai/langflow:1.13.0` | `user` |
| `fn-linux-command` | `wcjiang/linux-command:1.22.0` | `static` |
| `fn-lobe-chat` | `lobehub/lobe-chat:1.143.3` | `nextjs` |
| `fn-mattermost` | `mattermost/mattermost-team-edition:12.0.1` | `mattermost` |
| `fn-miniflux` | `miniflux/miniflux:2.3.4` | `65534` |
| `fn-n8n` | `n8nio/n8n:2.46.2` | `node` |
| `fn-nodebb` | `ghcr.io/nodebb/nodebb:4.16.5` | `nodebb` |
| `fn-openclaw` | `1panel/openclaw:2026.10.9` | `node` |
| `fn-openldap` | `bitnamilegacy/openldap:2.6.10` | `1001` |
| `fn-pgadmin4` | `dpage/pgadmin4:9.19` | `5050` |
| `fn-planka` | `ghcr.io/plankanban/planka:2.2.1` | `node` |
| `fn-redis-commander` | `rediscommander/redis-commander:latest` | `1000` |
| `fn-redpanda-console` | `redpandadata/console:v3.13.1` | `redpandaconsole` |
| `fn-rocketmq` | `apache/rocketmq:5.5.0` | `rocketmq` |
| `fn-rustfs` | `rustfs/rustfs:1.0.4` | `rustfs` |
| `fn-screego` | `ghcr.io/screego/server:1.12.6` | `1001` |
| `fn-sftpgo` | `drakkan/sftpgo:v2.7.6-alpine` | `1000:1000` |
| `fn-stalwart-mail` | `stalwartlabs/stalwart:v1.0.1-alpine` | `stalwart` |
| `fn-umami` | `ghcr.io/umami-software/umami:3.4.1` | `nextjs` |

### D 类：查询失败（38 个）

| 应用 | 镜像 | 原因 |
| --- | --- | --- |
| `fn-adminer` | `adminer:6.2.0-standalone` | registry 不可达: fetch failed |
| `fn-ghost` | `ghost:6.73.0` | HTTP 429 (registry) |
| `fn-kibana` | `kibana:9.5.5` | HTTP 429 (registry) |
| `fn-memcached` | `memcached:1.6.22-alpine3.18` | HTTP 429 (registry) |
| `fn-mongo-express` | `mongo-express:1.0.2-20` | HTTP 429 (registry) |
| `fn-neko` | `${IMAGE_NAME}` | SKIP 变量镜像（未解析） |
| `fn-obsidian-livesync` | `couchdb:3.5.3` | HTTP 429 (registry) |
| `fn-odoo` | `odoo:19.0` | HTTP 429 (registry) |
| `fn-phpmyadmin` | `phpmyadmin:5.2.3` | HTTP 429 (registry) |
| `fn-postgres` | `postgres:16.15-alpine` | HTTP 429 (registry) |
| `fn-reader` | `hectorqin/reader:latest` | HTTP 401 (registry) |
| `fn-sonarqube` | `sonarqube:26.10.0.133078-community` | fetch failed |
| `fn-synapse` | `matrixdotorg/synapse:v1.164.1` | registry 不可达: fetch failed |
| `fn-tailchat` | `moonrailgun/tailchat:1.11.18` | registry 不可达: fetch failed |
| `fn-teamspeak` | `teamspeak:3.13.8` | registry 不可达: fetch failed |
| `fn-tomcat` | `bitnamilegacy/tomcat:10.1.43` | registry 不可达: fetch failed |
| `fn-trendradar` | `wantcat/trendradar:6.11.0` | registry 不可达: fetch failed |
| `fn-twenty` | `twentycrm/twenty:v2.53.1` | registry 不可达: fetch failed |
| `fn-twikoo` | `imaegoo/twikoo:2.0.17` | registry 不可达: fetch failed |
| `fn-typecho` | `joyqi/typecho:1.3.0-php8.2-apache` | registry 不可达: fetch failed |
| `fn-upage` | `halohub/upage:2.0.0` | registry 不可达: fetch failed |
| `fn-uptime-kuma` | `louislam/uptime-kuma:2.5.8` | registry 不可达: fetch failed |
| `fn-vane` | `itzcrazykns1337/vane:v1.12.2` | registry 不可达: fetch failed |
| `fn-vexdb` | `shuzhiyinhang/vexdb:3.0.0.28146` | registry 不可达: fetch failed |
| `fn-waline` | `lizheming/waline:1.43.4` | registry 不可达: fetch failed |
| `fn-wallos` | `bellamy/wallos:5.10.2` | registry 不可达: fetch failed |
| `fn-web-check` | `lissy93/web-check:2.3.11` | registry 不可达: fetch failed |
| `fn-wechatmarkdowneditor` | `doocs/md:2.1.0` | registry 不可达: fetch failed |
| `fn-wikijs` | `requarks/wiki:2.5.317` | registry 不可达: fetch failed |
| `fn-wordpress` | `wordpress:7.1.4` | registry 不可达: fetch failed |
| `fn-xiaomusic` | `hanxi/xiaomusic:v0.6.1` | registry 不可达: fetch failed |
| `fn-xiaoya-only` | `xiaoyaliu/alist:latest` | registry 不可达: fetch failed |
| `fn-yesplaymusic` | `fogforest/yesplaymusic:0.4.9` | registry 不可达: fetch failed |
| `fn-yourls` | `yourls:1.10.6` | registry 不可达: fetch failed |
| `fn-zabbix-agent` | `zabbix/zabbix-agent:alpine-7.4.5` | registry 不可达: fetch failed |
| `fn-zabbix-proxy` | `zabbix/zabbix-proxy-mysql:alpine-7.4.5` | registry 不可达: fetch failed |
| `fn-zabbix-server` | `zabbix/zabbix-server-mysql:alpine-7.4.5` | registry 不可达: fetch failed |
| `fn-zfile` | `zhaojun1998/zfile:5.1.0` | registry 不可达: fetch failed |

## 后续任务

| 任务 | 范围 | 验收 |
| --- | --- | --- |
| A 类批量整改（第一批） | 96 个里先跑不同形态（单容器 Web、带数据库、带上传目录）——`fn-glance` 已完成（见上） | 安装成功 + 入口可访问 + 卸载残留 0 |
| A 类批量整改（其余） | 视第一批结果扩展到全量 | 同上；失败者按上游 entrypoint 判定是否归 `# USER-EXCEPTION` |
| C 类属主验证 | 31 个 | 容器能写挂载目录（`touch` 探针），必要时 ACL 授权镜像 uid |
| D 类补查 | 38 个 | 限流窗口过后重跑 `node scripts/audit-image-user.mjs`，缓存会自动续查 |

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-11-05 | 建立本审计：186 个 Docker 应用按镜像 `config.User` 与 compose `user:` 交叉分类；登记 A 类 96 个为缺陷候选并给出分批整改方案，说明本轮不改动的原因。 |
