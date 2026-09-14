---
id: PLAN-FNOS-004
title: PLAN-FNOS-004 DSH 0.1.5-rc.2 适配与 FPK 运行修复
description: 实施 FNOS-004-01 至 FNOS-004-09：完成 DSH 适配、插件策略、应用私有 CLI 与网关 Token 刷新、发布回滚门禁、CLI 插件管理、用量图标按模型供应商显隐，以及 fnOS 原生文件入口。
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
| 本轮功能 | `FNOS-004-01` 至 `FNOS-004-09`：DSH 适配、Codex/dshmarket 插件策略、应用私有 dsh CLI、Token 刷新、发布升级回滚门禁、CLI 插件管理、用量图标按供应商显隐和 fnOS 原生文件入口 |
| 上游依据 | 本地 Harness checkout 的 `dsh-v0.1.5-rc.2`（`fb2c4b9e698e30edb738bca4cf0618587db7d203`） |
| 计划状态 | <Badge type="info" text="规划中" /> |

## 计划目标

将 DSH 应用和仓库内四个插件的兼容性基线从 `0.1.2-rc.1` 升级到本地官方 Harness checkout 的 `dsh-v0.1.5-rc.2`，并让新 FPK 继续默认捆绑与 `0.1.5-rc.2` 适配的 Codex 插件。当前计划包含 DSH catalog、锁文件、插件 `compatibility.json`、上游破坏性 API 迁移、FPK native 构建配置、Codex 内置与安装策略、DSH CLI 插件管理、应用私有 CLI 权限、内部重启 Token 刷新和运行时验证。

本轮处理 `FNOS-004-01` 至 `FNOS-004-09`。其中 `FNOS-004-06`作为发布、升级和回滚的一致性门禁，不新增独立运行时能力。计划不修改 DeepSeek Harness 上游源码，只在本仓库插件和 FPK 构建链内完成适配。

## 实现范围和边界

| 模块 | 计划入口 | 实现责任 |
| --- | --- | --- |
| DSH 依赖基线 | `pnpm-workspace.yaml`、`pnpm-lock.yaml` | 统一 `@deepseek-ai/dsh-*` catalog 和允许提前安装的版本列表 |
| fnOS 插件 | `plugins/dsh-fnos-plugin` | 迁移客户端输入、命令、附件、会话和 UI 接缝；在 fnOS iframe 内遮蔽官方「打开应用」并提供 fnOS 原生文件入口 |
| Codex Auth 插件 | `plugins/dsh-codex-auth-plugin` | 迁移 attachment、LLM、`pi-ai` 和模型目录接缝；作为内置插件随 FPK 分发并保持老用户数据可用；`conversation.input.right` 的用量图标按选中模型供应商显隐 |
| CodeBuddy 插件 | `plugins/dsh-codebuddy-plugin` | 迁移 LLM 流式、文件块和附件接缝；`conversation.input.right` 的用量图标在 `showUsage` 之上叠加选中模型供应商条件 |
| Semi UI 插件 | `packages/dsh-semi-ui`、`plugins/dsh-semi-ui-showcase-plugin` | 迁移共享 UI、layout、slots 和 renderer 接缝 |
| FPK 应用 | `apps/fn-deepseek-harness/cmd/install_callback`、`config/resource`、`config/privilege`、`manifest` | 安装并校验 `0.1.5-rc.2` DSH 运行时，真实 CLI 保留在应用私有目录且不注册系统命令，不清理 `DSH_HOME` |
| FPK 插件策略 | `apps/fn-deepseek-harness/app/published-dsh-plugins.json`、`app/bundled-dsh-plugins` | 在 FPK 清单和内置目录中包含 Codex，改由 DSH CLI 管理插件，同时保护老用户已有数据 |
| Native 构建 | `.github/config/`、`.github/scripts/prepare-dsh-native.sh`、`.github/workflows/build-dsh-fn.yml` | 使用新 DSH 依赖树准备 native 产物并生成版本化 FPK |
| 文档与测试 | `docs/development/`、`docs/apps/`、插件测试目录 | 记录迁移差异、测试命令和本地/NAS 证据 |

`FNOS-004-03` 只通过 `FNOS-004-07` 规定的 DSH CLI 安装固定版本 dshmarket，并处理已安装时跳过，不另建插件安装实现。`FNOS-004-04` 负责把真实 CLI 固定在应用私有目录并以应用包用户身份运行，且不注册公开 `dsh` 命令（平台未提供非 root 可用的身份切换机制）；它不修改 DSH CLI 上游实现。CLI 管理仍由 `FNOS-004-07` 的 `dsh plugin --profile web` 边界承担。`FNOS-004-05` 负责网关代理和 DSH Web 重启之间的 Token 状态同步、原子持久化和并发请求处理。Codex 清单和内置目录属于 `FNOS-004-02`，本轮会修改：把 Codex 恢复为 FPK 默认内置插件并按清单精确版本安装，同时不清理老用户 profile 中的凭据和配置。`FNOS-004-08` 只改两个插件在 `conversation.input.right` 的挂出条件，不新增图标样式、交互，也不动 CodeBuddy 的 `showUsage` 偏好语义和两家插件的用量轮询实现。`FNOS-004-09` 只在 fnOS iframe 内遮蔽 DSH 官方「打开应用」按钮并改用 fnOS JS SDK 提供文件入口，不修改上游源码、不代理 `/open-in-app` 路由，也不动官方按钮在独立浏览器和桌面端的行为。

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
| PLAN-FNOS-004-T02-01 | FNOS-004-01-AC-04 | 更新四个插件的 `compatibility.json`，声明 `dshPluginApi.version` 为 `0.1.5-rc.2`；四个插件发布版本统一为 `0.1.5-rc.2` 并同步 `package.json`、发布清单和文档 | `dshPluginApi.version` 为 `0.1.5-rc.2`，声明的包集合覆盖实际 import，不引入无关包；插件版本与发布清单、文档一致 |
| PLAN-FNOS-004-T02-02 | FNOS-004-01-AC-05 | fnOS 插件迁移 `InputActions`、`SessionInput`、附件字段、`CommandContribution.description` 及 primitives/layout/slots 的替换导出 | 主题、`/fn` 指令、授权目录、NAS 引用和会话导出相关测试通过；不存在旧图片 API 引用 |
| PLAN-FNOS-004-T02-03 | FNOS-004-01-AC-06 | Codex Auth 迁移 attachment 与 `dsh-llm-pi-ai` 接缝，适配 `pi-ai` `0.85.1` 的 provider、模型目录和图片输入类型 | Codex Auth 类型检查、单元测试和构建通过；无凭据测试不泄漏密钥，老配置结构仍可读取 |
| PLAN-FNOS-004-T02-04 | FNOS-004-01-AC-07 | CodeBuddy 迁移 `dsh-llm` 流式、文件块和附件序列化接缝，保留现有多账号、切换、签到和用量面板行为 | CodeBuddy 类型检查、单元测试和构建通过；文本、图片和错误流仍能被 UI 正确消费 |
| PLAN-FNOS-004-T02-05 | FNOS-004-01-AC-08 | Semi UI 共享包和总览插件迁移 layout、renderer、slots、theme 与 primitives 接缝 | 共享组件和总览路由在新客户端下能构建、渲染、刷新和卸载 |

