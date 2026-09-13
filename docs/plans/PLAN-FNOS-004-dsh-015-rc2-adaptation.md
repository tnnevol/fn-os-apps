---
id: PLAN-FNOS-004
title: PLAN-FNOS-004 DSH 0.1.5-rc.2 适配与 FPK 运行修复
description: 实施 FNOS-004-01 至 FNOS-004-07：完成 DSH 适配、插件策略、权限 wrapper、Token 刷新、发布回滚门禁及 CLI 插件管理。
status: planned
owner: tnnevol
planDate: 2026-09-12
targetVersion: 5.3.1
lastVerified: 2026-09-12
---

# PLAN-FNOS-004 DSH 0.1.5-rc.2 适配与 FPK 运行修复

| 字段 | 内容 |
| --- | --- |
| 计划编号 | PLAN-FNOS-004 |
| 计划日期 | 2026-09-12 |
| 对应需求 | [FNOS-004 DSH 0.1.5-rc.2 适配与 FPK 运行修复](/requirements/FNOS-004-dsh-015-rc2-adaptation) |
| 本轮功能 | `FNOS-004-01` 至 `FNOS-004-07`：DSH 适配、Codex/dshmarket 插件策略、dsh CLI wrapper、Token 刷新、发布升级回滚门禁和 CLI 插件管理 |
| 上游依据 | 本地 Harness checkout 的 `dsh-v0.1.5-rc.2`（`fb2c4b9e698e30edb738bca4cf0618587db7d203`） |
| 计划状态 | <Badge type="info" text="规划中" /> |

## 计划目标

将 DSH 应用和仓库内四个插件的兼容性基线从 `0.1.2-rc.1` 升级到本地官方 Harness checkout 的 `dsh-v0.1.5-rc.2`，并让新 FPK 不再默认捆绑 Codex 插件。当前计划包含 DSH catalog、锁文件、插件 `compatibility.json`、上游破坏性 API 迁移、FPK native 构建配置、Codex 安装策略、DSH CLI 插件管理、应用权限 wrapper、内部重启 Token 刷新和运行时验证。

本轮处理 `FNOS-004-01` 至 `FNOS-004-07`。其中 `FNOS-004-06`作为发布、升级和回滚的一致性门禁，不新增独立运行时能力。计划不修改 DeepSeek Harness 上游源码，只在本仓库插件和 FPK 构建链内完成适配。

## 实现范围和边界

| 模块 | 计划入口 | 实现责任 |
| --- | --- | --- |
| DSH 依赖基线 | `pnpm-workspace.yaml`、`pnpm-lock.yaml` | 统一 `@deepseek-ai/dsh-*` catalog 和允许提前安装的版本列表 |
| fnOS 插件 | `plugins/dsh-fnos-plugin` | 迁移客户端输入、命令、附件、会话和 UI 接缝 |
| Codex Auth 插件 | `plugins/dsh-codex-auth-plugin` | 迁移 attachment、LLM、`pi-ai` 和模型目录接缝；保持老用户可用 |
| CodeBuddy 插件 | `plugins/dsh-codebuddy-plugin` | 迁移 LLM 流式、文件块和附件接缝 |
| Semi UI 插件 | `packages/dsh-semi-ui`、`plugins/dsh-semi-ui-showcase-plugin` | 迁移共享 UI、layout、slots 和 renderer 接缝 |
| FPK 应用 | `apps/fn-deepseek-harness/cmd/install_callback`、`config/resource`、`config/privilege`、`manifest` | 安装并校验 `0.1.5-rc.2` DSH 运行时，在安装流程中生成并注册权限固定的 CLI wrapper，不清理 `DSH_HOME` |
| FPK 插件策略 | `apps/fn-deepseek-harness/app/published-dsh-plugins.json`、`app/bundled-dsh-plugins`、`app/scripts/install-dsh-plugins.mjs` | 从新 FPK 清单和内置目录移除 Codex，改由 DSH CLI 管理插件，同时保护老用户已有安装 |
| Native 构建 | `.github/config/`、`.github/scripts/prepare-dsh-native.sh`、`.github/workflows/build-dsh-fn.yml` | 使用新 DSH 依赖树准备 native 产物并生成版本化 FPK |
| 文档与测试 | `docs/development/`、`docs/apps/`、插件测试目录 | 记录迁移差异、测试命令和本地/NAS 证据 |

`FNOS-004-03` 只通过 `FNOS-004-07` 规定的 DSH CLI 安装固定版本 dshmarket，并处理已安装时跳过，不另建插件安装实现。`FNOS-004-04` 负责把 CLI wrapper 注册到应用 bin，并固定环境和应用用户身份；它不修改 DSH CLI 上游实现。公开 wrapper 的实现不能绕过 `FNOS-004-07` 的 CLI 管理边界。`FNOS-004-05` 负责网关代理和 DSH Web 重启之间的 Token 状态同步、原子持久化和并发请求处理。Codex 清单和内置目录属于 `FNOS-004-02`，本轮会修改，但只允许移除新 FPK 的默认来源，不清理老用户 profile。

## 目标架构和数据流

```text
DSH 0.1.5-rc.2 发布包
        │
        ├─ pnpm catalog + lockfile
        │       │
        │       └─ 插件 peer/devDependencies
        │               └─ compatibility.json 与源码 API 迁移
        │
        └─ native 依赖准备脚本
                └─ fn-deepseek-harness FPK
                        └─ install_callback 安装精确 DSH 版本
                                └─ dsh web 启动并加载四个插件
```

版本解析、插件编译和 FPK 运行验证使用同一个 `0.1.5-rc.2` 基线。安装回调只在运行时版本缺失或不匹配时处理依赖，不删除用户的 `DSH_HOME`、profile、凭据、工作区或会话数据。

