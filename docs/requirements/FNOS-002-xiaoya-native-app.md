---
title: FNOS-002 小雅 Alist 飞牛原生应用
description: 把 all_in_one.sh 的交互式终端脚本重构为前后端分离的飞牛原生应用 fn-xiaoya-native，以非 root 方式管理小雅 Alist 与周边服务。
id: FNOS-002
status: 规划中
owner: tnnevol
targetVersion: v7.x
lastVerified: 2026-11-17
---

# FNOS-002 小雅 Alist 飞牛原生应用

| 字段 | 值 |
| --- | --- |
| 需求编号 | FNOS-002 |
| 提出日期 | 2026-11-17 |
| 需求状态 | <Badge type="warning" text="规划中" /> |
| 关联计划 | [PLAN-FNOS-002 小雅原生应用实施计划](/plans/PLAN-FNOS-002-xiaoya-native-app) |

## 需求背景与目标

小雅 Alist 的官方安装入口是 `all_in_one.sh`（上游 `xiaoyaDev/xiaoya-alist`，脚本版本 `v1.8.4-2025_06_14_19_04`，6567 行）。它是一个**交互式终端菜单脚本**：全部用户操作通过 `read`、数字菜单、隐藏密码输入和「按任意键继续」完成，并要求以 root 身份运行。

在飞牛 fnOS 上直接使用该脚本存在四类不可接受的问题：

1. **交互模型不匹配**：fnOS 应用的生命周期回调（`install_callback`、`cmd/main` 等）不允许阻塞在 `read` 上。脚本的终端菜单无法放进任何生命周期阶段。
2. **权限模型不匹配**：脚本要求 root，并修改宿主机全局状态 —— `/etc/profile`（追加 `alias xiaoya` 且每次执行都从远端下载脚本）、`/etc/hosts`（写入 `xiaoya.host`）、`/etc/sysctl.conf`（写 inotify 参数后 `sysctl -p`）、root crontab，以及对配置与媒体目录大量 `chmod 777`。这绕过了 fnOS 的应用用户隔离与生命周期管理。
3. **供应链不可复现**：脚本运行时 `source` 多个远端基础脚本（`base.sh`、`image_mirror.sh` 等），部分下载使用 `curl -sLk`（关闭 TLS 校验），并用 `eval` 拼接 Docker 命令。同一命令在不同时间可能执行不同内容。
4. **无状态可见性**：所有配置散落在终端进程内的变量和若干 `.txt` 文件中，没有可查询的服务状态、任务进度或错误归因，用户只能回到终端重新跑一遍菜单。

本需求的目标是把 `all_in_one.sh` 的**业务能力**（账号授权、小雅容器生命周期、元数据下载解压、周边服务）搬进一个前后端分离的 fnOS 原生应用 `fn-xiaoya-native`：
前端是一套基于成熟 Vue3 后台脚手架的管理面板，后端是一个以**非 root 包用户**运行、只操作本应用自有资源的服务。

**还原边界**（本需求最重要的约束）：

- 不使用 root。应用以 fnOS 包用户运行；仅当需要管理 Docker 时通过 `join-groups: ["docker"]` 取得 Docker 组权限，并且后端只暴露固定的操作白名单。
- 只有 `xiaoya-alist` 本体使用 Docker 镜像；其余 auth、元数据下载解压、助手等能力由本应用后端**原生实现**，不再套一堆伴随容器。
- 不复用 `all_in_one` 的任何 Docker 镜像作为面板载体（即不把面板打包成容器镜像分发）。
- 不继承脚本的全局系统副作用：不写 `/etc/profile`、`/etc/hosts`、`/etc/sysctl.conf`、root crontab，不使用 `chmod 777`，不使用 `curl -k`，不 `eval` 拼接命令。
- 开发环境不依赖飞牛私有 API，本地可独立完成 UI 与功能开发；生产阶段通过飞牛统一网关接入。

## 需求目标

1. 用户能在 fnOS 桌面打开应用面板，完成小雅 Alist 的首次配置、启动、停止、更新与卸载，全程不需要终端。
2. 账号授权（阿里云盘 Token、115/夸克/UC Cookie）能在面板中通过扫码或粘贴完成，并落盘为小雅可识别的配置文件。
3. 元数据（`all.mp4`、`115.mp4`、`config.mp4` 等）能通过面板下载、校验、解压到受控目录，并有可观察的任务进度与日志。
4. 应用以非 root 包用户运行；面板任何操作都不能让后端执行前端传入的任意命令或任意路径。
5. 后端在开发环境可脱离飞牛 API 独立启动与调试；生产环境通过统一网关暴露，并基于网关转发的用户 Header 做鉴权。
6. 卸载时用户可以选择保留或删除数据，且只删除应用自己创建的目录。