### P0：恢复 Codex 默认捆绑

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-004-T05-01 | FNOS-004-02-AC-01 | 在 `published-dsh-plugins.json` 的 `plugins` 中恢复 `@tnnevol/dsh-codex-auth` 的精确版本；仓库内插件使用 `pnpm pack` 生成精确版本归档，核验包名、版本和运行依赖，安装回调用 DSH CLI `file:` spec 安装；发现旧 `link:` 同版本安装时重新安装归档 | 清单包含 Codex 且与内置归档元数据一致，干净及旧 `link:` profile 均能解析 Codex 依赖并启动 Web |
| PLAN-FNOS-004-T05-02 | FNOS-004-02-AC-02 | 确认安装/升级只按清单对 Codex 执行安装或精确版本校准，不删除用户凭据、模型配置、workspace、授权目录和 profile bundle | 老用户已有 Codex 凭据、配置和 bundle 在升级后逐项保持不变 |
| PLAN-FNOS-004-T05-03 | FNOS-004-02-AC-03 | 为安装回调增加新用户、老用户和重复升级场景的隔离回归夹具，记录安装、升级和跳过的日志 | 新用户装到清单精确版本；老用户保留用户数据；重复执行幂等 |
| PLAN-FNOS-004-T05-04 | FNOS-004-02-AC-04 | 移除构建 CLI 与文档中的 Codex 排除规则，改为校验清单包含 Codex 且归档版本与清单一致；三方插件（dshmarket）仍不进入内置目录，安装回调通过 DSH CLI 单独安装 | 构建产物内置 Codex 归档且无浮动版本安装；本地 FPK 检查和真实 NAS 升级验证结果一致 |

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
| PLAN-FNOS-004-T06-08 | FNOS-004-07-AC-08 | 网关启动 DSH Web 时从 `${DSH_HOME}/.pnpm-store-dir` 读取安装期记录的 store，注入子进程 `PNPM_CONFIG_STORE_DIR` 并清理继承的同名变量；值缺失、为空或非绝对路径时不猜测 | 运行期 `pnpm store path` 与该 profile `node_modules/.modules.yaml` 的 `storeDir` 一致，`dsh plugin` 与三方市场更新不再出现 `ERR_PNPM_UNEXPECTED_STORE` |
| PLAN-FNOS-004-T06-07 | FNOS-004-07-AC-07 | 在当前 DSH 客户端验证非 fnOS 插件的 CLI 管理和 Bundle 重启生效；在真实 NAS 只验证 FPK、网关和 `dsh-fnos` | 两类环境证据分开记录，Codex Auth、CodeBuddy、Semi UI 和共享包不以 NAS 安装为前置条件 |

### P0：固定并兼容安装 dshmarket

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-004-T07-01 | FNOS-004-03-AC-01 | 将 dshmarket 纳入 FPK 插件清单但不复制到 FPK，固定版本为 `dshmarket@1.46.1`；profile 中不存在该插件时生成 `dsh plugin --profile web add dshmarket@1.46.1` | 新用户安装日志包含精确 CLI 命令，profile 依赖和 bundle 写回成功，Web 重启后市场入口加载 |
| PLAN-FNOS-004-T07-02 | FNOS-004-03-AC-02 | 安装前检查 profile 包清单和实际包目录；任一位置已存在 dshmarket 即记录跳过，不执行 add/update/remove | 已安装任意版本的用户文件、版本、配置和 bundle 保持不变，重复升级幂等 |
| PLAN-FNOS-004-T07-03 | FNOS-004-03-AC-03 | 清单校验只允许精确版本 `1.46.1`，禁止 dshmarket 使用 `latest`、`next` 或其他浮动 dist-tag | 构建和 fake CLI 测试能证明命令参数始终带固定版本 |
| PLAN-FNOS-004-T07-04 | FNOS-004-03-AC-04 | 在当前 DSH 客户端验证 dshmarket 的 CLI 安装、跳过已安装和 Web 重启生效；NAS 只验证 FPK 安装链及 `dsh-fnos` | 客户端和 NAS 证据分开保存，不要求其他插件安装到 NAS |

### P0：应用私有 dsh CLI 与网关 Token 收敛