## 分阶段任务

### P0：建立 DSH 0.1.5-rc.2 依赖基线

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-004-T01-01 | FNOS-004-01-AC-01 | 先校验 `~/workspace/fork-pj/deepseek-harness` 的 tag、commit、包版本和 `pnpm@11.7.0`，再盘点本仓库版本引用并统一到该 tag 的 `0.1.5-rc.2` | 适配证据固定为 `dsh-v0.1.5-rc.2` / `fb2c4b9e698e30edb738bca4cf0618587db7d203`；当前配置、锁文件和构建参数只保留新基线 |
| PLAN-FNOS-004-T01-02 | FNOS-004-01-AC-02 | 按新依赖树更新 DSH catalog 和 `minimumReleaseAgeExclude`，用仓库固定的 `pnpm@11.7.0` 重建锁文件 | `pnpm install` 成功，锁文件解析出的 DSH 包版本可审计且没有混入旧基线 |
| PLAN-FNOS-004-T01-03 | FNOS-004-01-AC-03 | 核对 `dsh-attachment-local`、`node-pty`、Node.js 和 node-gyp 的实际版本；若 native 或持久化补丁锚点变化，按新依赖树更新配置和脚本 | native 配置、补丁锚点和构建机产物与实际依赖树一致；不凭包名假设 transitive 版本 |

### P0：完成四个插件的兼容性迁移

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-004-T02-01 | FNOS-004-01-AC-04 | 更新四个插件的 `compatibility.json`，保持插件自身发布版本与 DSH 运行时版本分开管理 | `dshPluginApi.version` 为 `0.1.5-rc.2`，声明的包集合覆盖实际 import，不引入无关包 |
| PLAN-FNOS-004-T02-02 | FNOS-004-01-AC-05 | fnOS 插件迁移 `InputActions`、`SessionInput`、附件字段、`CommandContribution.description` 及 primitives/layout/slots 的替换导出 | 主题、`/fn` 指令、授权目录、NAS 引用和会话导出相关测试通过；不存在旧图片 API 引用 |
| PLAN-FNOS-004-T02-03 | FNOS-004-01-AC-06 | Codex Auth 迁移 attachment 与 `dsh-llm-pi-ai` 接缝，适配 `pi-ai` `0.85.1` 的 provider、模型目录和图片输入类型 | Codex Auth 类型检查、单元测试和构建通过；无凭据测试不泄漏密钥，老配置结构仍可读取 |
| PLAN-FNOS-004-T02-04 | FNOS-004-01-AC-07 | CodeBuddy 迁移 `dsh-llm` 流式、文件块和附件序列化接缝，保留现有多账号、切换、签到和用量面板行为 | CodeBuddy 类型检查、单元测试和构建通过；文本、图片和错误流仍能被 UI 正确消费 |
| PLAN-FNOS-004-T02-05 | FNOS-004-01-AC-08 | Semi UI 共享包和总览插件迁移 layout、renderer、slots、theme 与 primitives 接缝 | 共享组件和总览路由在新客户端下能构建、渲染、刷新和卸载 |

### P0：移除 Codex 默认捆绑

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-004-T05-01 | FNOS-004-02-AC-01 | 从新 FPK 清单和内置目录移除 Codex；仓库内插件使用 `pnpm pack` 生成精确版本归档，核验包名、版本和运行依赖，安装回调用 DSH CLI `file:` spec 安装；发现旧 `link:` 同版本安装时重新安装归档 | 清单和 FPK 不包含 Codex；内置归档元数据与清单一致，干净及旧 `link:` profile 均能解析 `dsh-fnos` 的 `@deepseek-ai/schemastery` 并启动 Web |
| PLAN-FNOS-004-T05-02 | FNOS-004-02-AC-02 | 审计 `install-dsh-plugins.mjs` 的缺失 manifest 行为，确保不因 Codex 不在新清单中执行删除、卸载、覆盖或 profile bundle 清理 | 老用户已有 Codex 包、配置、凭据和 bundle 在升级后逐项保持不变 |
| PLAN-FNOS-004-T05-03 | FNOS-004-02-AC-03 | 为安装回调增加新用户、老用户和重复升级场景的隔离回归夹具，记录安装、升级和跳过清理的日志 | 新用户无 Codex；老用户无卸载日志；重复执行幂等且不因缺失 Codex 条目失败 |
| PLAN-FNOS-004-T05-04 | FNOS-004-02-AC-04 | 检查 FPK 构建 CLI 只按当前发布清单复制仓库中的本地插件；清单中的三方插件不进入内置目录，安装回调仍通过 DSH CLI 单独安装；补充精确版本、产物目录和 profile manifest 检查 | 构建产物不重新带入 Codex 或未解析的三方插件；不存在浮动版本安装；本地 FPK 检查和真实 NAS 升级验证结果一致 |

