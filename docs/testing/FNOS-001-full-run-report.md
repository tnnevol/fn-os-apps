---
title: FNOS-001 全量真机验收报告（189 应用）
description: 对全部 189 个已转换应用逐个执行「安装→启动→入口探测→卸载→残留清理」的真机验收结果，含判定分布、失败归因与已修复缺陷清单。
feature: FNOS-001
lastVerified: 2026-10-28
---

# FNOS-001 全量真机验收报告（189 应用）

本轮把仓库内**全部 189 个已转换应用**在真实 fnOS 设备上逐个跑完了
[批量真机验收规程](/testing/FNOS-001-batch-verification) 定义的七步流程：
本地 `fnpack build` → 投放到设备暂存目录 → 应用中心解析安装包 → 读向导 schema 自动填参 →
提交安装并轮询 → 等 `running` 后探测入口端口 → 卸载、回收 compose 网络、清理残留。

**设备信息按纪律脱敏**：本文所有设备一律称「目标测试设备」，地址用 `${FNOS_HOST}` 占位。

## 1. 结论概览

| 判定 | 数量 | 占比 | 含义 |
| --- | ---: | ---: | --- |
| `PASS` | **103** | 54.5% | 安装成功、状态 `running`、入口返回可访问状态码 |
| `UNVERIFIED` | 37 | 19.6% | 向导必填项需要用户环境信息，无法自动填写，未作出可用性结论 |
| `FAIL` | 27 | 14.3% | 安装或启动失败，且证据指向转换自身的问题 |
| `BLOCKED` | 22 | 11.6% | 依赖外部数据库/中间件或镜像源等环境原因，不计为转换缺陷 |
| **合计** | **189** | 100% | 全覆盖，无遗漏应用 |

其中 `FAIL` 的 27 个已全部取得容器侧证据（容器状态 + 容器日志），可按根因归并整改。

## 2. 通道说明

安装、查询、卸载都走应用中心 HTTP 接口，但**凭证由浏览器代发**：

- 会话 Cookie（`osrt` / `ost`）是 **HttpOnly**，页内 JS 读不到，`document.cookie` 只剩埋点与语言项；
- 因此经 Midscene Bridge 连上用户已登录的浏览器标签页，用**页面同源 fetch** 调接口；
- 桥接断开自动重连，目标标签页被关闭自动重开一次；会话真过期时抛 `SESSION_EXPIRED` 并中止整批。

这条通道的结论与设备端 CLI 通道**等效**，判定口径不变。

## 3. 失败归因

### 3.1 权限 / 属主类（5 个，已定位根因）

共同特征：容器 `Restarting (N)`、入口 `000`，日志里是 `EACCES` / `PermissionError`。
根因是**以非 root（包用户）运行时，镜像要写的目录归 `root` 所有**，而 `install_callback` 是空操作，
没有任何环节把属主交给运行用户。

| 应用 | 报错位置 | 性质 |
| --- | --- | --- |
| `fn-node-red` | `/data/settings.js`（挂载目录） | 数据目录属主未对齐 |
| `fn-nodebb` | `/opt/config`（挂载目录） | 数据目录属主未对齐 |
| `fn-tinyrdm` | `/var/lib/nginx/logs/error.log` | 镜像内路径需可写 |
| `fn-tomcat` | `/bitnami/tomcat/webapps` | 镜像内路径需可写 |
| `fn-xiaomusic` | `/app/xiaomusic.log.txt` | 镜像内路径需可写 |

`fn-node-red` 已按「不给 root、就用普通用户」的要求修复并真机复测通过（入口 `200`，
复核容器身份仍为包用户 `uid=869`，未提权）。

### 3.2 其它待查（22 个）

已取得容器状态，但根因尚未逐个确认到可整改的粒度。其中若干已能从日志看出方向：

| 应用 | 现象 |
| --- | --- |
| `fn-komari` | `failed to create theme directory: mkdir ./data/theme: permission denied` |
| `fn-gsmanager` | `EACCES: mkdir '/root/server/logs'` |
| `fn-jsonhero` | `Failed to write to output file: /app/public/build/... permission denied` |
| `fn-excalidraw` | 只读文件系统（`read-only file system?`） |
| `fn-localai` | 入口 `500`，服务已响应但内部报错 |
| `fn-nextcloud` | 入口 `400`，服务已响应但拒绝请求 |
| `fn-synapse` | `FileNotFoundError: '/data/homeserver.yaml'` |
| `fn-verdaccio` | `config file does not exist or is not writable` |
| `fn-sentinel-dashboard` | Java 侧 `NullPointerException`，容器 `Exited (1)` |
| `fn-moviepilot` / `fn-vane` / `fn-dashy` / `fn-phpmyadmin` | 安装任务直接失败（`status=3`）或未产出可用状态 |

> 注：`fn-komari`、`fn-gsmanager`、`fn-jsonhero`、`fn-excalidraw` 实际也属权限类，
> 分类表仅按「容器日志是否留下了可直接引用的 `EACCES` 字样」机械区分，整改时应一并归入。

### 3.3 环境依赖（22 个 BLOCKED）