状态：<Badge type="info" text="规划中" />

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-004-T08-01 | FNOS-004-04-AC-01 | 安装回调不再创建 `${TRIM_APPDEST}/app/bin/dsh`，`config/resource` 不再声明 `usr-local-linker`；真实 CLI 固定在 `${TRIM_PKGHOME}/.npm-global/bin/dsh`。构建校验改为拒绝重新引入 wrapper 的产物 | `config/resource` 无 `usr-local-linker`，安装回调无 `CLI_WRAPPER`；构建对重新引入 wrapper 的 FPK 报错失败 |
| PLAN-FNOS-004-T08-02 | FNOS-004-04-AC-03 | 应用包用户环境（`DSH_HOME`、`HOME`、`PATH`、`NPM_CONFIG_CACHE`、`NPM_CONFIG_PREFIX`、`XDG_CONFIG_HOME`）由安装回调与网关各自固定，不再经 wrapper 传递 | 应用包用户下 `dsh --version`、`dsh --help`、`dsh plugin --profile web ...` 输出与真实 CLI 一致 |
| PLAN-FNOS-004-T08-03 | FNOS-004-04-AC-02 | 记录平台约束并据此取消公开入口：fnOS 未向非 root 调用者提供身份切换机制，`runuser`/`su`/`setpriv`/sudo 均不可用，需求禁止 setuid | 不存在由普通用户调用却声称以应用包用户执行的入口；NAS 上逐项记录四种切换机制的实测失败输出 |
| PLAN-FNOS-004-T08-04 | FNOS-004-04-AC-04 | 设置真实 CLI、Node/pnpm、profile 和插件依赖的所有权与最小权限；禁止普通用户修改配置或改变所有权 | 使用 `stat` 和实际写入测试证明非应用用户不能篡改 DSH 配置，应用用户可以正常管理自己的 profile |
| PLAN-FNOS-004-T08-05 | FNOS-004-05-AC-01 | 网关只在首次不带 DSH 会话 Cookie 的首页请求注入 Token，其余请求透传 Cookie；旧 Cookie 被拒绝时用当前 Token 重新换取一次 | iframe 打开首页返回 200 而非 303 循环；上游仅收到一次带 Token 的请求；失效 Cookie 可自动恢复 |

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
| PLAN-FNOS-004-T10-01 | FNOS-004-06-AC-01 | 增加构建前清单校验，统一核对 DSH 版本、native 配置、锁文件、`published-dsh-plugins.json`、捆绑包元数据、Codex 内置规则和 FPK 文件名 | 版本或清单不一致时构建失败；成功产物的版本信息可从清单、文件和 FPK 元数据复核 |
| PLAN-FNOS-004-T10-02 | FNOS-004-06-AC-02 | 审计 install/upgrade callback 的幂等性，确保只处理当前精确清单，不清空 `DSH_HOME`，不自动移除旧插件，并保留升级前运行状态记录 | 新装、升级和重复升级结果一致；用户 profile、凭据、工作区、会话和旧插件保持可读 |
| PLAN-FNOS-004-T10-03 | FNOS-004-06-AC-03 | 在升级变更前保存可恢复的 runtime/profile 元数据；失败时返回非零并恢复旧指针或旧配置，成功后写入完成标记 | 模拟 DSH、pnpm、插件、native 和启动失败后，上一份 FPK 或受支持回滚流程可恢复启动，用户数据不变 |
| PLAN-FNOS-004-T10-04 | FNOS-004-06-AC-04 | 生成发布证据索引，关联 FPK、DSH/native/plugin 版本、安装升级日志、回滚结果及当前客户端/NAS 验收记录 | 任一发布包都能追溯到构建输入和目标环境证据；本地结果不冒充 NAS 验收 |

### P0：用量图标按模型供应商显隐

状态：<Badge type="tip" text="已完成" />

实施提交：`35f0e70 feat(plugin): gate usage icons on the selected model provider`。`AC-01` 经用户在 DSH 客户端浏览器实测通过；`AC-02`/`AC-03`/`AC-04` 只有单元测试与接线断言证据，待补人工复现，见[客户端验收记录](/validation/FNOS-004-08-dsh-client-2026-09-13)。

`FNOS-004-08` 只收敛两个用量图标在 `conversation.input.right` 的挂出条件。两个插件都注册在这个插槽（Codex `id: codex-usage` `order: 1`，CodeBuddy `id: codebuddy-usage` `order: 2`），各自只按自身登录态或偏好判断，选中某一家模型时另一家的图标照样显示。判断依据来自会话投影 `modelSelection` 的 `provider`，和选中模型同源。

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-004-T11-01 | FNOS-004-08-AC-01 | 两个 dock 组件从插槽标准道具读取 `useProjection('modelSelection')`，取 `next ?? lastUsed` 的 `provider`；Codex 仅当 provider 为 `openai-codex` 时挂出，CodeBuddy 仅当 provider 为 `codebuddy` 时挂出（常量沿用各自插件已有的 provider 标识） | 选中 Codex 模型时只有 Codex 图标，选中 CodeBuddy 模型时只有 CodeBuddy 图标，同一轮对话不出现两家图标并存 |
| PLAN-FNOS-004-T11-02 | FNOS-004-08-AC-02 | 显隐条件走 React 订阅路径，选中模型变化立即重算，不缓存首次结果；切换模型不清空草稿、不触发页面刷新 | 在两家模型间来回切换，图标即时跟随，草稿和滚动位置保持不变 |
| PLAN-FNOS-004-T11-03 | FNOS-004-08-AC-03 | 未选模型、投影缺失、provider 为空或为其它供应商时两者都不挂出；判断只依赖供应商，不依赖登录态或用量请求是否成功 | 未选模型或选中第三方模型时两家图标均不出现 |
| PLAN-FNOS-004-T11-04 | FNOS-004-08-AC-04 | CodeBuddy 的 `showUsage` 仍是更前置开关，供应商条件与之取与：偏好关闭时即使选中 CodeBuddy 模型也不显示；Codex 保持现有登录态前置条件不变 | 关闭 `showUsage` 后选中 CodeBuddy 模型仍不显示图标，重新开启即恢复 |
| PLAN-FNOS-004-T11-05 | FNOS-004-08-AC-05 | 图标不挂出时不建立用量轮询（把供应商判断放在挂起轮询的 effect 之前，或让 effect 依赖该条件）；条件变化时已在跑的刷新按现有 cleanup 正常收尾，不额外补一轮请求 | 隐藏状态下无对应插件的后台用量请求；隐藏/显示切换不产生重复定时器 |
| PLAN-FNOS-004-T11-06 | FNOS-004-08-AC-05 | 为两个组件补单元测试：供应商匹配显示、不匹配隐藏、无投影隐藏、CodeBuddy 偏好取与、切换即时生效和不建立轮询 | Codex Auth 与 CodeBuddy 的类型检查、单元测试和构建通过；测试覆盖上述分支 |