### P0：使用 DSH CLI 管理 FPK 插件

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-004-T06-01 | FNOS-004-07-AC-01 | 在 `install_callback` 中先检测应用自己的 npm 全局目录是否已有可执行且版本精确的 `pnpm@11.7.0` 和 `@deepseek-ai/dsh@0.1.5-rc.2`；两者均满足时跳过对应安装，否则只安装缺失、不可执行或版本不匹配的固定版本；同时设置应用用户可执行的 PATH、DSH_HOME、npm 前缀、`${DSH_HOME}/.npmrc` 和 `${DSH_HOME}/.pnpm-store-dir` 持久配置 | 官方 CLI 插件命令执行前，`dsh --version` 和 `pnpm --version` 均输出精确版本，重复安装不重复下载已满足版本的依赖，也不依赖 NAS 全局 pnpm；npm 源由 `.npmrc` 提供，pnpm store 由 `PNPM_CONFIG_STORE_DIR` 提供 |
| PLAN-FNOS-004-T06-02 | FNOS-004-07-AC-02 | 不再由应用单独初始化 profile；首次执行 `dsh plugin --profile web add/update` 时由官方 CLI 自动初始化，已有 profile 时复用，不覆盖用户配置，也不启动 Web | 官方 CLI 自动创建缺失 profile，已有依赖、patch 和配置保持不变 |
| PLAN-FNOS-004-T06-03 | FNOS-004-07-AC-03 | 将 install/upgrade callback 的插件操作改为 `dsh plugin --profile web` 的 add/update，内置本地插件时把 FPK 包路径交给 DSH CLI，不内置的三方插件继续按精确包名安装；移除 `install-dsh-plugins.mjs` 及其调用、npm 直装和手工 bundle 重建路径 | 生命周期日志显示 DSH CLI 命令；本地插件不重复走 registry；三方插件不会因内置分流被漏装；FPK 产物不再包含旧插件安装脚本 |
| PLAN-FNOS-004-T06-04 | FNOS-004-07-AC-04 | 清单只接受插件名称和精确版本，生成 `<package>@<version>` 参数；捆绑包 `package.json` 版本必须与清单一致，拒绝 `latest`、`next` 和其他浮动 dist-tag | 所有自动安装命令可审计为精确版本，清单、捆绑包和 profile 依赖版本一致 |
| PLAN-FNOS-004-T06-05 | FNOS-004-07-AC-05 | 仅对清单中的缺失插件执行 add，对版本变化的插件执行精确 update；`remove` 只由明确的用户操作触发，不因清单缺少 Codex 等旧插件而自动移除 | 新安装、升级和重复升级幂等，老用户旧插件和 bundle 保持不变 |
| PLAN-FNOS-004-T06-06 | FNOS-004-07-AC-06 | 区分 DSH、pnpm、清单校验和 profile 写入失败；从 `.modules.yaml` 复用既有 pnpm store 并持久化到 `${DSH_HOME}/.pnpm-store-dir`，同时清理旧 `.npmrc` 中的 `store-dir` 配置，任何命令非零都中止回调并保留旧 profile 数据 | fake 命令夹具覆盖成功、旧 store 路径复用、npm 无未知配置警告、缺工具、权限不足和部分失败场景，错误可定位且生命周期返回非零 |
| PLAN-FNOS-004-T06-07 | FNOS-004-07-AC-07 | 在当前 DSH 客户端验证非 fnOS 插件的 CLI 管理和 Bundle 重启生效；在真实 NAS 只验证 FPK、网关和 `dsh-fnos` | 两类环境证据分开记录，Codex Auth、CodeBuddy、Semi UI 和共享包不以 NAS 安装为前置条件 |

### P0：固定并兼容安装 dshmarket

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-004-T07-01 | FNOS-004-03-AC-01 | 将 dshmarket 纳入 FPK 插件清单但不复制到 FPK，固定版本为 `dshmarket@1.45.1`；profile 中不存在该插件时生成 `dsh plugin --profile web add dshmarket@1.45.1` | 新用户安装日志包含精确 CLI 命令，profile 依赖和 bundle 写回成功，Web 重启后市场入口加载 |
| PLAN-FNOS-004-T07-02 | FNOS-004-03-AC-02 | 安装前检查 profile 包清单和实际包目录；任一位置已存在 dshmarket 即记录跳过，不执行 add/update/remove | 已安装任意版本的用户文件、版本、配置和 bundle 保持不变，重复升级幂等 |
| PLAN-FNOS-004-T07-03 | FNOS-004-03-AC-03 | 清单校验只允许精确版本 `1.45.1`，禁止 dshmarket 使用 `latest`、`next` 或其他浮动 dist-tag | 构建和 fake CLI 测试能证明命令参数始终带固定版本 |
| PLAN-FNOS-004-T07-04 | FNOS-004-03-AC-04 | 在当前 DSH 客户端验证 dshmarket 的 CLI 安装、跳过已安装和 Web 重启生效；NAS 只验证 FPK 安装链及 `dsh-fnos` | 客户端和 NAS 证据分开保存，不要求其他插件安装到 NAS |

### P0：注册 dsh CLI 权限 wrapper

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-004-T08-01 | FNOS-004-04-AC-01 | 在 `install_callback` 中创建并注册 `${TRIM_APPDEST}/app/bin/dsh` 公开 CLI wrapper；`cmd/main` 只把真实 `${TRIM_PKGHOME}/.npm-global/bin/dsh` 路径交给网关，网关以应用包用户直接启动 Web 并固定子进程环境 | bin 入口可执行 `dsh --version`、`dsh --help`；Web 进程命令行只包含真实 CLI，不经 wrapper 或独立启动脚本 |
| PLAN-FNOS-004-T08-02 | FNOS-004-04-AC-03 | wrapper 内置并覆盖 `DSH_HOME`、`HOME`、`PATH`、`NPM_CONFIG_CACHE`、`NPM_CONFIG_PREFIX`、`XDG_CONFIG_HOME` 等环境变量，清理调用者同名变量 | 使用不同调用环境执行命令时，真实 CLI 始终使用应用 profile 和应用包目录 |
| PLAN-FNOS-004-T08-03 | FNOS-004-04-AC-02 | wrapper 执行前统一使用 `TRIM_UID` 固定目标用户，并结合 `TRIM_GROUPNAME` 设置执行组；已是目标用户时直接执行，其他用户使用设备支持的安全用户切换机制 | 通过 root、应用用户及其他有权限入口调用时，`id` 和真实进程身份均为指定应用用户；无法切换时非零退出且不降级执行 |
| PLAN-FNOS-004-T08-04 | FNOS-004-04-AC-04 | 设置 wrapper、真实 CLI、Node/pnpm、profile 和插件依赖的所有权与最小权限；禁止普通用户修改 wrapper、配置或改变所有权 | 使用 `stat` 和实际写入测试证明非应用用户不能篡改 DSH 配置，应用用户可以正常管理自己的 profile |
| PLAN-FNOS-004-T08-05 | FNOS-004-04-AC-03 | 保证 wrapper 转发参数、stdin/stdout/stderr、退出码和中断信号，不通过 `eval` 拼接参数 | `dsh plugin --profile web ...`、管道输入、非零退出和终止信号均与真实 CLI 行为一致 |

