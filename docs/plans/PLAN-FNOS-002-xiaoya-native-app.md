---
title: PLAN-FNOS-002 小雅原生应用实施计划
description: 把 all_in_one.sh 的业务能力重构为前后端分离的 fnOS 原生应用 fn-xiaoya-native 的实现、验证与发布计划。
id: PLAN-FNOS-002
status: 规划中
owner: tnnevol
targetVersion: v7.x
lastVerified: 2026-11-17
---

# PLAN-FNOS-002 小雅原生应用实施计划

| 字段 | 值 |
| --- | --- |
| 计划编号 | PLAN-FNOS-002 |
| 计划日期 | 2026-11-17 |
| 对应需求 | [FNOS-002 小雅 Alist 飞牛原生应用](/requirements/FNOS-002-xiaoya-native-app) |
| 计划状态 | 分阶段实施 |

## 计划目标

把上游 `all_in_one.sh`（`v1.8.4-2025_06_14_19_04`）的**业务能力**重构为 fnOS 原生应用 `fn-xiaoya-native`：后端以非 root 包用户运行，提供受控的业务接口；前端是一套基于成熟 Vue3 后台脚手架的管理面板。

技术边界：

- 不使用 root。仅通过 `join-groups: ["docker"]` 取得受控 Docker 能力，并且只执行固定 Compose 操作。
- 只有 `xiaoya-alist` 使用 Docker 镜像；账号授权、元数据下载解压、定时任务、周边能力由本应用后端原生实现。
- 不复制上游脚本代码（GPL-3.0），只复现行为与配置文件契约；本仓库为 Apache-2.0。
- 开发环境不依赖飞牛私有 API；生产环境通过统一网关接入。
- 明确不修改的范围：`tmp/` 下的参考仓库、上游项目、以及仓库内其它应用的实现。

## 实现范围和边界

| 模块 | 计划入口 | 实现责任 |
| --- | --- | --- |
| 应用/FPK | `apps/fn-xiaoya-native/` | `manifest`、`cmd/` 生命周期、`config/`、`wizard/` |
| 后端服务 | `apps/fn-xiaoya-native/app/server/` | 无构建步骤的 ESM 源码：HTTP 服务、配置读写、Docker 白名单、任务队列、授权流程 |
| 前端面板 | `apps/fn-xiaoya-native/web/` | Vue3 + Vite + TS 源码；构建产物合入 `app/ui/dist/` |
| 入口配置 | `app/ui/config` | 开发用端口入口、生产用网关入口 |
| 测试用例 | `docs/testing/FNOS-002-test-cases.md` | 按功能 ID 的可复现用例 |
| 验收 | `docs/validation/` | 真实 NAS 安装、启停、升级和卸载证据 |

打包约束（实测 `fnpack` 1.2.3）：

- `.fpk` 只收录 `manifest`、`cmd/`、`config/`、`wizard/`、`ICON*.PNG`，以及 `app/` 目录的内容压缩成 `app.tgz`。
- 仓库根的文件（`package.json`、`README.md`、`node_modules/`）与 `app/` 之外的源码目录**不会**进入 `app.tgz`。
- 因此后端直接以 ESM 写在 `app/server/`（不需要构建与依赖安装）；前端源码放在 `web/`，构建产物落到 `app/ui/dist/`。
- 后端只使用 Node 标准库，避免在目标设备上安装 npm 依赖。

## 目标架构和数据流

```text
开发环境
  web/  (vite dev, 端口 5273)  ── 代理 /api ──►  server (127.0.0.1:5274)
                                                   │
                                                   └─ XIAOYA_DATA_DIR 指向本地目录

生产环境
  浏览器 ──► fnOS 统一网关 /app/fn-xiaoya-native ──► app.sock
                                                       │
                                              app/server (包用户 fn-xiaoya-native)
                                                       ├─ docker 组：compose 白名单
                                                       ├─ TRIM_PKGVAR：配置与任务状态
                                                       └─ data-share：媒体与元数据
```

后端分层：

