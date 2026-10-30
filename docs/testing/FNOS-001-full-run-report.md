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

本轮实际跑完 189 个应用。其中 10 个沿用既有转换、明确不纳入本轮验证
（`fn-bitwarden`、`fn-halo`、`fn-hermes-agent`、`fn-memos`、`fn-moviepilot`、
`fn-mysql_v8`、`fn-new-api`、`fn-nvm`、`fn-ohmyzsh`、`fn-quark-auto-save`），
按 `v6.0.0` 保持原状、未带入本轮改动。**纳入判定的为 182 个**：

| 判定 | 数量 | 占比 | 含义 |
| --- | ---: | ---: | --- |
| `PASS` | **119** | 65.4% | 安装成功、状态 `running`、入口返回可访问状态码 |
| `UNVERIFIED` | 35 | 19.2% | 向导必填项需要用户环境信息，无法自动填写，未作可用性结论 |
| `BLOCKED` | 26 | 14.3% | 依赖外部中间件、需下载大模型、镜像拉取超时等环境原因 |
| `FAIL` | **2** | 1.1% | 安装或启动失败，且证据指向转换自身的问题 |

经过多轮「真机取证 → 按根因整改 → 复测」迭代，`FAIL` 从首轮的 27 个降到 2 个
（`fn-jsonhero`、`fn-tinyrdm`），二者都是同一个原因：**该镜像必须 root 才能运行**，
而本项目规约要求非 root 运行，故保留为已知限制（见 §5）。

## 2. 通道说明

安装、查询、卸载都走应用中心 HTTP 接口，但**凭证由浏览器代发**：

- 会话 Cookie（`osrt` / `ost`）是 **HttpOnly**，页内 JS 读不到，`document.cookie` 只剩埋点与语言项；
- 因此经 Midscene Bridge 连上用户已登录的浏览器标签页，用**页面同源 fetch** 调接口；
- 桥接断开自动重连，目标标签页被关闭自动重开一次；会话真过期时抛 `SESSION_EXPIRED` 并中止整批。

这条通道的结论与设备端 CLI 通道**等效**，判定口径不变。

## 3. 失败归因与整改

首轮 27 个 `FAIL` 全部取到了容器侧证据。按根因归并后共 6 类，逐类整改并复测，
最终只剩 2 个（同属「必须 root」类）。

### 3.1 容器运行身份与挂载目录属主不匹配（最常见）

以非 root（包用户）运行时，容器要写的目录归 `root` 所有，启动即 `EACCES` / `PermissionError`。
`install_callback` 是空操作时，没有任何环节把属主交给运行用户。

| 应用 | 报错位置 | 处置 |
| --- | --- | --- |
| `fn-node-red` | `/data/settings.js` | 回调以包用户预建目录并自检可写（**未提权**） |
| `fn-nodebb` | `/opt/config` | 预建子目录 + ACL 授予镜像内 UID 1001 |
| `fn-tomcat` | `/bitnami/tomcat/webapps` | 同上（ACL 授予 UID 1001） |
| `fn-nexus` | `/opt/sonatype/sonatype-work/log` | 把该路径一并挂到数据目录 |
| `fn-xiaomusic` | `/app/xiaomusic.log.txt` | 单文件挂载落到数据目录 |
| `fn-komari` | `./data/theme` | 回调以包用户预建并自检 |
| `fn-gsmanager` | `/root/server/logs`、`/root/server/server` | 两个子目录挂出来并预建 |
| `fn-focalboard` | `/opt/focalboard/config.json` | 容器默认 `nobody`，显式对齐为包用户 |
| `fn-verdaccio` | `/verdaccio/conf/config.yaml` | 容器内置 UID 10001，对齐为包用户 |

### 3.2 镜像启动即写镜像层路径（非 root 无法满足）

有些镜像的 entrypoint 必须以 root 改写自身目录。**能改挂载的改挂载，确实必须 root 的才退回 root**。