### P0：内部重启后的代理 Token 刷新

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-004-T09-01 | FNOS-004-05-AC-01 | 保持 `cmd/main` 只负责启动网关，由网关直接运行应用私有目录中的真实 DSH CLI 启动 `dsh web --no-open`；梳理 `cmd/config_callback`、`gateway-proxy.mjs` 的重启状态、WebProcessController、Token 文件和统一网关代理链路；重启开始时明确标记 Token 失效/刷新中 | 网关能捕获本轮 Web 启动 Token 并仅在内部代理请求中使用；浏览器 iframe 地址不携带 Token，旧 Token 在重启开始后不再用于健康检查或代理鉴权，状态接口能区分刷新中和错误 |
| PLAN-FNOS-004-T09-02 | FNOS-004-05-AC-02 | DSH Web 启动后从启动输出捕获新 Token，先写临时文件并原子 rename，再更新内存 Token；设置应用包用户所有权和最小权限 | 新 Token 文件内容完整、权限正确，进程内读取值与落盘值一致；写入失败不会发布半截 Token |
| PLAN-FNOS-004-T09-03 | FNOS-004-05-AC-03 | 调整网关首页认证、健康检查和代理入口的 Token 读取顺序：刷新期间等待本轮启动结果或返回可恢复响应，禁止读取旧缓存；新 Token 生效后仅向 DSH 上游请求注入新值，并清理上游响应中的 Token 跳转 | 浏览器 iframe 地址始终不携带 Token；页面、HTTP、SSE、WebSocket 和并发请求不会因旧 Token 返回未授权；成功后能自动恢复页面访问 |
| PLAN-FNOS-004-T09-04 | FNOS-004-05-AC-04 | 覆盖首次启动、配置触发的内部重启、异常退出恢复、连续重启和启动超时；清理旧临时文件、锁和失效 Token，保留可诊断错误 | 隔离测试和真实 NAS 回归均能证明新旧 Token 正确切换，旧 Token 不再生效，失败时不会误报启动成功 |
| PLAN-FNOS-004-T09-04a | FNOS-004-05-AC-04 | 网关在启动前恢复 DSH 凭据文件遗留锁：仅处理锁文件中 PID 已退出的情况，采用 rename 隔离后清理；活跃 PID 必须等待释放，锁内容异常必须保留并失败 | 应用异常退出遗留 `.credentials.yaml.lock` 后可重新启动；活跃凭据写入不会被删除或并发启动破坏 |
| PLAN-FNOS-004-T09-05 | FNOS-004-05-AC-04 | 在真实 NAS 验证网关 iframe、HTTP/SSE/WebSocket、重启控制接口和并发请求；非 fnOS 插件继续只在当前 DSH 客户端验证 | NAS 记录重启前后 Token 状态、响应码、跳转地址和日志，确认问题不再复现 |

### P1：发布、升级和回滚一致性门禁

状态：<Badge type="info" text="规划中" />

`FNOS-004-06`是贯穿构建、安装、升级和验收的发布门禁，不新增独立运行时能力。

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-004-T10-01 | FNOS-004-06-AC-01 | 增加构建前清单校验，统一核对 DSH 版本、native 配置、锁文件、`published-dsh-plugins.json`、捆绑包元数据、Codex 排除规则和 FPK 文件名 | 版本或清单不一致时构建失败；成功产物的版本信息可从清单、文件和 FPK 元数据复核 |
| PLAN-FNOS-004-T10-02 | FNOS-004-06-AC-02 | 审计 install/upgrade callback 的幂等性，确保只处理当前精确清单，不清空 `DSH_HOME`，不自动移除旧插件，并保留升级前运行状态记录 | 新装、升级和重复升级结果一致；用户 profile、凭据、工作区、会话和旧插件保持可读 |
| PLAN-FNOS-004-T10-03 | FNOS-004-06-AC-03 | 在升级变更前保存可恢复的 runtime/profile 元数据；失败时返回非零并恢复旧指针或旧配置，成功后写入完成标记 | 模拟 DSH、pnpm、插件、native 和启动失败后，上一份 FPK 或受支持回滚流程可恢复启动，用户数据不变 |
| PLAN-FNOS-004-T10-04 | FNOS-004-06-AC-04 | 生成发布证据索引，关联 FPK、DSH/native/plugin 版本、安装升级日志、回滚结果及当前客户端/NAS 验收记录 | 任一发布包都能追溯到构建输入和目标环境证据；本地结果不冒充 NAS 验收 |

### P0：同步 FPK 运行时与构建入口

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-004-T03-01 | FNOS-004-01-AC-09 | 更新 `cmd/install_callback` 的 DSH 版本常量和版本校验，沿用 `${TRIM_*}` 路径，不重建或清空用户 profile | 新安装可得到精确 `0.1.5-rc.2`；已有用户数据目录不被删除或重置 |
| PLAN-FNOS-004-T03-02 | FNOS-004-01-AC-10 | 更新 native 配置文件名、`prepare-dsh-native.sh` 默认值和 `build-dsh-fn.yml` 的准备/重命名步骤 | workflow 输出的 FPK 文件名带 `dsh-0.1.5-rc.2`，native 文件来自同一依赖树 |
| PLAN-FNOS-004-T03-03 | FNOS-004-01-AC-11 | 更新 DSH 版本相关应用与开发文档，区分当前运行基线和历史变更记录 | 用户文档、开发文档、需求和计划中的当前版本一致；不提前写入本轮未实施的插件安装行为 |