20 个明确标记了外部依赖（数据库/中间件/消息队列），安装后等待外部服务超时；其余为镜像源不通、
端口被占用等。这些**不计入转换缺陷**，但在有对应中间件的环境里应重新验证。

### 3.4 向导必填（37 个 UNVERIFIED）

全部是**只有用户才知道的真实环境信息**，按规程不猜值：

| 类型 | 示例字段 | 应用 |
| --- | --- | --- |
| 对外访问地址 | `GHOST_URL`、`HALO_EXTERNAL_URL`、`SITE_URL` | `fn-ghost`、`fn-halo`、`fn-mattermost`、`fn-twenty`、`fn-flarum` |
| 域名 / 主机名 | `DISCOURSE_HOST`、`MAIL_DOMAIN`、`ZABBIX_SERVER` | `fn-discourse`、`fn-maddy-mail`、`fn-zabbix-proxy` |
| 邮箱 | `ADMIN_EMAIL`、`PGADMIN_DEFAULT_EMAIL`、`TYPECHO_USER_MAIL` | `fn-sub2api`、`fn-pgadmin4`、`fn-typecho` |
| 外部服务地址 | `IMAP_SERVER`、`KAFKA_HOST`、`OLLAMA_BASE_URL` | `fn-roundcube`、`fn-redpanda-console`、`fn-ollama-webui` |
| 本机路径 | `MODEL_PATH`、`MEDIA_PATH`、`CACHE_PATH` | `fn-llama-cpp`、`fn-jellyfin` |
| 公网 IP | `PUBLIC_IP`、`SCREEGO_EXTERNAL_IP` | `fn-palworld`、`fn-screego` |

这类应用**不能据此判定「转换有问题」**：它们缺的是环境输入，不是打包能力。需要时可用占位值模式
（`FNOS_FILL_PLACEHOLDERS=1`）补跑，但结果必须带 `placeholderFilled` 标记，不得与真实填写混为一谈。

## 4. 本轮已修复并复测通过的应用

| 应用 | 缺陷 | 修复 | 复测 |
| --- | --- | --- | --- |
| `fn-langflow` | `LANGFLOW_CONFIG_DIR=app/langflow` 是相对路径，被拼成 `/app/app` 后 `PermissionError` | 改绝对路径 `/app/langflow`；数据目录属主对齐镜像内 `uid=1000` | 权限已解，现仅缺外部 PostgreSQL，判 `BLOCKED` |
| `fn-lsky-pro` | entrypoint 要改写 `/etc/apache2/sites-enabled/`，非 root 即拒绝 | 该镜像必须 root 起，去掉 `user:` 覆盖 | `PASS`（`302`） |
| `fn-music-tag-web` | Django migrate 后创建 `/app/webdav` 失败 | 同上，去掉 `user:` 覆盖 | `PASS`（`200`） |
| `fn-manticoresearch` | 配置只监听 `9306`/`9312`，compose 映射的 `9308` 无监听者 | 补 `listen = 9308:http` | `PASS`（`200`） |
| `fn-mkdocs-material` | 启动即要求 `/docs/mkdocs.yml`，数据目录为空 | 随包提供最小站点种子，仅在缺失时铺入 | `PASS`（`200`） |
| `fn-node-red` | `/data` 归 root，包用户复制 `settings.js` 时 `EACCES` | 回调以包用户预建目录并自检可写（**不提权**） | `PASS`（`200`），容器身份仍 `uid=869` |

## 5. 判定口径的两处修正

跑批量过程中发现两类**把成功判成失败**的逻辑错误，已修正：

1. **原生应用不常驻 `running`**。没有对外服务端口的应用（纯命令行工具类）装完状态是 `nostart`，
   原先会等满 90 次再判 `FAIL`。现在把 `nostart` 当终态接受，可用性交由安装结果判断。
2. **等待 `running` 超时但应用已在列表里**。原先直接抛异常记 `FAIL`，现在交给入口探测判定，
   并记录 `statusTimeout` 以便追溯。

修正前后同一批应用的重测结果印证了这两点：`fn-ohmyzsh`、`fn-uv`、`fn-memcached`、`fn-teamspeak`
等原生应用由 `FAIL` 转为 `PASS`。

## 6. 遗留风险

| 编号 | 风险 | 说明 |
| --- | --- | --- |
| R-01 | 37 个 `UNVERIFIED` 未作可用性结论 | 缺用户环境输入，非转换缺陷；需在具备对应环境的设备上复验 |
| R-02 | 22 个 `BLOCKED` 依赖外部中间件 | 同上，环境齐备时应重跑 |
| R-03 | 22 个「其它待查」根因未逐项确认 | 已留容器日志，整改前需逐个读日志定因 |
| R-04 | 数据目录残留清理需提权 | 卸载回调无权删除平台管理的父目录项，残留目录需有权限账号处理 |
| R-05 | 未覆盖升级/降级路径 | 本轮只验证「首次安装→启动→卸载」，升级未测 |

## 7. 设备清理

每轮结束均核对：容器数归零、`<app>_default` 网络归零、暂存 `.fpk` 清空、应用中心无残留条目。
本轮结束时设备仅保留用户自有应用，测试应用全部卸载。