## 涉及范围

| 对象 | 位置 | 职责 |
| --- | --- | --- |
| 上游脚本（只读参考） | `tmp/fn-xiaoya-native/refs/xiaoya-alist/all_in_one.sh` | 业务能力与配置文件的唯一事实来源；不复制文件内容，不向上游提交补丁 |
| 授权流程参考（只读参考） | `tmp/fn-xiaoya-native/refs/OpenList-OnlineAPI/` | 扫码/OAuth 授权端点与流程参考，用本应用后端重写 |
| 前端脚手架（只读参考） | `tmp/fn-xiaoya-native/refs/art-design-pro/` | Vue3 + Vite + TypeScript + Element Plus 后台模板，MIT 许可 |
| 目标应用 | `apps/fn-xiaoya-native/` | FPK 目录、生命周期脚本、网关入口、向导 |
| 后端服务 | `apps/fn-xiaoya-native/app/server/` | 非 root 后端：配置、容器、任务、鉴权 |
| 前端面板 | `apps/fn-xiaoya-native/app/web/`（构建产物 `app/ui/dist/`） | 管理面板静态资源 |
| 需求与计划 | `docs/requirements/`、`docs/plans/` | 范围、优先级、验收条件与实施计划 |

`tmp/` 下的参考项目**禁止入库**（仓库 `.gitignore` 已忽略 `tmp/`）。上游 `all_in_one.sh` 为 GPL-3.0，本仓库为 Apache-2.0：只复现业务行为与配置文件契约，不复制上游脚本代码。

## 功能列表

| 编号 | 优先级 | 功能 | 用户行为 | 状态 |
| --- | --- | --- | --- | --- |
| FNOS-002-01 | P0 | 非 root 运行基线 | 应用以包用户启动；需要 Docker 时加入 `docker` 组并只执行固定 Compose 操作 | <Badge type="warning" text="规划中" /> |
| FNOS-002-02 | P0 | 前后端分离骨架与网关入口 | 开发环境前后端独立启动；生产环境通过 `/app/fn-xiaoya-native` 统一网关访问 | <Badge type="warning" text="规划中" /> |
| FNOS-002-03 | P0 | 小雅 Alist 容器生命周期 | 面板可启动、停止、重启、更新小雅容器并看到容器状态与日志尾部 | <Badge type="warning" text="规划中" /> |
| FNOS-002-04 | P0 | 账号授权（阿里云盘 Token） | 用户扫码或粘贴获取 Refresh/Open Token，面板显示校验结果 | <Badge type="warning" text="规划中" /> |
| FNOS-002-05 | P0 | 网盘 Cookie 与转存配置 | 用户配置 115/夸克/UC Cookie、115 回收站密码、转存目录、强制登录密码 | <Badge type="warning" text="规划中" /> |
| FNOS-002-06 | P1 | 元数据下载与解压任务 | 用户在面板对元数据包执行下载、解压、下载并解压、指定目录解压，并查看进度与日志 | <Badge type="warning" text="规划中" /> |
| FNOS-002-07 | P1 | 服务连通性与磁盘检查 | 面板显示小雅连通性、下载地址签名可用性、目标目录容量 | <Badge type="warning" text="规划中" /> |
| FNOS-002-08 | P1 | 周边服务开关 | 用户可按需启用/停用 TVBox、115 Cleaner、Proxy、助手等伴随能力 | <Badge type="warning" text="规划中" /> |
| FNOS-002-09 | P2 | 定时任务 | 用户在面板配置定时重启、定时元数据更新 | <Badge type="warning" text="规划中" /> |
| FNOS-002-10 | P2 | Emby/Jellyfin 联动 | 面板切换 Emby 镜像版本、修复 `xiaoya.host` 解析 | <Badge type="warning" text="规划中" /> |

## 交互和行为约束

### 权限与身份

- `config/privilege` 使用 `run-as=package`；包用户为 `fn-xiaoya-native`。
- 需要 Docker 时使用 `join-groups: ["docker"]`。目标设备必须存在 `docker` 组；缺失时安装阶段明确失败并提示，不静默回退 root。
- Docker 组接近 root 权限，因此后端必须执行白名单：只允许 `compose up/down/restart/pull/config` 与 `ps/logs/inspect`，并且项目名、容器名、镜像名来自应用配置而非请求参数。
- 面板不接受任意 Shell、任意 Docker 命令、任意宿主机路径。

### 路径与数据