### P1：组合入口与目标环境验证

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-004-T04-01 | FNOS-004-01-AC-12 | 执行四个插件及共享包的 typecheck、unit test、build，并执行仓库级相关检查 | 受影响 workspace 全部通过；测试覆盖新 API 的加载、卸载、错误和回放路径 |
| PLAN-FNOS-004-T04-02 | FNOS-004-01-AC-13 | 构建 `fn-deepseek-harness` FPK，检查包内版本、入口、native 文件和安装脚本 | `pnpm run build -- --fpk --app fn-deepseek-harness` 成功；产物可被 fnOS 安装工具识别 |
| PLAN-FNOS-004-T04-03 | FNOS-004-01-AC-14 | 在真实 NAS 执行全新安装、启动、网关 iframe、HTTP/SSE/WebSocket 和 `dsh-fnos` 插件加载验证 | `dsh --version` 为 `0.1.5-rc.2`；Web 可打开；fnOS 插件无加载异常；NAS 证据单独记录 |
| PLAN-FNOS-004-T04-04 | FNOS-004-01-AC-15 | 在当前 DSH 客户端使用同一 `0.1.5-rc.2` 基线验证 Codex Auth、CodeBuddy、Semi UI 及共享包的组合入口、插件加载和关键 UI/API 行为 | 非 fnOS 插件不依赖 NAS 即可完成验证；客户端证据记录版本、组合入口、测试结果和失败日志 |

## 详细交互

### P0：FPK 安装与 DSH Web 启动流程

1. 在干净测试环境安装本轮 FPK；fnOS 执行 `cmd/install_callback`，安装回调按固定版本检查 DSH 运行时。
2. 安装完成后启动应用，`cmd/main` 通过已有网关入口启动 DSH Web profile。
3. 从应用日志和运行命令确认 DSH 运行时版本为 `0.1.5-rc.2`，再访问 fnOS iframe 入口。
4. 在 NAS 端只确认 `dsh-fnos` 插件注册、fnOS API/网关交互和既有基础入口可用。
5. 在当前 DSH 客户端确认 Codex Auth、CodeBuddy、Semi UI 及共享包注册和关键行为；这些插件的组合验证不以 NAS 安装为前置条件。
6. 任一插件加载失败时保留对应环境的日志和错误堆栈，应用不得报告虚假的“启动成功”；基础 DSH 启动问题、fnOS 宿主问题和客户端插件契约问题分别记录。

### P0：Codex 默认捆绑兼容流程

1. 在构建产物检查中确认新 FPK 的发布清单和内置插件目录均不含 Codex。
2. 在隔离的干净 profile 中执行安装，确认 manifest 未列出的 Codex 不会被安装，`dsh-fnos` 仍按当前清单处理。
3. 在隔离的老用户 profile 中预置 Codex 包、配置、凭据和 bundle，执行升级与重复升级。
4. 重新读取 profile 文件、包目录和日志，确认 Codex 数据保持原状，没有卸载、删除、覆盖或因缺失清单导致的失败。

### P0：DSH CLI 插件管理流程

1. `install_callback` 先确认 Node.js、应用包用户和运行目录，再将向导选择的 npm 源持久化到 `${DSH_HOME}/.npmrc`，将 pnpm store 路径持久化到 `${DSH_HOME}/.pnpm-store-dir`，随后准备精确版本 DSH 与 `pnpm@11.7.0`。
2. 按 `published-dsh-plugins.json` 读取插件名称和精确版本，对缺失插件执行 `dsh plugin --profile web add <package>@<version>`，对版本变化执行精确 update；缺失 profile 由官方 CLI 自动初始化。
3. 对 dshmarket 先检查 profile 包清单和实际包目录；缺失时执行 `dsh plugin --profile web add dshmarket@1.45.1`，已存在时跳过，不因为版本不同而覆盖。构建阶段不复制 dshmarket，registry 安装失败直接报告错误，不使用 FPK 内置回退包。
4. DSH CLI 在 profile 目录中调用 pnpm，并负责写入依赖和 reconcile `dsh.profile.bundles`；应用不再复制插件、手工初始化 profile 或手工修改 bundle 列表。
5. 新 bundle 只在 Web profile 下次启动时生效；安装/更新完成后按既有流程重启 Web。清单未列出的老插件不执行自动 remove。
6. `upgrade_callback` 复用同一流程，禁止回退到旧脚本；任一命令失败都停止回调并保留 profile 数据。

### P0：dsh CLI wrapper 调用流程

1. `install_callback` 参考 Hermes 应用创建 wrapper 并放入应用 bin 注册目录；wrapper 使用固定的应用安装路径定位 Node、pnpm、真实 dsh CLI 和 profile，不从当前工作目录或调用者 PATH 推断位置。
2. wrapper 先建立固定环境：覆盖 DSH_HOME、HOME、PATH、NPM_CONFIG_CACHE、NPM_CONFIG_PREFIX 和 XDG_CONFIG_HOME，并清除可能把配置、缓存或包安装位置指向调用者目录的环境变量。
3. wrapper 读取安装阶段记录的 `TRIM_UID`，并结合 `TRIM_GROUPNAME` 设置执行组。已是目标用户时直接执行真实 CLI；其他有权限调用者通过 fnOS 设备支持的安全用户切换机制执行。无法安全切换时立即返回非零，不尝试以调用者身份运行。
4. wrapper 使用参数数组直接 `exec` 真实 dsh，保留 stdin/stdout/stderr、退出码和信号；不得通过 `eval` 或字符串拼接重新解释用户参数。
5. 应用 bin 中的 wrapper、真实 CLI 和运行依赖不可被普通用户写入；profile 和插件依赖由应用用户拥有，wrapper 只提供受控调用入口，不改变配置文件所有权。