```text
app/server/
├─ index.mjs           入口：读环境，决定监听 Unix Socket 还是 TCP
├─ http.mjs            路由与中间件（无框架，node:http）
├─ auth.mjs            网关 Header / 开发身份 解析与鉴权
├─ config/             配置读写（小雅配置文件契约）
├─ docker.mjs          docker compose 白名单封装
├─ tasks/              任务队列、进度、日志
├─ authflow/           阿里云盘 / 115 / 夸克 / UC 授权
└─ static.mjs          面板静态资源
```

## 配置契约（对齐小雅容器实际读取的文件）

小雅容器把宿主配置目录挂到容器 `/data`，读取以下文件。本应用把该目录固定为 `${TRIM_PKGVAR}/config`（开发环境 `XIAOYA_DATA_DIR/config`），并保证文件权限 `600`：

| 文件 | 含义 | 来源 |
| --- | --- | --- |
| `mytoken.txt` | 阿里云盘 Refresh Token | 面板授权或粘贴 |
| `myopentoken.txt` | 阿里云盘 Open Token | 面板授权或粘贴 |
| `temp_transfer_folder_id.txt` | 转存目录 folder id（40 位） | 面板授权自动获取或粘贴 |
| `115_cookie.txt` | 115 Cookie | 面板扫码或粘贴 |
| `quark_cookie.txt` | 夸克 Cookie | 面板粘贴 |
| `uc_cookie.txt` | UC Cookie | 面板粘贴 |
| `guestpass.txt` / `guestlogin.txt` | 强制登录密码与开关 | 面板设置 |
| `115_key.txt` | 115 回收站密码 | 面板设置 |
| `docker_address.txt` | 小雅对外访问地址 | 后端按实际端口生成 |
| `115share_list.txt` / `quarkshare_list.txt` | 官方分享列表 | 面板一键写入（内容随包内置常量） |

写入采用「临时文件 + 原子改名」，并对每个字段做格式校验；校验失败不覆盖旧值。

## 阶段与任务

| 编号 | 阶段 | 任务 | 验收关联 |
| --- | --- | --- | --- |
| PLAN-FNOS-002-T1 | 骨架 | 应用目录、`manifest`、`config/privilege`（package + docker 组）、`config/resource`、生命周期脚本占位 | FNOS-002-AC-01 |
| PLAN-FNOS-002-T2 | 后端基线 | 无框架 HTTP 服务、环境适配（Socket/TCP）、静态资源、健康检查 | FNOS-002-AC-02 |
| PLAN-FNOS-002-T3 | 配置中心 | 配置读写契约、字段校验、掩码返回、原子落盘 | FNOS-002-AC-05 |
| PLAN-FNOS-002-T4 | Docker 白名单 | compose 模板生成、`up/down/restart/pull/config/ps/logs` 封装、状态聚合 | FNOS-002-AC-04、AC-06 |
| PLAN-FNOS-002-T5 | 授权链路 | 阿里云盘扫码/Token 校验、115 扫码，失败不覆盖 | FNOS-002-AC-05 |
| PLAN-FNOS-002-T6 | 任务系统 | 单任务串行队列、进度阶段、日志环形缓冲、取消、崩溃恢复 | FNOS-002-AC-07 |
| PLAN-FNOS-002-T7 | 元数据 | 下载（aria2 或内置 HTTP + Range）、大小校验、7z 解压、目录选择 | FNOS-002-AC-07、AC-08 |
| PLAN-FNOS-002-T8 | 卫生检查 | 连通性、签名、磁盘容量、端口占用 | FNOS-002-AC-08 |
| PLAN-FNOS-002-T9 | 前端面板 | 脚手架接入、API 层、概览/账号/元数据/服务/设置页 | FNOS-002-AC-02、AC-03 |
| PLAN-FNOS-002-T10 | 生命周期 | 安装、配置、升级、启停、状态、卸载回调与向导 | FNOS-002-AC-01、AC-09 |
| PLAN-FNOS-002-T11 | 交付验证 | 本地联调、单元测试、`fnpack build`、文档与验收记录 | 全部 |

## 交互与接口约定