### P1：fnOS 原生文件入口

状态：<Badge type="info" text="规划中" />

`FNOS-004-09` 在 fnOS iframe 内遮蔽 DSH 官方「打开应用」按钮（`@deepseek-ai/dsh-client-ui-open-in-app`，插槽 `conversation.session.header.utilities`，`id: open-in-app`，`order: -10`，`priority` 默认 0），改用 fnOS JS SDK 提供文件入口。遮蔽沿用插件已有手法：同 `id`、更低 `priority`（插件现有的 session log 入口即以 `priority: -1` 遮蔽 `dsh-session-log-export`）。上游按钮按编译期常量表 `OPEN_IN_APP_CATALOG` 探测本机应用，Linux 上 `zed` 条目只认 PATH 同名可执行文件，而 fnOS 自带 `/usr/sbin/zed`（ZFS Event Daemon），因此被误判且图标 404；该表不可配置、插件无注册接口、本仓库不提交上游补丁，故在插件侧遮蔽。

| 任务 ID | 对应验收 | 实现内容 | 验收 |
| --- | --- | --- | --- |
| PLAN-FNOS-004-T12-01 | FNOS-004-09-AC-01 | 在 `isEmbeddedFnosFrame()` 为真时注册 `conversation.session.header.utilities`，使用与官方相同的 `id: 'open-in-app'` 和更低的 `priority`（不得同优先级，否则注册抛错） | fnOS iframe 内官方按钮不再渲染；独立浏览器不受影响 |
| PLAN-FNOS-004-T12-02 | FNOS-004-09-AC-02 | 新增 fnOS 文件入口组件，结构与交互对齐官方 `OpenInAppAction`：28px 高的分体按钮，左半执行当前操作（仅图标，15px）、右半 chevron（11px）展开菜单，两半之间有 l4 发丝分隔线并各有 hover；用 `ui-primitives` 的 `Menu`/`Tooltip`，样式数值与官方 CSS 对齐；操作项由数组驱动，便于追加 | 外观、尺寸和交互与官方入口一致；左半点击执行、右半点击展开 |
| PLAN-FNOS-004-T12-03 | FNOS-004-09-AC-03 | 菜单项「文件管理」调用 fnOS SDK 的 `openFileManager(cwd)`，目标路径取当前会话工作目录；复用既有 `createTrimApp()` 与 web carrier 校验 | 选择后 NAS 文件管理器打开并定位到会话工作目录 |
| PLAN-FNOS-004-T12-04 | FNOS-004-09-AC-04 | 工作目录未知或为空时不渲染入口；SDK 未就绪、非 web carrier 或调用失败时给出可见失败提示，不回退到 DSH 原生打开逻辑，不预检插件自己的授权目录列表 | 无工作目录时不出现入口；调用失败有可见提示且不产生未处理异常 |
| PLAN-FNOS-004-T12-05 | FNOS-004-09-AC-06 | 补单元测试：iframe 框架判定、遮蔽注册的 id 与 priority、工作目录判定、SDK 调用与失败分支；更新插件文档 | fnOS 插件 typecheck、测试和构建通过；文档记录入口位置、可用能力和边界 |
| PLAN-FNOS-004-T12-06 | FNOS-004-09-AC-07 / AC-08 | 插件静态资源改由插件自己的路由提供：插件在 DSH 注册 `/fnos-plugins/static/dsh-fnos` 前缀路由，只按固定资源名映射读取包内文件并返回，拒绝路径穿越；网关把 `/fnos-plugins/static` 加入 `builtinPaths`，使浏览器 bridge 自动补上应用前缀 | 客户端以该 URL 引用图标可正常加载；资源缺失返回 404；路由不读取 fnOS 宿主目录，也不放宽既有图片补前缀规则 |
| PLAN-FNOS-004-T12-07 | FNOS-004-09-AC-09 / AC-10 | 对齐官方头部布局：两个条目的 `priority`/`order` 取值集中到 `header-utility-seats.ts`（文件入口 order -10、Session log order 0），并在 `index.ts` 里展开使用；Session log 触发控件改为 28px 圆形纯图标按钮（透明、无边框、15px 字形），菜单项带图标 | 左右顺序为「文件入口在左、Session log 在右」且不随注册先后改变；顺序测试用真实 `SlotCore` 驱动，把 order 打平会使测试失败；按钮不带可见文案与边框 |
| PLAN-FNOS-004-T12-08 | FNOS-004-09-AC-11 | 修复「导出到 NAS」的上游取数：原实现调 `ctx.get('apiProxy').downloads.sessionLog(...)`，而全仓与上游 DSH 都没有该服务的提供方，取值恒为 `undefined`、必然 503。改为宿主向本机 loopback 请求 DSH 自己的 `/api/session.export`，并转发当前浏览器的 `dsh-auth-*` Cookie 完成 browser-session 认证（`includeDescendants=true`），复用既有流式写入与失败清理 | 导出成功写入目标目录并返回 201；绑定 `0.0.0.0` 时回落到 loopback；上游 4xx 与会话不存在可区分；Cookie 缺失或认证失败时能明确报错；不再出现 `ctx.get('apiProxy')` 调用 |
| PLAN-FNOS-004-T12-09 | FNOS-004-07-AC-09 / AC-10 | 内置捆绑插件改为每次安装强制以 FPK 归档覆盖：在 `install_callback` 中新增 `force_install_bundled_plugin`，若 profile 已有该插件则先通过 DSH CLI `remove`，再以同一 spec `add`；不触碰 pnpm 内部状态文件，保留 profile 的依赖与 bundle 记录 | 版本号不变但归档内容变化时，profile 中的副本仍被替换为归档内容；重复执行幂等；CLI 失败时生命周期返回非零并输出错误 |

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