### P0：内部重启 Token 刷新流程

1. 网关收到内部重启请求后，先将 Token 状态切换为刷新中，使旧 Token 不能再被健康检查或代理鉴权读取；浏览器 iframe 地址保持无 Token。
2. `cmd/main` 停止旧 DSH Web 并启动新进程；`gateway-proxy.mjs` 从本轮启动输出捕获带 Token 的地址，只接受非空、格式有效且属于当前启动轮次的 Token。
3. 新 Token 写入同目录临时文件，完成 flush/close 后通过原子 rename 替换正式 Token 文件，并设置应用包用户所有权和受限权限；确认落盘成功后再更新内存缓存和可用状态。
4. 重启期间的页面和代理请求等待新 Token，或返回带重试语义的恢复页面/响应；Token 捕获、持久化或健康检查超时则返回明确错误，不复用旧 Token 掩盖失败。
5. 新 Token 发布后，首页认证中间件、健康检查和代理请求统一从当前内存/文件状态读取；Token 只附加到网关到 DSH 的内部请求，上游响应中的 Token 跳转会被清理，连续重启不会把较早轮次的 Token 写回。

### P1：发布与升级回滚流程

1. 构建 FPK 前运行清单校验，确认 DSH/native/plugin 版本、Codex 排除规则、dshmarket 固定版本、wrapper 和 FPK 元数据一致；校验失败不进入发布。
2. 安装或升级前记录当前 runtime 指针、profile 关键元数据和应用版本；不复制或记录 Token、API Key 等敏感内容。
3. 安装/升级只执行当前计划规定的幂等操作；完成 DSH CLI、wrapper、插件、native 和 Web 启动验证后再写入成功标记。
4. 任一阶段失败时返回非零，保留旧 profile 和用户数据，并按可用的旧 runtime/旧 FPK 回滚入口恢复；不能用清空 profile 的方式“回滚”。
5. 发布后把构建输入、FPK、版本清单、升级日志、回滚结果和客户端/NAS 验收记录关联保存，作为完成 `FNOS-004-06` 的证据。

### P0：插件兼容性回归流程

1. 先在无真实凭据的组合入口运行插件加载、配置校验、卸载和错误路径测试。
2. 在当前 DSH 客户端使用测试凭据或 mock，验证 Codex Auth 模型目录、CodeBuddy 流式响应和 Semi UI 页面行为；这些验证不要求安装到 NAS。
3. 使用当前客户端的真实 DSH Web 入口验证非 fnOS 插件的 bundle、Host 服务、Remote 调用和页面刷新；在 NAS 端单独验证 `dsh-fnos` 的 fnOS API、路径和网关行为，不只验证单独构造的 Context。
4. 发现 API 接缝不匹配时，优先根据 `0.1.5-rc.2` 当前源码和生成类型修复插件，不改上游源码；无法等价迁移时停止发布并记录影响。

## 数据、权限和错误处理

- 所有应用路径使用 `${TRIM_*}` 环境变量；安装、升级和验证不得写死 NAS 安装目录。
- 版本升级不得删除 `DSH_HOME`、profile、凭据、工作区、会话、授权目录或现有插件配置；安装回调失败时保留旧数据并输出明确错误。
- 依赖安装使用仓库和安装向导约定的 npm registry，锁文件负责可重复解析；网络失败不能静默回退到浮动版本。
- DSH CLI 和 pnpm、profile manifest、node_modules 及配置文件都必须由 DSH 应用包用户可读写；权限不足时直接失败，不通过 root 绕过应用权限。
- 不记录 Token、API Key 或完整凭据；插件管理日志只记录包名、精确版本、命令阶段和错误原因。
- wrapper 不能信任调用者传入的 DSH_HOME、HOME、PATH、npm/pnpm 前缀、配置目录或代理变量；需要保留的代理设置必须由应用固定配置或显式白名单提供。
- wrapper 身份切换失败、目标用户不存在、运行文件不可执行或 profile 权限不匹配时，直接返回非零并输出阶段性错误；不能静默改用 root 或调用者身份。
- Token 刷新采用“失效旧状态 → 捕获新 Token → 原子持久化 → 发布内存状态”的顺序；任何中间步骤失败都不能继续对外宣称 Web 已恢复，也不能回退使用旧 Token。
- Token 文件、临时文件和锁文件都必须位于应用运行目录，由应用包用户拥有；日志只能记录 Token 轮次和状态，不能记录 Token 内容。
- runtime 指针、profile 快照和升级完成标记不能包含凭据；回滚只恢复版本和配置元数据，不删除用户数据。
- Native 依赖准备失败、补丁锚点不唯一、Node ABI 不匹配和插件 API 不匹配分别记录错误，不以跳过检查的方式生成 FPK。
- Host 与 Client 仍遵守 DSH Remote、附件持久化、会话可回放和插件生命周期约束；测试覆盖重复加载、卸载和异常退出清理。

## 依赖、风险和决策