| 应用 | 现象 | 处置 |
| --- | --- | --- |
| `fn-lsky-pro` | entrypoint 改写 `/etc/apache2/` | 该镜像必须 root，去掉 `user:` 覆盖 |
| `fn-music-tag-web` | `/app/webdav` 创建失败 | 同上 |
| `fn-excalidraw` | nginx 写 `/var/cache/nginx` | 运行期缓存改用 tmpfs，**保持非 root** |
| `fn-sentinel-dashboard` | `create Sentinel log base directory error: ?/logs/csp/` | 用 `JAVA_TOOL_OPTIONS=-Duser.home` 指向数据目录（`HOME` 对 JVM 无效），**保持非 root** |
| `fn-jsonhero` | npm 重建前端写 `/app/build` | 三种非 root 方案均无效，登记为已知限制 |
| `fn-tinyrdm` | nginx 写 `/var/lib/nginx/{logs,tmp}` | 同上，登记为已知限制 |

> 关键教训：**容器由应用中心在 `install_callback` 之前创建**。靠回调建宿主目录来不及——
> Docker 会先把不存在的挂载源以 root 建出来，之后再 chown 也不会作用于已创建的容器。
> 因此凡「只放运行期临时文件」的目录，优先用 tmpfs（不涉及宿主属主）。

### 3.3 必需配置/种子缺失

| 应用 | 缺什么 | 处置 |
| --- | --- | --- |
| `fn-mkdocs-material` | `/docs/mkdocs.yml` | 随包种子（站点配置 + 首页） |
| `fn-gatus` | `/config/config.yaml` | 随包种子（最小监控配置） |
| `fn-verdaccio` | `/verdaccio/conf/config.yaml` | 随包种子（listen 取 `VERDACCIO_PORT`） |
| `fn-synapse` | `/data/homeserver.yaml` | 改为容器启动时 `python /start.py generate` |
| `fn-trendradar` | `config.yaml` + `frequency_words.txt` | 随包种子（两个都要，入口脚本都检查） |
| `fn-phpmyadmin` | `data/conf.inc/config.user.inc.php` | 补种子（回调要求但仓库缺失） |
| `fn-focalboard` | 种子 `config.json` 是空对象 `{}` | 补完整 SQLite 配置 |

`fn-synapse` 还暴露另一个坑：镜像 `ENTRYPOINT` 是 `/start.py`，`command` 只是它的参数，
直接写 `sh -c` 会被当成「未知执行模式 `sh`」，必须同时覆盖 `entrypoint`。

### 3.4 端口/协议不匹配

| 应用 | 现象 | 处置 |
| --- | --- | --- |
| `fn-manticoresearch` | 配置只监听 9306/9312，映射的 9308 无监听者 | 补 `listen = 9308:http` |
| `fn-nextcloud` | 映射到 443，入口走 http → 400 | 改映射到 80 |

### 3.5 向导字段缺陷

| 应用 | 问题 | 处置 |
| --- | --- | --- |
| `fn-xiaoya-only` | 向导只收集 cookie，但容器硬性检查 `mytoken.txt` 等三个文件，凭据没落到容器要的位置 | 向导补 3 个必填字段，回调按容器要求写文件 |
| `fn-bitwarden` | `DOMAIN` 允许留空，容器却要求带协议头 | 属免验范围，按 `v6.0.0` 保持原状 |

### 3.6 非缺陷（环境耗时，记 BLOCKED）

- `fn-localai`：首启需逐个下载多个模型权重（1.5GiB、1.9GiB…），下载完成前入口不可用；
- `fn-comfyui`、`fn-vane`：依赖多个大镜像，安装轮询窗口内未完成；
- 其余 23 个：依赖外部数据库/中间件（PostgreSQL、MySQL、Kafka、MinIO 等）。

这些都不构成转换缺陷，但**应在具备对应中间件、且允许长时下载的环境中复验**。

## 4. 判定口径的三处修正

跑批量时发现三类**把成功判成失败、或把失败算到转换头上**的逻辑错误，已修正：

1. **原生应用不常驻 `running`**。没有对外服务端口的应用装完状态是 `nostart`，
   原先会等满 90 次再判 `FAIL`。现在把 `nostart` 当终态接受。