1. 在构建产物检查中确认新 FPK 的发布清单和内置插件目录都包含 Codex，且归档 `package.json` 版本与清单精确版本一致。
2. 在隔离的干净 profile 中执行安装，确认 Codex 按内置 `file:` 归档安装，DSH Web 能正常启动且不出现 `settingsNamespace` 一类接缝错误。
3. 在隔离的老用户 profile 中预置 Codex 凭据、模型配置、workspace 和 bundle，执行升级与重复升级。
4. 重新读取 profile 文件、包目录和日志，确认 Codex 用户数据保持原状，没有卸载、删除或覆盖；包本体校准到清单版本。

### P0：DSH CLI 插件管理流程

1. `install_callback` 先确认 Node.js、应用包用户和运行目录，再将向导选择的 npm 源持久化到 `${DSH_HOME}/.npmrc`，将 pnpm store 路径持久化到 `${DSH_HOME}/.pnpm-store-dir`，随后准备精确版本 DSH 与 `pnpm@11.7.0`。
2. 按 `published-dsh-plugins.json` 读取插件名称和精确版本，对缺失插件执行 `dsh plugin --profile web add <package>@<version>`，对版本变化执行精确 update；缺失 profile 由官方 CLI 自动初始化。
3. 对 dshmarket 先检查 profile 包清单和实际包目录；缺失时执行 `dsh plugin --profile web add dshmarket@1.46.1`，已存在时跳过，不因为版本不同而覆盖。构建阶段不复制 dshmarket，registry 安装失败直接报告错误，不使用 FPK 内置回退包。
4. DSH CLI 在 profile 目录中调用 pnpm，并负责写入依赖和 reconcile `dsh.profile.bundles`；应用不再复制插件、手工初始化 profile 或手工修改 bundle 列表。
5. 新 bundle 只在 Web profile 下次启动时生效；安装/更新完成后按既有流程重启 Web。清单未列出的老插件不执行自动 remove。
6. `upgrade_callback` 复用同一流程，禁止回退到旧脚本；任一命令失败都停止回调并保留 profile 数据。

### P0：应用私有 dsh CLI 运行边界

1. `install_callback` 不创建公开 wrapper，也不在 `config/resource` 注册 `usr-local-linker`；真实 CLI 固定在应用私有 `${TRIM_PKGHOME}/.npm-global/bin/dsh`，所有安装阶段命令由 `run_as_app_user` 以应用包用户执行。
2. 取消公开入口的依据是平台能力：fnOS 上 `runuser` 以非 root 执行报 `may not be used by non-root users`，指定 `--group` 报 `only root can specify alternative groups`，`su` 需要密码，`setpriv` 报 `Operation not permitted`，且需求禁止 setuid 与不受控 sudo。没有可用切换机制时，任何普通用户调用都会以调用者身份运行，违反身份约束，因此不暴露入口。
3. 网关以应用包用户直接启动 `dsh web --no-open`，并自行固定 `DSH_HOME`、`HOME`、`PATH`、`NPM_CONFIG_CACHE`、`NPM_CONFIG_PREFIX`、`NPM_CONFIG_USERCONFIG`、`XDG_CONFIG_HOME`，不依赖调用者环境。
4. 构建校验必须拒绝重新引入 wrapper 的产物：`cmd/install_callback` 不得出现 `CLI_WRAPPER` / `setup_cli_wrapper`，`config/resource` 不得出现 `usr-local-linker` 或 `/bin/dsh`。
5. 真实 CLI 与运行依赖不可被普通用户写入；profile 和插件依赖由应用用户拥有，取消公开入口不改变这些所有权约束。

### P0：内部重启 Token 刷新流程

1. 网关收到内部重启请求后，先将 Token 状态切换为刷新中，使旧 Token 不能再被健康检查或代理鉴权读取；浏览器 iframe 地址保持无 Token。
2. `cmd/main` 停止旧 DSH Web 并启动新进程；`gateway-proxy.mjs` 从本轮启动输出捕获带 Token 的地址，只接受非空、格式有效且属于当前启动轮次的 Token。
3. 新 Token 写入同目录临时文件，完成 flush/close 后通过原子 rename 替换正式 Token 文件，并设置应用包用户所有权和受限权限；确认落盘成功后再更新内存缓存和可用状态。
4. 重启期间的页面和代理请求等待新 Token，或返回带重试语义的恢复页面/响应；Token 捕获、持久化或健康检查超时则返回明确错误，不复用旧 Token 掩盖失败。
5. 新 Token 发布后，首页认证中间件、健康检查和代理请求统一从当前内存/文件状态读取；Token 只附加到网关到 DSH 的内部请求，上游响应中的 Token 跳转会被清理，连续重启不会把较早轮次的 Token 写回。

### P1：发布与升级回滚流程

1. 构建 FPK 前运行清单校验，确认 DSH/native/plugin 版本、Codex 内置规则、dshmarket 固定版本、未注册公开 dsh 入口和 FPK 元数据一致；校验失败不进入发布。
2. 安装或升级前记录当前 runtime 指针、profile 关键元数据和应用版本；不复制或记录 Token、API Key 等敏感内容。
3. 安装/升级只执行当前计划规定的幂等操作；完成 DSH CLI、插件、native 和 Web 启动验证后再写入成功标记。
4. 任一阶段失败时返回非零，保留旧 profile 和用户数据，并按可用的旧 runtime/旧 FPK 回滚入口恢复；不能用清空 profile 的方式“回滚”。
5. 发布后把构建输入、FPK、版本清单、升级日志、回滚结果和客户端/NAS 验收记录关联保存，作为完成 `FNOS-004-06` 的证据。

### P0：插件兼容性回归流程

1. 先在无真实凭据的组合入口运行插件加载、配置校验、卸载和错误路径测试。
2. 在当前 DSH 客户端使用测试凭据或 mock，验证 Codex Auth 模型目录、CodeBuddy 流式响应和 Semi UI 页面行为；这些验证不要求安装到 NAS。
3. 使用当前客户端的真实 DSH Web 入口验证非 fnOS 插件的 bundle、Host 服务、Remote 调用和页面刷新；在 NAS 端单独验证 `dsh-fnos` 的 fnOS API、路径和网关行为，不只验证单独构造的 Context。
4. 发现 API 接缝不匹配时，优先根据 `0.1.5-rc.2` 当前源码和生成类型修复插件，不改上游源码；无法等价迁移时停止发布并记录影响。