| 项目 | 风险或决策 | 处理方式 |
| --- | --- | --- |
| 上游 API | 目标 tag 对附件、命令描述、LLM 流式、`pi-ai` 和 UI 导出有破坏性变化 | 以本地 `dsh-v0.1.5-rc.2` 源码/生成类型逐项迁移并补组合入口测试，不提交上游补丁 |
| 依赖树 | `dsh-attachment-local` 或 `node-pty` 的实际版本可能与 DSH 主版本不同 | 以锁文件和已安装依赖树为准，native 配置跟随实际版本 |
| Native 构建 | macOS 本地无法代替 Linux runner 生成目标 native 文件 | 本地验证脚本和配置，CI/Linux 生成正式 native 产物，NAS 只安装构建结果 |
| 外部服务 | Codex Auth、CodeBuddy 的完整模型调用需要凭据和网络 | 无密钥测试验证契约与错误路径；真实服务只在受控环境验收，不提交凭据 |
| 回滚 | 新 bundle 或构建产物可能无法在旧运行时加载 | 发布前保留旧 FPK；回滚只恢复应用和依赖版本，不删除用户数据 |
| CLI 迁移 | DSH CLI 的 plugin 命令实际转发给 pnpm，应用自定义脚本与官方行为可能不一致 | 以本地 `dsh-v0.1.5-rc.2` 的 `apps/cli/src/plugin.ts` 为准，使用 fake CLI 夹具和客户端组合入口验证 |
| 内置包来源 | DSH CLI 不会自动读取 FPK 的 `bundled-dsh-plugins` 目录 | 实施时移除本地复制路径，或改用 DSH CLI 支持的精确版本包 spec；不得绕过 CLI |
| 跨用户调用 | shell wrapper 默认继承调用者身份和环境，可能污染 profile 权限或配置路径 | 使用 fnOS 支持的安全用户切换机制固定应用用户；切换失败即失败，并用不同调用身份验证 `id`、环境和文件所有权 |
| wrapper 篡改 | wrapper 或其依赖可写时，调用者可替换真实 CLI 或修改 DSH 配置 | wrapper、Node/pnpm、真实 CLI 和配置入口由受控所有者维护；非应用用户无写权限，应用用户只写 profile 数据 |
| Token 竞态 | 重启时旧缓存、旧文件和新进程输出可能交错，导致页面继续携带旧 Token | 使用重启轮次、锁、原子文件替换和刷新中状态；并发请求只等待新 Token 或返回可恢复响应 |
| Token 持久化 | 异步写文件可能尚未完成就更新内存，或留下半截文件 | 写临时文件并完成持久化后再 rename 和发布内存值；写入失败直接进入错误状态 |

## 测试、打包和发布

### 插件与共享包检查

```bash
pnpm --filter @tnnevol/dsh-fnos run typecheck
pnpm --filter @tnnevol/dsh-fnos run test:unit
pnpm --filter @tnnevol/dsh-fnos run build
pnpm --filter @tnnevol/dsh-codex-auth run typecheck
pnpm --filter @tnnevol/dsh-codex-auth run test:unit
pnpm --filter @tnnevol/dsh-codex-auth run build
pnpm --filter @tnnevol/dsh-codebuddy run typecheck
pnpm --filter @tnnevol/dsh-codebuddy run test:unit
pnpm --filter @tnnevol/dsh-codebuddy run build
pnpm --filter @tnnevol/dsh-semi-ui-showcase run typecheck
pnpm --filter @tnnevol/dsh-semi-ui-showcase run test:unit
pnpm --filter @tnnevol/dsh-semi-ui-showcase run build
pnpm --filter @tnnevol/dsh-semi-ui run typecheck
pnpm --filter @tnnevol/dsh-semi-ui run test:unit
pnpm --filter @tnnevol/dsh-semi-ui run build
```

### 应用与文档检查

```bash
pnpm install
pnpm run typecheck
pnpm run build -- --fpk --app fn-deepseek-harness
pnpm run check -- --sdd
pnpm run build -- --docs
git diff --check
```

本地构建只能证明依赖、脚本和产物结构正确，不能代替真实 NAS 验收。若当前环境无法访问 NAS，阶段保持“规划中”，并将缺少的环境证据标为阻塞项。

### 当前 DSH 客户端验证

- 使用本地官方 Harness checkout 的 `dsh-v0.1.5-rc.2` 组合入口，验证 Codex Auth、CodeBuddy、Semi UI 及共享包的插件加载、关键 UI、Remote/Host 和错误路径。
- 保存客户端版本、启动命令、插件加载日志、测试结果和失败场景证据；需要外部服务时使用测试凭据或 mock，不写入真实密钥。

### 真实 NAS 验证

- 使用新 FPK 完成全新安装，确认 DSH Web 入口、应用网关和 `dsh-fnos` 插件加载。
- 在应用升级场景确认已有 `DSH_HOME`、profile、凭据、工作区和会话仍可读取，并确认老用户已有 Codex 和 dshmarket 安装不被清理；同时验证内部重启后的 Token 刷新。
- 在真实 NAS 确认应用包用户能执行 DSH 和 pnpm，profile 初始化、FPK 插件管理和 `dsh-fnos` 加载成功；非 fnOS 插件使用当前 DSH 客户端证据，不重复要求在 NAS 安装。
- 在 NAS 验证 HTTP、SSE、WebSocket、iframe 页面、fnOS API/路径和 DSH Web 刷新，并记录 Token 轮换前后的状态和响应；非 fnOS 插件不重复要求在 NAS 安装。
- 保存 `dsh --version`、应用日志、fnOS 插件加载结果、网关请求和失败场景证据，写入 `docs/validation/` 后才能回写完成状态。

### 发布和回滚

- 仅在插件级检查、FPK 构建和真实 NAS 验收都通过后发布 DSH `0.1.5-rc.2` 适配包。
- FPK 产物名称包含 `dsh-0.1.5-rc.2`，发布说明标明该版本基线和已验证环境。
- 回滚使用上一份完整 FPK 和对应 native 依赖；不得通过回滚删除用户数据或清空 DSH profile。