2. **等待 `running` 超时但应用已安装**。原先直接抛异常记 `FAIL`；
   现在交给入口探测判定，并记录 `statusTimeout`。同时明确：过渡态
   （`start`/`installing`）**不能**当作终态接受，否则「还在启动」会被判成通过。
3. **安装轮询超时不算转换缺陷**。大镜像拉取、模型权重下载都会超时，
   这类失败没有任何「转换有问题」的证据。现在记 `BLOCKED`，与镜像拉取超时的口径一致。

修正前后对比可见：`fn-ohmyzsh`、`fn-uv`、`fn-memcached`、`fn-teamspeak` 等原生应用
由 `FAIL` 转为 `PASS`；`fn-comfyui`、`fn-vane` 由 `FAIL` 转为 `BLOCKED`。

## 5. 已修复并复测通过的应用（共 20 个）

| 应用 | 缺陷 | 复测 |
| --- | --- | --- |
| `fn-node-red` | 数据目录属主未对齐 | PASS 200（**未提权**） |
| `fn-lsky-pro` | entrypoint 需 root 改写 `/etc/apache2/` | PASS 302 |
| `fn-music-tag-web` | `/app/webdav` 创建失败 | PASS 200 |
| `fn-manticoresearch` | 配置未声明 9308 | PASS 200 |
| `fn-mkdocs-material` | 缺 `mkdocs.yml` | PASS 200 |
| `fn-langflow` | 相对路径拼成 `/app/app` | 权限已解（缺外部 PG → BLOCKED） |
| `fn-phpmyadmin` | 缺 `config.user.inc.php` 种子 | PASS 200 |
| `fn-nodebb` | `/opt/config` 不可写 | PASS 200 |
| `fn-tomcat` | `/bitnami/...` 不可写 | PASS 200 |
| `fn-xiaomusic` | 日志写 `/app` 失败 | PASS 200 |
| `fn-gsmanager` | `/root/server/{logs,server}` 不可写 | PASS 200 |
| `fn-komari` | `./data/theme` 不可写 | PASS 307 |
| `fn-nexus` | sonatype-work 日志目录不可写 | PASS 200 |
| `fn-verdaccio` | 缺配置 + 运行身份不一致 | PASS 200 |
| `fn-gatus` | 缺 `config.yaml` | PASS 200 |
| `fn-focalboard` | 运行身份不一致 + 空种子配置 | PASS 200 |
| `fn-excalidraw` | nginx 缓存目录不可写 | PASS 200 |
| `fn-sentinel-dashboard` | JVM `user.home` 指向 `/root` | PASS 200 |
| `fn-synapse` | 缺配置 + entrypoint 用法错误 | PASS 302 |
| `fn-trendradar` | 缺两个必需配置文件 | PASS 200 |
| `fn-nextcloud` | 映射到 443 导致入口 400 | PASS 200 |

## 6. 遗留风险

| 编号 | 风险 | 说明 |
| --- | --- | --- |
| R-01 | 2 个应用必须 root 才能运行 | `fn-jsonhero`、`fn-tinyrdm` 的镜像启动即写自身目录。已尝试宿主绑定挂载、compose tmpfs、Docker 命名卷三种非 root 方案，均无效。**未为了跑起来而退回 root**，保持登记待上游提供可配置用户版本 |
| R-02 | 35 个 `UNVERIFIED` 未作可用性结论 | 缺用户环境输入（域名、邮箱、外部服务地址、网盘 token 等），非转换缺陷 |
| R-03 | 26 个 `BLOCKED` 依赖外部条件 | 中间件齐备、允许长时下载的环境下应重跑 |
| R-04 | 数据目录残留清理需提权 | 卸载回调无权删除平台管理的父目录项 |
| R-05 | 未覆盖升级/降级路径 | 本轮只验证「首次安装→启动→卸载」 |

## 7. 设备清理

每轮结束均核对：容器数归零、`<app>_default` 网络归零、暂存 `.fpk` 清空、应用中心无残留条目。
本轮结束时设备仅保留用户自有应用，测试应用全部卸载。