### P0：用量图标供应商显隐流程

1. 两个插件分别注册在 `conversation.input.right` 的两个 cell（`codex-usage`、`codebuddy-usage`），互不遮蔽；各自组件在渲染前读取当前会话的 `modelSelection` 投影。
2. 从投影值取 `next ?? lastUsed` 的 `provider`：`next` 是下一次请求将使用的选择，`lastUsed` 兜底，二者都为空表示本会话还没确定模型。
3. 只有 provider 与本插件一致时组件继续渲染；不一致、为空或投影缺失时返回 `null`。这一步在挂起用量轮询的 effect 之前完成，隐藏状态不建立定时器。
4. CodeBuddy 额外保留 `showUsage` 作为更前置开关，供应商条件与该偏好取与；Codex 保留现有的登录态前置条件。这些条件只决定图标挂不挂出，不改动图标样式、tooltip 和点击展开行为。
5. 选中模型变化时投影推送新值，React 订阅触发重算，图标随切换即时增减；已在跑的刷新由现有 cleanup 收尾，不因条件翻转补发请求。

### P1：fnOS 原生文件入口流程

1. 插件只在 `isEmbeddedFnosFrame()` 为真时注册会话头部入口，使用与官方相同的 `id: 'open-in-app'` 和更低的 `priority`。列表插槽的遮蔽按「同 id、不同 priority、低者生效」判定，因此官方条目不再渲染，且不会出现两个入口。
2. 入口读取当前会话的工作目录；工作目录未知或为空时返回 `null`，不渲染锚点。
3. 锚点用 Semi UI 的按钮加图标，外观与官方入口在头部的位置和尺寸一致；点击展开下拉菜单，菜单项由数据驱动，当前只有「文件管理」。
4. 选择菜单项后调用 fnOS JS SDK 的 `openFileManager(cwd)`：复用既有的 `createTrimApp()`，等待 `ready()`，校验 `isWeb` 且非 `isStandaloneWeb` 再调用。目标路径直接交给 fnOS，不做本地授权预检。
5. 调用失败时设置可见错误提示并复位忙碌状态；不抛出未处理异常，不阻塞 DSH，也不回退到 NAS 上不存在的 `xdg-open`。

静态资源的取用链路：客户端以 `/fnos-plugins/static/dsh-fnos/<资源>` 引用图标；浏览器 bridge 判定其为图片资源（该前缀同时在网关 `builtinPaths` 内，非图片资源同样成立）并补上 `/app/fn-deepseek-harness` 前缀；fnOS 把 `/app/fn-deepseek-harness/*` 路由到网关 socket；网关按既有规则剥掉网关前缀后转发给 DSH；DSH 侧由插件注册的同名前缀路由返回包内资源字节。资源随插件包发布，网关与插件都不读取 fnOS 宿主文件系统。

## 数据、权限和错误处理