## 参考资料

| 能力 | 用途 | 参考资料 |
| --- | --- | --- |
| DSH CLI 与 profile | 版本启动、Web profile、参数边界和组合层行为 | [DSH CLI 与 profile 参考](https://deepseek-harness.github.io/deepseek-harness/guide/quickstart)、[DeepSeek Harness 源码](https://github.com/deepseek-ai/deepseek-harness) |
| DSH 插件开发 | Cordis 生命周期、Remote、附件和组合插件契约 | [DSH 扩展开发](https://deepseek-harness.github.io/deepseek-harness/develop/basic)、[DSH Slots](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/slots) |
| fnOS 应用框架 | `cmd/install_callback`、`cmd/main` 和生命周期边界 | [fnOS 应用框架](https://developer.fnnas.com/docs/core-concepts/framework) |
| fnOS 环境变量 | `${TRIM_*}` 路径和应用配置边界 | [fnOS 环境变量](https://developer.fnnas.com/docs/core-concepts/environment-variables) |
| fnOS 应用权限 | 包用户、运行权限和最小权限边界 | [fnOS 应用权限](https://developer.fnnas.com/docs/core-concepts/privilege) |
| fnOS FPK 构建 | 应用构建和真实设备安装路径 | [fnOS fnpack](https://developer.fnnas.com/docs/cli/fnpack)、[fnOS 应用测试](https://developer.fnnas.com/docs/quick-started/test-application) |
| 本地 DSH 源码 | 目标 tag 的源码、生成类型和构建命令 | `~/workspace/fork-pj/deepseek-harness`，`dsh-v0.1.5-rc.2`，commit `fb2c4b9e698e30edb738bca4cf0618587db7d203`（只读参考，不修改） |

## 完成状态

| 阶段 | 状态 | 完成条件 |
| --- | --- | --- |
| P0 DSH 依赖基线 | <Badge type="info" text="规划中" /> | catalog、锁文件、版本常量和 native 配置统一到 `0.1.5-rc.2` |
| P0 插件兼容性迁移 | <Badge type="info" text="规划中" /> | 四个插件及共享包完成类型检查、单元测试、构建和组合入口验证 |
| P0 Codex 默认捆绑移除 | <Badge type="info" text="规划中" /> | 新 FPK 不含 Codex；老用户升级不卸载、不删除、不覆盖已有 Codex 安装 |
| P0 DSH CLI 插件管理 | <Badge type="info" text="规划中" /> | 固定 DSH/pnpm、使用官方 CLI 自动初始化 profile、add/update 和 bundle 写回；移除旧插件脚本及重复初始化逻辑 |
| P0 dshmarket 固定安装 | <Badge type="info" text="规划中" /> | 缺失时通过 DSH CLI 安装 `dshmarket@1.45.1`，已存在时跳过并保留原版本 |
| P0 dsh CLI 权限 wrapper | <Badge type="info" text="规划中" /> | 注册 bin wrapper、固定环境、强制应用用户执行并保护配置权限 |
| P0 内部重启 Token 刷新 | <Badge type="info" text="规划中" /> | 重启期间失效旧 Token，捕获并原子持久化新 Token，代理请求等待新状态 |
| P1 发布升级回滚一致性 | <Badge type="info" text="规划中" /> | 构建前版本门禁、升级幂等、失败恢复和发布证据可追溯 |
| P0 FPK 构建 | <Badge type="info" text="规划中" /> | FPK 构建成功，安装后 DSH 版本和启动入口正确 |
| P1 当前 DSH 客户端验证 | <Badge type="info" text="规划中" /> | Codex Auth、CodeBuddy、Semi UI 和共享包完成组合入口与关键行为验证 |
| P1 fnOS NAS 验收 | <Badge type="info" text="规划中" /> | Web、网关、`dsh-fnos`、Codex 老用户保留、升级数据保留和失败路径均有 NAS 证据 |

本计划汇总 `FNOS-004-01` 至 `FNOS-004-07`。其中 `FNOS-004-06`以发布、升级和回滚一致性门禁形式实施，不新增独立运行时能力。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-12 | 建立 PLAN-FNOS-004 | 仅将 `FNOS-004-01` DSH 与插件适配 0.1.5-rc.2 纳入当前实施计划，明确依赖基线、插件迁移、FPK 构建和 NAS 验收边界 |
| 2026-09-12 | 固定上游适配依据 | 确认本地官方 Harness checkout 已切到 `dsh-v0.1.5-rc.2`，后续以 commit `fb2c4b9e698e30edb738bca4cf0618587db7d203` 的源码和生成类型为准 |
| 2026-09-12 | 纳入 FNOS-004-02 | 增加 Codex 默认捆绑移除、新用户/老用户升级差异、非破坏性安装回归和 FPK/NAS 验收任务 |
| 2026-09-12 | 纳入 FNOS-004-07 | 将 FPK 插件管理迁移到目标 tag 提供的 DSH CLI，固定 DSH/pnpm/插件版本并移除自定义安装脚本 |
| 2026-09-12 | 纳入 FNOS-004-03 | 通过 DSH CLI 安装固定版本 `dshmarket@1.45.1`，已安装时跳过且不覆盖用户插件 |
| 2026-09-12 | 纳入 FNOS-004-04 | 增加应用 bin 中的 dsh CLI wrapper，固定运行环境并强制真实 CLI 使用应用包用户权限 |
| 2026-09-12 | 纳入 FNOS-004-05 | 增加内部重启 Token 的失效、捕获、原子持久化、代理等待和 NAS 并发回归任务 |
| 2026-09-12 | 纳入 FNOS-004-06 | 增加构建版本门禁、升级幂等、失败恢复、回滚入口和发布证据追踪任务 |