后端接口统一前缀 `/api`，返回 `{ code, message, data }`。错误必须包含「原因 + 处理建议」。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/system/health` | 版本、运行身份、Docker 可用性 |
| GET | `/api/system/context` | 当前用户与运行环境（网关/开发） |
| GET | `/api/config` | 读取配置（敏感字段掩码） |
| PUT | `/api/config` | 写入配置（分字段校验） |
| GET | `/api/alist/status` | 容器状态、健康、端口、资源占用 |
| POST | `/api/alist/action` | `start` / `stop` / `restart` / `update`（枚举，不接受命令） |
| GET | `/api/alist/logs` | 容器日志尾部 |
| POST | `/api/auth/alipan/qrcode` | 生成二维码 |
| GET | `/api/auth/alipan/qrcode/:id` | 轮询扫码状态 |
| POST | `/api/auth/alipan/manual` | 粘贴 Token 并校验 |
| POST | `/api/auth/115/qrcode` | 生成 115 二维码 |
| GET | `/api/auth/115/qrcode/:id` | 轮询 115 扫码状态 |
| GET | `/api/metadata/packages` | 元数据包状态 |
| POST | `/api/metadata/tasks` | 创建下载/解压/组合任务 |
| GET | `/api/metadata/tasks` | 任务列表 |
| GET | `/api/metadata/tasks/:id` | 任务详情与进度 |
| GET | `/api/metadata/tasks/:id/logs` | 增量日志 |
| POST | `/api/metadata/tasks/:id/cancel` | 取消 |
| GET | `/api/system/capacity` | 目录容量与预计需求 |

安全规则：

- 所有写接口要求管理员身份（生产环境读 `X-Trim-Isadmin`；开发环境用本地开发身份）。
- 路径参数只允许枚举或相对应用目录；后端对最终路径做 `realpath` 校验，拒绝越界。
- Docker 操作只接受上表枚举；不允许请求体携带镜像、命令、卷、网络。
- 敏感字段永不进入日志与错误消息。

## 前端方案

- 脚手架：`art-design-pro`（Vue3 + Vite + TypeScript + Element Plus + Tailwind，MIT）。选择理由：主动做了视觉设计与主题系统，圆角与层次接近毛玻璃观感；相比 `soybean-admin`（Naive UI，无模糊/透明支持）与 `vue-pure-admin`（工程导向、视觉朴素），更符合「毛玻璃风格、直接用不自造」的要求。
- 复用：布局、菜单、面包屑、主题切换、登录页、表格与表单封装、HTTP 封装。
- 替换：`VITE_API_PROXY_URL` 指向本地后端；移除 Apifox mock 依赖；按小雅功能重写路由与页面。
- 毛玻璃呈现：在脚手架已有的圆角/主题变量基础上启用 `backdrop-filter` 卡片与侧边栏（脚手架自带 `backdropBlur()` mixin），不重写设计系统。

## 测试与验证

| 层级 | 方式 |
| --- | --- |
| 后端单元 | Node 内置测试运行器覆盖配置校验、路径越界、Docker 白名单、任务状态机 |
| 接口契约 | 本地启动后端，用脚本跑主要接口的成功与失败分支 |
| 前端 | `vue-tsc` 类型检查与 `vite build` 产物验证；关键页面本地手动走查 |
| 打包 | `fnpack build` 产出 `.fpk` 并校验 `app.tgz` 内容包含后端与前端产物 |
| 真实设备 | `appcenter-cli install-local` 安装，验证启动、网关访问、容器管理与卸载（需要目标 NAS） |

## 发布与回滚

- 版本沿仓库统一版本线，`manifest` 单独维护应用版本。
- 首次发布为 `1.0.0`；后续按任务边界独立提交。
- 回滚：保留上一版 `app/server` 与 `app/ui/dist`；升级回调不删除用户配置，失败时保留旧配置并输出可执行错误。

## 风险与待确认

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| 目标设备 `docker` 组权限模型差异 | 非 root 可能无法管理 Docker | 安装阶段显式检查并给出错误；不使用 root 回退 |
| 小雅镜像内部行为不可控 | 配置文件契约可能随镜像变化 | 以镜像实际读取的文件为准，配置层可扩展 |
| 阿里云盘/115 授权端点变更 | 扫码授权失效 | 保留手动粘贴 Token 通道作为兜底 |
| 元数据体积大 | 磁盘与耗时压力 | 下载前容量检查、断点续传、单任务串行 |
| 前端脚手架体积 | 面板资源偏大 | 按需裁剪页面与依赖，构建产物 gzip 后纳入 FPK |