- 所有应用路径使用 `${TRIM_*}` 环境变量；安装、升级和验证不得写死 NAS 安装目录。
- 版本升级不得删除 `DSH_HOME`、profile、凭据、工作区、会话、授权目录或现有插件配置；安装回调失败时保留旧数据并输出明确错误。
- 依赖安装使用仓库和安装向导约定的 npm registry，锁文件负责可重复解析；网络失败不能静默回退到浮动版本。
- DSH CLI 和 pnpm、profile manifest、node_modules 及配置文件都必须由 DSH 应用包用户可读写；权限不足时直接失败，不通过 root 绕过应用权限。
- 不记录 Token、API Key 或完整凭据；插件管理日志只记录包名、精确版本、命令阶段和错误原因。
- 安装回调与网关都不能信任调用者传入的 DSH_HOME、HOME、PATH、npm/pnpm 前缀或配置目录；需要保留的代理设置必须由应用固定配置或显式白名单提供。
- 平台缺少非 root 可用的身份切换机制时，不暴露需要切换身份的公开入口；不得静默降级为调用者身份，也不得改用 root 绕过应用权限。
- Token 刷新采用“失效旧状态 → 捕获新 Token → 原子持久化 → 发布内存状态”的顺序；任何中间步骤失败都不能继续对外宣称 Web 已恢复，也不能回退使用旧 Token。
- Token 文件、临时文件和锁文件都必须位于应用运行目录，由应用包用户拥有；日志只能记录 Token 轮次和状态，不能记录 Token 内容。
- runtime 指针、profile 快照和升级完成标记不能包含凭据；回滚只恢复版本和配置元数据，不删除用户数据。
- Native 依赖准备失败、补丁锚点不唯一、Node ABI 不匹配和插件 API 不匹配分别记录错误，不以跳过检查的方式生成 FPK。
- Host 与 Client 仍遵守 DSH Remote、附件持久化、会话可回放和插件生命周期约束；测试覆盖重复加载、卸载和异常退出清理。
- 用量图标的显隐只读会话投影，不改写会话数据，也不新增会话事件；投影缺失就当作不显示，不去猜供应商，也不拿登录态或用量请求结果顶替供应商判断。
- fnOS 文件入口的目标路径来自会话工作目录，只读会话状态，不改写会话数据、不新增会话事件；工作目录缺失时按「不渲染」处理。
- 插件静态资源只从插件包内目录读取，不读取也不依赖 fnOS 宿主的静态资源布局；请求路径只用于匹配固定资源名，未命中返回 404，不把请求路径拼进文件系统路径。
- 文件入口不预检插件展示的授权目录列表：该列表用于浏览和选择，可能滞后于 fnOS ACL 状态，预检会误拒合法路径；是否允许由 fnOS 判断。调用失败只影响本次操作，不写入持久化状态，也不移除入口。
- 供应商标识以各插件已有的常量或 provider 注册名为准，不在 dock 组件里硬编码第二份字符串；未匹配任何已注册供应商时不显示任何图标。

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
| 跨用户调用 | 由普通用户调用的入口无法切换身份，会以调用者身份运行并污染 profile 权限 | 不暴露该入口；需要 CLI 时由应用包用户在应用私有路径直接调用，并用 `id`、环境和文件所有权验证 |
| 公开入口篡改 | 入口或其依赖可写时，调用者可替换真实 CLI 或修改 DSH 配置 | 不注册公开入口；真实 CLI、Node/pnpm 和配置由受控所有者维护，非应用用户无写权限 |
| Token 竞态 | 重启时旧缓存、旧文件和新进程输出可能交错，导致页面继续携带旧 Token | 使用重启轮次、锁、原子文件替换和刷新中状态；并发请求只等待新 Token 或返回可恢复响应 |
| Token 持久化 | 异步写文件可能尚未完成就更新内存，或留下半截文件 | 写临时文件并完成持久化后再 rename 和发布内存值；写入失败直接进入错误状态 |
| 投影可用性 | `modelSelection` 投影缺失或尚未送达时读不到选中模型，可能导致图标该显示时不显示 | 缺失一律按不显示处理并保留其余前置条件；不缓存首次结果，投影到达后随即重算 |
| 供应商标识漂移 | dock 组件里再写一份 provider 字符串，后续改名会出现两边不一致 | 复用各插件已有的 provider 常量或注册名，测试断言显隐与常量同源 |
| 轮询残留 | 图标隐藏后仍保留定时器，会在看不见的情况下继续请求用量接口 | 供应商判断置于挂起轮询之前或纳入 effect 依赖，隐藏状态不建立定时器并用测试断言 |
| 遮蔽失效 | 与官方条目同 `priority` 会让注册直接抛错，插件整体加载失败 | 使用更低 `priority` 并写断言固定该值；只影响 fnOS iframe，独立浏览器不注册 |
| 上游变更 | 官方 `id`、`order` 或插槽名变化会让遮蔽目标失配 | 断言固定被遮蔽的 `id` 与插槽名，上游变更时测试先失败而不是静默出现两个入口 |
| SDK 差异 | `openFileManager` 在非 web carrier 或旧宿主上不存在 | 沿用既有 `createTrimApp()` 与 `isWeb`/`isStandaloneWeb` 校验，失败给出可见提示而不回退到 NAS 上不存在的 `xdg-open` |
| 静态资源泄露路径 | 插件静态路由若直接拼接请求路径，可能被路径穿越读取包外文件 | 只按固定资源名映射到已知文件，未命中即 404，不拼接用户输入 |
| 上游取数认证信息缺失 | 原实现调用的 `apiProxy` 全仓与上游都没有提供方，改为 loopback 后若不转发浏览器 Cookie，DSH browser-session 仍返回 401 | 回源请求 DSH 已注册的 `/api/session.export` 时转发当前请求的 `dsh-auth-*` Cookie；loopback 只免 Host/Origin 信任检查，不免 browser-session 认证；行为测试覆盖 Cookie 转发、loopback 回落与非 2xx 透传 |
| 内置插件同版本号不更新 | pnpm 对相同 spec 只看 `node_modules/.modules.yaml` 与 lockfile integrity；归档内容变了也报 `Already up to date`，安装后仍跑旧代码（`install --force`、`--fix-lockfile`、`update`、`rebuild`、`store prune` 实测均无效） | 捆绑插件不比较版本，覆盖前通过 DSH CLI `remove` 再以同一 spec `add`；测试断言 remove→add 顺序，并用真实 pnpm 端到端验证 |
| CLI 覆盖操作失败 | remove 成功后 add 失败会让插件暂时缺失 | 生命周期立即返回非零，保留 profile 依赖/bundle 记录，下一次安装可重新 add；错误日志包含插件名和归档路径 |
| 头部条目顺序静默反转 | 两个条目的 `priority`/`order` 一旦打平，位置改由注册顺序决定、与官方相反，且不会报错 | 取值集中在 `header-utility-seats.ts` 并由测试用真实 `SlotCore` 注册后断言最终顺序；`index.ts` 必须以展开方式使用该座位（契约测试断言展开写法，防止改回硬编码） |
| 资源未随包发布 | `package.json` 的 `files` 只含 `lib`，构建若不拷贝资源则运行时 404 | 在 node 构建的 `onSuccess` 中把资源拷入 `lib/assets/`，并用测试断言产物中存在该文件 |

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
- 在同一入口验证用量图标的供应商显隐：分别选中 Codex 与 CodeBuddy 模型，确认只有对应图标出现；关闭 CodeBuddy `showUsage` 后选中其模型仍不显示；两处切换过程不刷新页面、不丢草稿。
- 保存客户端版本、启动命令、插件加载日志、测试结果和失败场景证据；需要外部服务时使用测试凭据或 mock，不写入真实密钥。
- fnOS 原生文件入口的遮蔽与外观在独立浏览器中无法验证：`isEmbeddedFnosFrame()` 为真才会注册，且 `openFileManager` 需要 fnOS 宿主桥接。该功能的验收在真实 fnOS NAS 的 iframe 内完成，本地只覆盖 iframe 判定、注册参数、工作目录判定和 SDK 调用分支的单元测试，不把本地结果当 NAS 结论。

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
| P0 Codex 默认捆绑恢复 | <Badge type="info" text="规划中" /> | 新 FPK 内置并安装与 `0.1.5-rc.2` 适配的 Codex；老用户升级不卸载、不删除、不覆盖已有用户数据 |
| P0 DSH CLI 插件管理 | <Badge type="info" text="规划中" /> | 固定 DSH/pnpm、使用官方 CLI 自动初始化 profile、add/update 和 bundle 写回；移除旧插件脚本及重复初始化逻辑 |
| P0 dshmarket 固定安装 | <Badge type="info" text="规划中" /> | 缺失时通过 DSH CLI 安装 `dshmarket@1.46.1`，已存在时跳过并保留原版本 |
| P0 应用私有 dsh CLI | <Badge type="info" text="规划中" /> | 不注册公开入口，固定应用包用户环境并保护真实 CLI 与配置权限 |
| P0 内部重启 Token 刷新 | <Badge type="info" text="规划中" /> | 重启期间失效旧 Token，捕获并原子持久化新 Token，代理请求等待新状态 |
| P1 发布升级回滚一致性 | <Badge type="info" text="规划中" /> | 构建前版本门禁、升级幂等、失败恢复和发布证据可追溯 |
| P0 FPK 构建 | <Badge type="info" text="规划中" /> | FPK 构建成功，安装后 DSH 版本和启动入口正确 |
| P0 用量图标按模型供应商显隐 | <Badge type="tip" text="已完成" /> | 两个用量图标只在选中对应供应商模型时挂出，切换即时生效且隐藏时不轮询 |
| P1 fnOS 原生文件入口 | <Badge type="info" text="规划中" /> | fnOS iframe 内遮蔽官方「打开应用」，用 fnOS JS SDK 提供文件管理器入口；静态资源走插件自有前缀 |
| P1 当前 DSH 客户端验证 | <Badge type="info" text="规划中" /> | Codex Auth、CodeBuddy、Semi UI 和共享包完成组合入口与关键行为验证 |
| P1 fnOS NAS 验收 | <Badge type="info" text="规划中" /> | Web、网关、`dsh-fnos`、Codex 老用户保留、升级数据保留和失败路径均有 NAS 证据 |