- 配置、媒体、临时目录全部落在应用自己的目录：`TRIM_PKGVAR`、`TRIM_APPDEST_VOL/@appshare/fn-xiaoya-native/`，或 `config/resource` 声明的 `data-share` 子目录。
- 不探测 `/vol1/1000`、不使用 `/etc/xiaoya`、不使用 `/opt/media` 作为回退。
- 不写 `/etc` 下任何文件；主机名解析通过容器网络与服务名完成，不改 `/etc/hosts`。
- 不使用 `chmod 777`；敏感文件（Token、Cookie、密码）以 `600` 保存，且不写入日志。

### 授权

- 阿里云盘扫码、115 扫码等能力由本应用后端直接实现（参考 OpenList-OnlineAPI 的端点与流程），不依赖第三方公共服务。
- 授权结果校验后才写入小雅配置文件；失败的授权不覆盖原有可用配置。
- 面板不回显完整 Token/Cookie，只显示掩码与更新时间。

### 开发与生产环境

- 开发环境：前端 `vite dev` 通过代理访问本地后端；后端通过环境变量指定数据目录，不读取 `TRIM_*` 缺失即崩溃。
- 生产环境：后端监听 `${TRIM_APPDEST}/app.sock` Unix Socket，网关 `gatewayPrefix=/app/fn-xiaoya-native`。
- 鉴权：生产环境从 `X-Trim-Userid`、`X-Trim-Isadmin`、`X-Trim-Username` 读取用户上下文；开发环境使用本地开发身份，两者不得混用。

## 不在本次范围内

- 不迁移脚本的终端菜单、二维码终端渲染、`read` 交互。
- 不实现 `/etc/profile` alias、`/etc/hosts` 写入、`/etc/sysctl.conf` inotify 调整、root crontab、`CasaOS`/`Portainer`/`Auto_Symlink`/`Onelist` 等第三方面板捆绑。
- 不复制上游 GPL-3.0 脚本代码；不复用 `all_in_one` 的伴随容器镜像。
- 不承诺 macOS 分支能力；脚本的 macOS 分支不作为还原目标。
- 不在首次实现中提供多用户隔离的内存/磁盘配额。

## 验收条件与完成状态

| 编号 | 优先级 | 验收条件 |
| --- | --- | --- |
| FNOS-002-AC-01 | P0 | `config/privilege` 为 `run-as=package`；真实设备上应用进程 UID 非 0；`docker` 组缺失时安装给出可执行错误提示 |
| FNOS-002-AC-02 | P0 | 开发环境 `pnpm dev`（前端）与后端独立启动可完成登录与主要页面浏览，全程不调用飞牛私有 API |
| FNOS-002-AC-03 | P0 | 生产环境通过 `/app/fn-xiaoya-native` 可打开面板；未登录请求被网关拦截；面板能读到 `X-Trim-Username` |
| FNOS-002-AC-04 | P0 | 面板可启动/停止/重启小雅容器，状态与 `docker ps` 一致；容器名与项目名来自应用配置 |
| FNOS-002-AC-05 | P0 | 面板可完成阿里云盘 Token 授权并落盘；Token 掩码显示；授权失败不覆盖已有配置 |
| FNOS-002-AC-06 | P0 | 后端拒绝任何非白名单 Docker 操作与非应用目录路径；构造恶意请求不产生副作用 |
| FNOS-002-AC-07 | P1 | 元数据任务可下载并校验大小，进度与阶段在面板可见；失败有原因与建议，不留下可误解压的半成品 |
| FNOS-002-AC-08 | P1 | 磁盘空间不足与连通性失败在面板有明确提示，且不创建任务 |
| FNOS-002-AC-09 | P1 | 卸载向导可选择保留/删除数据；删除不会触及用户原始媒体目录与框架目录 |
| FNOS-002-AC-10 | P2 | 定时任务与应用自有调度生效，不使用系统 crontab |

状态看板：

| 阶段 | 状态 | 下一步 |
| --- | --- | --- |
| 需求与计划落库 | <Badge type="warning" text="进行中" /> | 完成 PLAN-FNOS-002 阶段划分 |
| 应用骨架与权限基线 | <Badge type="warning" text="规划中" /> | 建立 `apps/fn-xiaoya-native` 基础结构与 `config/privilege` |
| 后端核心能力 | <Badge type="warning" text="规划中" /> | 配置、容器、任务、鉴权四类接口 |
| 前端管理面板 | <Badge type="warning" text="规划中" /> | 选定脚手架并接入接口 |
| 本地联调与打包 | <Badge type="warning" text="规划中" /> | 本地跑通并 `fnpack build` |
| 真实 NAS 验收 | <Badge type="warning" text="待确认" /> | 需要目标设备与 Docker 组环境 |

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-11-17 | 建立需求文档：确认非 root 边界、仅小雅本体使用 Docker、开发环境不依赖飞牛 API、生产接入统一网关 |