本计划汇总 `FNOS-004-01` 至 `FNOS-004-09`。其中 `FNOS-004-06`以发布、升级和回滚一致性门禁形式实施，不新增独立运行时能力；`FNOS-004-08` 只收敛两个用量图标在输入框 dock 的挂出条件。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-12 | 建立 PLAN-FNOS-004 | 仅将 `FNOS-004-01` DSH 与插件适配 0.1.5-rc.2 纳入当前实施计划，明确依赖基线、插件迁移、FPK 构建和 NAS 验收边界 |
| 2026-09-12 | 固定上游适配依据 | 确认本地官方 Harness checkout 已切到 `dsh-v0.1.5-rc.2`，后续以 commit `fb2c4b9e698e30edb738bca4cf0618587db7d203` 的源码和生成类型为准 |
| 2026-09-12 | 纳入 FNOS-004-02 | 增加 Codex 默认捆绑策略、新用户/老用户升级差异、非破坏性安装回归和 FPK/NAS 验收任务 |
| 2026-09-13 | 改为恢复 Codex 默认捆绑 | 原「移除 Codex 默认捆绑」被证伪：registry 上 Codex 的 `latest`/`rc` 基线过旧，安装后 DSH Web 因 `settingsNamespace` 缺失启动失败；改为 FPK 内置 Codex 归档并按清单精确版本安装，保留非破坏性升级约束 |
| 2026-09-12 | 纳入 FNOS-004-07 | 将 FPK 插件管理迁移到目标 tag 提供的 DSH CLI，固定 DSH/pnpm/插件版本并移除自定义安装脚本 |
| 2026-09-12 | 纳入 FNOS-004-03 | 通过 DSH CLI 安装固定版本 `dshmarket@1.46.1`，已安装时跳过且不覆盖用户插件 |
| 2026-09-12 | 纳入 FNOS-004-04 | 增加应用 bin 中的 dsh CLI wrapper，固定运行环境并强制真实 CLI 使用应用包用户权限 |
| 2026-09-13 | 修订 FNOS-004-04 | NAS 复现 `runuser: only root can specify alternative groups`；平台无非 root 身份切换机制，改为不注册公开 `dsh` 入口，并在构建校验中拒绝重新引入 wrapper |
| 2026-09-12 | 纳入 FNOS-004-05 | 增加内部重启 Token 的失效、捕获、原子持久化、代理等待和 NAS 并发回归任务 |
| 2026-09-12 | 纳入 FNOS-004-06 | 增加构建版本门禁、升级幂等、失败恢复、回滚入口和发布证据追踪任务 |
| 2026-09-13 | 统一插件发布版本 | 四个运行时插件发布版本由 `0.1.5-rc.2.4` 改为 `0.1.5-rc.2`，与 DSH 运行时基线同号；同步 `package.json`、发布清单和文档，`dshPluginApi.version` 仍单独承载兼容基线 |
| 2026-09-13 | 纳入 FNOS-004-08 | 增加用量图标按选中模型供应商显隐计划：读取 `modelSelection` 投影的 `provider`，Codex 与 CodeBuddy 各自只在选中本家模型时挂出，切换即时生效，隐藏时不建立用量轮询 |
| 2026-09-13 | 完成 FNOS-004-08 | `T11-01` 至 `T11-06` 落地（`35f0e70`）：新增 `@deepseek-ai/dsh-client-ui-session` 类型依赖与座位标准套件导入，`CODEX_PROVIDER` 移至 `contracts/`，显隐合取收敛为纯函数；`AC-01` 经 DSH 客户端浏览器实测通过，`AC-02`/`AC-03`/`AC-04` 待补人工复现 |
| 2026-09-13 | 纳入 FNOS-004-09 | 增加 fnOS 原生文件入口计划（`T12-01` 至 `T12-05`）：在 fnOS iframe 内以同 `id`、更低 `priority` 遮蔽官方「打开应用」，用 Semi UI 还原锚点与下拉菜单，并以 fnOS JS SDK 的 `openFileManager` 打开会话工作目录；预览与编辑器因只支持文件路径而不在本轮范围 |
| 2026-09-13 | 补充 FNOS-004-09 静态资源方案 | 新增 `T12-06`：插件静态资源不再内联，改由插件注册 `/fnos-plugins/static/dsh-fnos` 路由返回包内资源，网关把 `/fnos-plugins/static` 加入内置前缀；不读取 fnOS 宿主静态目录，也不放宽既有图片补前缀规则 |
| 2026-09-13 | 补充 FNOS-004-09 头部布局任务 | 新增 `T12-07`：对齐官方左右顺序并把顺序取值集中可测；Session log 改为纯图标按钮 |
| 2026-09-13 | 修复 FNOS-004-09「导出到 NAS」上游取数 | 新增 `T12-08`：数据源由不存在的 `apiProxy` 注入服务改为回源 `/api/session.export` |
| 2026-09-13 | 新增 FNOS-004-07 内置插件强制覆盖 | 新增 `T12-09`：捆绑插件每次安装按 FPK 归档覆盖（不比较版本），并约束删除路径的推导与校验 |
