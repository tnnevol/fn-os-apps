---
id: FNOS-004
title: FNOS-004 DSH 0.1.5-rc.2 适配与 FPK 运行修复
description: 将 DSH 应用和插件适配到 0.1.5-rc.2，调整 FPK 插件捆绑、统一使用 dsh CLI 管理插件，并修复内部重启后的代理 Token 刷新。
status: completed
owner: tnnevol
targetVersion: 5.3.1
lastVerified: 2026-09-14
---

# FNOS-004 DSH 0.1.5-rc.2 适配与 FPK 运行修复

| 项目 | 内容 |
| --- | --- |
| 需求编号 | FNOS-004 |
| 提出日期 | 2026-09-12 |
| 需求状态 | <Badge type="tip" text="已完成" /> |
| 关联计划 | [PLAN-FNOS-004 DSH 0.1.5-rc.2 适配与 FPK 运行修复](/plans/PLAN-FNOS-004-dsh-015-rc2-adaptation) |

## 需求背景与目标

当前 DSH 运行时、插件兼容性基线和 FPK 构建链以 `0.1.2-rc.1` 为主。DSH 上游已发布 `0.1.5-rc.2`，本仓库需要同步适配客户端输入、命令贡献、附件、LLM 流式 API 和 `pi-ai` 等接缝。

这次适配还要处理 FPK 的插件来源和运行方式：Codex 插件作为新安装的默认捆绑项，由 FPK 内置归档安装，不依赖 registry 上的浮动版本；三方市场插件 `dshmarket` 固定版本写入发布清单，但不进入 FPK，安装阶段通过 DSH CLI 单独安装且不能覆盖已安装用户的版本；应用需要提供可直接调用的 `dsh` CLI；DSH Web 内部重启后，代理必须立即使用新 Token。

### 适配依据

本需求的 DSH 版本、类型和插件接缝以本地官方 Harness checkout 为准：

- 本地仓库：`~/workspace/fork-pj/deepseek-harness`
- 当前 tag：`dsh-v0.1.5-rc.2`
- 当前 commit：`fb2c4b9e698e30edb738bca4cf0618587db7d203`
- 源码包版本：`@deepseek-ai/dsh-root@0.1.5-rc.2`
- 包管理器：`pnpm@11.7.0`

该 checkout 已切到目标 tag，后续适配以此 tag 的源码、生成类型、CLI 文档和构建结果为准；线上仓库只作为补充链接，不以主分支漂移内容替代本地 tag 证据。

## 需求目标

- DSH 应用和仓库内插件适配 `0.1.5-rc.2`，相关依赖、兼容性声明、FPK 构建配置和文档保持一致。
- 新用户的 FPK 内置并安装与 `0.1.5-rc.2` 兼容的 Codex 插件；老用户已有的 Codex 凭据、模型配置、workspace 和授权目录保持不变，不执行卸载或清理。不内置的方案已被证伪：registry 上的 Codex 版本基线过旧，安装后会让 DSH Web 启动失败。
- 在发布清单中固定 `dshmarket@1.46.1`，但不将其复制到 FPK；新用户安装时通过 DSH CLI 安装固定版本，检测到用户已经安装 `dshmarket` 时跳过安装，不覆盖、降级或强制替换用户现有版本。
- FPK 不注册公开的 `dsh` 系统命令：安装回调不生成 `app/bin/dsh` wrapper，`config/resource` 不声明 `usr-local-linker` 的 `dsh` 入口。飞牛 fnOS 未向非 root 调用者提供可用的身份切换机制（`runuser` 以非 root 执行时报 `may not be used by non-root users`，指定 `--group` 时报 `only root can specify alternative groups`，`su` 需要密码，`setpriv` 返回 `Operation not permitted`），而本需求禁止依赖 setuid 或不受控的 sudo，因此由普通用户调用的 wrapper 无法保证以应用包用户身份执行。真实 CLI 仍固定安装在 `${TRIM_PKGHOME}/.npm-global/bin/dsh`，由管理员在应用包用户下直接调用。
- DSH Web 内部重启捕获新 Token 后，网关代理、页面跳转和后续请求立即使用新 Token；旧 Token 不能继续把页面导向未授权状态。
- 保留 FNOS-001～FNOS-003 已验收的网关、授权目录、NAS 引用、插件加载和用户数据行为。
- fnOS iframe 内的会话头部由插件提供文件入口，替代 DSH 官方「打开应用」按钮；该按钮按编译期常量表探测本机应用，在 fnOS 上会把系统的 ZFS Event Daemon（`/usr/sbin/zed`）误判为 Zed 编辑器，且取不到对应图标，菜单里因此出现一个点了也打不开编辑器的条目。替代入口用 fnOS JS SDK 打开 NAS 文件管理器并定位到当前会话工作目录。
- fnOS 插件自带的前端资源由插件自己提供，不内联进客户端 bundle：插件在 DSH 注册 `/fnos-plugins/static/<插件>/<资源>` 前缀路由返回包内资源，网关把 `/fnos-plugins` 列入内置前缀以便浏览器 bridge 补上应用前缀。资源归插件包所有，不读取宿主文件系统，也不依赖宿主未公开的静态路由。
- FPK 内置插件在 DSH 上的浏览器同级 HTTP 路由同样列入网关内置前缀，随 FPK 一起开箱可用：CodeBuddy 的 RPC 频道 `/codebuddy` 与 `/api`、`/plugins`、`/open-in-app` 同级，不需要用户在三方插件 API URL 反代配置里手工登记。

## 涉及范围

| 模块 | 目录或入口 | 职责 |
| --- | --- | --- |
| 依赖基线 | `pnpm-workspace.yaml`、根 `pnpm-lock.yaml` | 声明并锁定 DSH 0.1.5-rc.2 依赖 |
| fnOS 插件 | `plugins/dsh-fnos-plugin`、`compatibility.json` | 适配输入、命令、插槽、主题和 NAS 接缝；在 fnOS iframe 内遮蔽 DSH 官方「打开应用」并提供 fnOS 原生文件入口 |
| Codex Auth 插件 | `plugins/dsh-codex-auth-plugin`、`compatibility.json` | 适配 `dsh-llm-pi-ai`、模型和附件接缝；作为内置插件随 FPK 分发，同时保留老用户已有数据 |
| CodeBuddy 插件 | `plugins/dsh-codebuddy-plugin`、`compatibility.json` | 适配 LLM 流式、附件和多模态序列化接缝 |
| Semi UI 插件 | `packages/dsh-semi-ui`、`plugins/dsh-semi-ui-showcase-plugin` | 适配共享 UI 组件和客户端插槽 |
| FPK 应用 | `apps/fn-deepseek-harness/{manifest,cmd,app,config}` | DSH 版本、插件清单、安装/升级回调、bin 中的 CLI wrapper 和权限 |
| 市场插件 | `published-dsh-plugins.json` | 固定 `dshmarket` 版本，构建不内置，按已安装状态决定是否通过 DSH CLI 安装 |
| 网关代理 | `packages/fnos-gateway`、DSH Web 启停流程 | 刷新、持久化和使用 Web Token；为 fnOS 插件的静态资源与 FPK 内置插件的浏览器同级路由（如 `/codebuddy`）提供内置前缀 |
| 构建与发布 | `.github/config/`、`.github/workflows/`、`tooling/fn-os-apps-cli` | 生成包含正确插件和版本信息的 FPK |

## 功能列表

| 编号 | 优先级 | 功能 | 用户行为 | 状态 |
| --- | --- | --- | --- | --- |
| FNOS-004-01 | P0 | DSH 与插件适配 0.1.5-rc.2 | FPK 安装后应用私有 `dsh --version` 为 `0.1.5-rc.2`；DSH Web 和仓库内插件正常加载 | <Badge type="tip" text="已完成" /> |
| FNOS-004-02 | P0 | 恢复 Codex 与 CodeBuddy 默认捆绑 | 新用户安装 FPK 后即从内置归档安装与 `0.1.5-rc.2` 兼容的 Codex、CodeBuddy 包；升级老用户时按精确版本校准，不删除用户凭据和配置 | <Badge type="tip" text="已完成" /> |
| FNOS-004-03 | P0 | 固定并兼容安装 dshmarket | 新用户获得 `dshmarket@1.46.1`；已安装用户跳过安装并保留现有版本和配置 | <Badge type="tip" text="已完成" /> |
| FNOS-004-04 | P0 | 安装私有 dsh CLI 且不暴露系统命令 | 真实 CLI 固定在应用私有目录并由应用包用户运行；FPK 不注册公开 `dsh` 入口，平台无 root 时 wrapper 无法保证应用用户身份 | <Badge type="tip" text="已完成" /> |
| FNOS-004-05 | P0 | 内部重启后刷新代理 Token | DSH Web 重启并生成新 Token 后，页面跳转和代理请求不再使用旧 Token，不出现未授权页面 | <Badge type="tip" text="已完成" /> |
| FNOS-004-06 | P1 | 升级、回滚与发布清单一致 | FPK 升级/回滚不丢失用户数据，构建产物、插件包和发布清单可追溯 | <Badge type="tip" text="已完成" /> |
| FNOS-004-07 | P0 | 使用 DSH CLI 管理 FPK 插件 | 安装、更新和显式移除统一通过 `dsh plugin --profile web`，不再调用应用自定义插件脚本 | <Badge type="tip" text="已完成" /> |
| FNOS-004-08 | P0 | 按所选模型供应商显隐用量图标 | 选中 Codex 模型时输入框只显示 Codex 用量图标，选中 CodeBuddy 模型时只显示 CodeBuddy 图标；切换模型即时变化 | <Badge type="tip" text="已完成" /> |
| FNOS-004-09 | P1 | fnOS 原生文件入口 | 在 fnOS iframe 内遮蔽 DSH 官方「打开应用」按钮，改由插件用 fnOS JS SDK 提供文件入口，可打开 NAS 文件管理器并定位到当前会话工作目录 | <Badge type="tip" text="已完成" /> |

## 交互和行为约束

- `0.1.5-rc.2` 是本需求的唯一 DSH 运行时基线。catalog、`compatibility.json`、`DSH_VERSION`、native 配置、FPK 安装回调和发布文档不得继续引用旧基线作为当前值。
- 安装回调必须先检查应用私有全局目录中的 `pnpm@11.7.0` 和 `@deepseek-ai/dsh@0.1.5-rc.2`；可执行文件和实际 CLI 版本均精确匹配时跳过对应安装，仅对缺失、不可执行或版本不匹配的依赖执行安装。
- 四个运行时插件（`@tnnevol/dsh-codex-auth`、`@tnnevol/dsh-codebuddy`、`@tnnevol/dsh-fnos`、`@tnnevol/dsh-semi-ui-showcase`）的发布版本统一为 `0.1.5-rc.2`，与 DSH 运行时基线保持同一版本号，便于用户和安装器对照；`dshPluginApi.version` 仍单独声明运行时兼容基线，二者分别由 `compatibility.json` 和 `package.json` 承载。此前的 `0.1.5-rc.2.4` 未发布到 registry，改版不涉及撤回或重发。
- 插件版本号与 DSH 运行时版本号相同不代表插件可以独立于 `compatibility.json` 演进：后续任一插件升级都必须同时更新 `package.json`、`compatibility.json`、发布清单和本节版本约束。
- 插件 `peerDependencies` 使用统一 catalog，不在各插件中重复硬编码 DSH 版本。
- FPK 清单中的所有自动安装插件必须填写精确的 `version`，捆绑包的 `package.json` 版本必须与清单一致；禁止使用 `latest`、`next` 或其他浮动 `distTag`。
- `--bundle-dsh-plugins` 只将仓库中可解析的本地插件制成带精确版本的 npm 包归档并打入 FPK；安装时通过 DSH CLI 的 `file:` 包 spec 安装，确保插件运行依赖能由 pnpm 安装和解析，不得以 `link:` 直接引用 FPK 插件目录。升级时须修复已经按旧方式安装的同版本 `link:` 插件。清单中的三方插件不得因为出现在 `plugins` 或 `bundled` 中而被内置，安装回调仍须通过 DSH CLI 单独安装。`bundled` 中的 dshmarket 仅用于固定安装版本，不提供 FPK 回退包。
- FPK 内置本地插件时，安装回调使用 DSH CLI 指向内置包路径完成 profile 管理；不内置的三方插件继续使用精确版本包名安装，不因本地内置逻辑被跳过。
- 安装/升级前从 Web profile 的 pnpm 模块元数据读取既有 `storeDir`，并持久化到 `${DSH_HOME}/.pnpm-store-dir`，通过 `PNPM_CONFIG_STORE_DIR` 提供给 pnpm；不得让 pnpm 因 `@apphome` 与 `@appshare` 的默认路径变化拒绝复用既有依赖，也不得把 pnpm 专用 `store-dir` 写入 npm 的 `.npmrc`。
- `PNPM_CONFIG_STORE_DIR` 必须在**运行期**同样生效，而不只是安装期。DSH Web 会在 profile 目录中调用 pnpm 完成插件安装与三方市场更新；pnpm 把建库时的 store 固定进 `node_modules/.modules.yaml`，一旦解析出的 store 变化就以 `ERR_PNPM_UNEXPECTED_STORE` 拒绝所有安装与卸载，三方应用商店报「更新失败，且更新前的构建未能验证恢复」。网关启动 Web 时必须从 `${DSH_HOME}/.pnpm-store-dir` 读取该路径并注入子进程环境；值缺失、为空或非绝对路径时不得猜测，且必须清除继承来的同名变量。npm 的 `.npmrc` 仍不得写入 `store-dir`。
- 新 FPK 的 `published-dsh-plugins.json` 和内置插件目录必须包含与 `0.1.5-rc.2` 适配的 Codex 插件，安装阶段通过 DSH CLI 以内置 `file:` 归档安装。不再采用“移除 Codex 默认捆绑”的方案：上游 registry 提供的 `latest`/`rc` 版本分别基于 `0.1.0-rc.7` 和 `0.1.2-rc.1`，在 `0.1.5-rc.2` 上会因 `@deepseek-ai/dsh-settings` 不再导出 `settingsNamespace` 而让 DSH Web 启动失败，因此不内置会把不兼容版本直接暴露给用户。
- Codex 插件完成 `0.1.5-rc.2` 兼容性适配，并作为内置插件随 FPK 分发；安装/升级使用清单中的精确版本，不通过 registry 浮动版本获取。
- 安装/升级不得删除或覆盖用户已有的 Codex 凭据、模型配置、工作区、授权目录或插件配置；已安装版本与清单不一致时按内置归档校准到清单版本。
- `dshmarket` 的包名为 `dshmarket`，版本固定为 `1.46.1`。固定版本来自需求建立时的上游包信息，后续升级必须显式修改本需求和发布清单，不得随 registry 最新版本漂移。[上游项目](https://github.com/dsh-market/dsh-market)
- 新用户安装时，只有在目标 profile 中未发现 `dshmarket` 时才通过 registry 安装清单指定的固定版本。已安装判断至少覆盖 profile 的包清单和实际包目录；已存在但版本不同也视为已安装，不得自动覆盖、降级或删除。
- 市场插件的安装结果要加入 DSH Web profile 的 bundle 配置；如果用户已有该插件，保持其现有 bundle 配置，不因跳过安装而重置用户选择。
- FPK 不注册公开的 `dsh` 系统命令，也不生成 `app/bin/dsh` wrapper。此前设计依赖“安装时生成的 wrapper 通过平台用户切换机制以应用包用户执行真实 CLI”，但飞牛 fnOS 未向非 root 调用者提供可用的切换机制，而本需求又禁止 setuid 与不受控 sudo，该前提不成立：普通用户调用时真实 CLI 只能以调用者身份运行，违背“不能让真实 dsh 进程继承调用者身份”的约束。因此按“无法安全切换即不暴露入口”处理，真实 CLI 保留在应用私有目录。
- `cmd/main` 只启动 fnOS 网关；网关以应用包用户直接运行应用私有目录中的真实 DSH CLI 来启动 `dsh web --no-open`，并固定 Web 子进程环境、捕获本轮启动 URL 中的 Token，在 Token 原子持久化后供页面、HTTP、SSE 和 WebSocket 代理使用。
- 网关启动 Web 前检查 `${DSH_HOME}/.credentials.yaml.lock`：锁中 PID 已失效时以原子 rename 后清理遗留锁；锁持有者仍存活时只等待其释放，超时则拒绝本次 Web 启动，不删除活跃写入者的锁。锁内容无效时保留原文件并返回可诊断错误。
- 浏览器 iframe 地址必须始终不带 Token。仅当首页请求不携带 DSH 会话 Cookie 时，网关才把当前 Token 注入上游以换取会话 Cookie；其他上游请求只透传 Cookie。DSH 对任何携带 Token 的首页请求都会返回 303 到干净路径，若对每个代理请求都注入 Token，会造成“重定向次数过多”的不可恢复循环。若旧 Cookie 已被上游拒绝，网关必须能用当前 Token 重新换取一次，而不是把 401 直接抛给浏览器。
- 真实 CLI、Node/pnpm 运行文件和 profile 数据的所有权与权限必须阻止非应用用户修改；应用包用户管理自己的 profile，不因缺少公开入口而放宽文件权限。
- 插件管理生命周期顺序固定为：准备 Node.js → 检查/按需安装精确版本 DSH → 检查/按需准备 `pnpm@11.7.0` → 执行 `dsh plugin --profile web` 的 add/update 操作。缺失 profile 由官方 CLI 首次执行时自动初始化，应用不重复初始化或覆盖 profile；`cmd/main` 只启动网关，Web 进程由网关启动。
- npm 源配置统一持久化到 `${DSH_HOME}/.npmrc`，并通过 `NPM_CONFIG_USERCONFIG` 供 npm、pnpm 和 DSH CLI 读取；安装、更新和插件管理命令不再临时覆盖该配置。
- FPK 不再调用 `app/scripts/install-dsh-plugins.mjs`，也不再自行复制插件、执行 npm 直装或手工重建 `dsh.profile.bundles`；依赖和 bundle 列表由目标 tag 提供的 DSH CLI/`pnpm` 维护。
- `dsh plugin --profile web add <package>@<version>` 用于安装清单中的缺失插件，版本变更使用带精确版本的 update/add 流程；`remove <package>` 只允许由明确的用户移除操作触发，不能因为新清单缺少旧插件而自动执行。
- 插件清单和捆绑包只允许精确版本，自动命令不得使用 `latest`、`next` 或其他浮动 dist-tag；捆绑包的 `package.json` 版本必须与清单一致。Bundle 写回后，应用必须按 DSH 规则重启 Web profile 才能生效。
- FPK 运行环境内的权限修复应在安装/升级流程中可重复执行，不改变用户 profile 数据的内容；权限不足时要给出明确日志并让安装失败，而不是留下不可执行的半安装状态。
- 网关不得长期复用内部重启前的缓存 Token。新 Token 写入后，Token 文件、内存缓存、代理鉴权和页面跳转要按同一更新顺序生效；重启窗口内的请求应等待新的有效 Token 或返回可恢复结果，不得静默转发旧 Token。
- 旧 Token 在新 Token 生效后必须失效，Token 文件只允许 DSH 应用包用户访问。内部重启、首次启动、异常退出后恢复和并发请求都要覆盖测试。
- 已确认的上游破坏性变更必须在插件侧完成等价迁移，包括：
  - `InputActions`/`InputState`/`SessionInput` 的图片 API 改为附件 API：`addAttachments`、`removeAttachment`、`pruneAttachments`、`attachmentIds` 和 `claim.attachments`。
  - `SubmitImageAttachment`/`SubmitEnvelope.images` 改为附件对应类型和字段。
  - `CommandContribution.description` 改为本地化取值函数。
  - `dsh-llm` 的 `assistant-stream`、系统提示和文件块导出，以及 `GenerateOptions.system` 的一次性调用语义。
  - `dsh-llm-pi-ai` 的可选 `piProvider`、`catalogError`/`modelErrors` 和 `pi-ai` 0.85.1 适配。
  - `dsh-attachment` 的 `admitEncodedFile`、文件保存/读取接口和错误类型，以及 primitives/layout/session 的移除与替换导出。
- 上游适配只修改本仓库插件和构建链，不提交上游源码补丁。若某个接缝无法等价迁移，必须先记录用户可见影响和回滚方式。
- 会话输入框右侧 dock 的用量进度图标只在当前选中模型的供应商属于对应插件时才显示：选中 Codex 模型只显示 Codex 图标，选中 CodeBuddy 模型只显示 CodeBuddy 图标，两家图标不会在同一轮对话里同时出现。选中其它供应商模型或选中模型未知时不显示任何供应商图标。显隐以会话快照里的选中模型及其供应商为准，不是按插件是否登录或是否取到用量数据判断。
- 切换选中模型要即时生效：从 Codex 模型切到 CodeBuddy 模型时 Codex 图标消失、CodeBuddy 图标出现，不刷新页面、不丢失已输入草稿。CodeBuddy 原有的 `showUsage` 偏好仍是更前置的开关，供应商判断是在该偏好之上的额外条件，两者取与。
- 图标隐藏时对应插件不应为看不见的图标继续后台轮询用量；显隐状态变化后已在跑的刷新任务按现有生命周期正常收尾即可。图标样式、tooltip 和点击展开行为不变，只在「是否挂出」这一层加条件。
- fnOS iframe 内的会话头部不再使用 DSH 官方「打开应用」按钮。该按钮按编译期常量表 `OPEN_IN_APP_CATALOG` 探测本机应用，其 `zed` 条目在 Linux 上只以「PATH 里存在名为 `zed` 的可执行文件」为判定依据，而 fnOS 基于 Debian 且启用 ZFS，系统自带 `/usr/sbin/zed`（ZFS Event Daemon，`zfs-zed.service`），因此被误判为 Zed 编辑器；同时图标提取要求同名 desktop 条目 `dev.zed.Zed.desktop`，该文件不存在，图标路由返回 404，菜单里因此出现一个只有通用字形、点了也打不开编辑器的条目。catalog 是编译期常量、`Config` 只暴露超时参数、插件没有注册接口，且本仓库纪律不允许提交上游补丁，所以在上游修正前由插件在 fnOS 环境内遮蔽该条目。
- 遮蔽使用插槽同 `id`、更低 `priority` 的方式（与插件现有 session log 遮蔽同一机制）；不得与官方条目同优先级，否则注册直接失败。只在 `isEmbeddedFnosFrame()` 为真时注册，独立浏览器和桌面端官方入口行为不变。
- 替代入口沿用 `@tnnevol/dsh-semi-ui` 的组件，外观与官方入口在头部的位置和尺寸保持一致，展开为下拉菜单而非直接触发操作；菜单项由数据驱动，后续追加 fnOS 文件能力条目时不改动锚点、注册方式、遮蔽关系和已交付条目的行为。
- 目标路径取当前会话的工作目录；工作目录未知或为空时不渲染入口。SDK 未就绪、非 web carrier 或调用失败时给出可见失败提示，不静默吞掉，也不回退到 DSH 原生打开逻辑（NAS 服务容器内没有 `xdg-open`）。不预检插件自己展示的授权目录列表：该列表用于浏览和选择，可能滞后于 fnOS ACL 状态，预检会误拒合法路径，是否允许由 fnOS 判断。
- fnOS 插件的前端静态资源走插件自己的路由，不内联进客户端 bundle：客户端以 `/fnos-plugins/static/<插件>/<资源>` 引用，网关把 `/fnos-plugins` 列为内置前缀（与 `/api`、`/plugins`、`/open-in-app` 同级）以便浏览器 bridge 自动补上应用前缀，插件在 DSH 侧以同名前缀路由返回包内资源。该前缀是插件自有命名空间，不代理到 DSH 既有路径，也不读取 fnOS 宿主文件系统；资源缺失时按 404 处理。

## 不在本次范围内

- 不为老用户自动卸载 Codex 插件，不删除用户 profile、凭据、工作区、授权目录或插件配置。
- 不把 `dshmarket` 的固定版本升级为 registry 的浮动版本；后续版本另开变更或更新本需求后再实施。
- 不新增与 DSH 适配无关的插件功能，不重构 CodeBuddy 多账号、签到和统计策略。
- 不修改 fnOS 平台权限模型、网关路径、授权目录规则或上游市场插件源码。
- 不追踪 `0.1.5-alpha.*`、`0.1.5-rc.1` 或后续 rc/正式版；它们另开需求。
- 不修改 DSH 官方源码，不向上游提交补丁，也不在本仓库内代理 `/open-in-app` 路由；`zed` 误判的根因在上游，本需求只让 fnOS 用户不再看到该条目。
- 不读取或依赖 fnOS 宿主的静态资源目录（如 `/usr/trim/www/static`）：那是宿主未公开的内部布局，随版本可能变动；插件只服务自己包内的资源。
- 不为 `/fnos-plugins` 之外的顶层路径做反代，也不放宽现有的「任何图片资源都补应用前缀」规则——该规则仍服务于 DSH 插件在任意路径提供图片的场景。
- 不实现「文件预览」和「文本编辑器」菜单项：`trim.preview` 与 `trim.text-editor` 都按文件路径工作，对工作目录无效，需要先确定作用对象（具体文件而非目录）再另立变更。
- 不改变 fnOS 文件授权、ACL 和目录管理行为；沿用 FNOS-001-04 与 FNOS-001-12 已验收的授权规则。
- 不改动会话头部其它入口（session log、标题、主题）的行为和位置。

## 验收条件与完成状态

### P0 验收条件

- DSH catalog、锁文件、插件 `compatibility.json`、FPK `DSH_VERSION` 和 native 配置统一为 `0.1.5-rc.2`；插件类型检查、单元测试和构建通过。
- `pnpm run build -- --plugin <name>` 和 `pnpm run build -- --fpk --app fn-deepseek-harness` 成功；FPK 安装后应用私有 `${TRIM_PKGHOME}/.npm-global/bin/dsh --version` 输出 `0.1.5-rc.2`，DSH Web 可经 fnOS 网关打开。
- 新用户的 FPK 清单和内置目录包含与 `0.1.5-rc.2` 适配的 Codex 包，干净 profile 安装后 Codex 能被 DSH Web 正常加载；老用户预置 Codex 凭据、模型配置和 bundle 后执行升级，用户数据保持不变且没有卸载日志。
- 新用户安装后 profile 中存在 `dshmarket@1.46.1` 并能加载市场入口；预置任意已安装版本后执行安装/升级，安装器明确记录跳过，版本、文件和配置均未被覆盖。
- FPK 不注册 `/usr/local/bin/dsh`：`config/resource` 无 `usr-local-linker`，安装回调不生成 `app/bin/dsh`。构建校验必须拒绝重新引入 wrapper 的产物。应用私有 CLI 的依赖和 profile 目录所有权可由 `id`、`stat` 和实际命令结果验证。
- 从 iframe 打开应用首页时不出现 303 循环：浏览器地址始终无 Token，DSH 只对首次无 Cookie 的首页请求收到 Token，随后按 Cookie 认证并返回 200；旧 Cookie 失效时网关能用当前 Token 重新换取一次。
- 触发 DSH Web 内部重启并确认 Token 变化：新请求和页面跳转使用新 Token，旧 Token 不再生效；重启期间并发请求不会落到未授权页面。首次启动、异常退出恢复和连续重启也通过回归测试。

### FNOS-004-02 验收条件

- `FNOS-004-02-AC-01`：新 FPK 的 `published-dsh-plugins.json` 和 `app/bundled-dsh-plugins` 包含 Codex 插件的内置归档，归档 `package.json` 版本与清单精确版本一致；干净 profile 安装后 Codex 依赖和 bundle 齐备，DSH Web 能正常启动。
- `FNOS-004-02-AC-02`：老用户已有 Codex 凭据、模型配置、workspace 或 `dsh.profile.bundles` 时执行升级，用户数据保持不变，不执行卸载、删除或覆盖；包本体按内置归档校准到清单版本。
- `FNOS-004-02-AC-03`：安装回调对 Codex 只执行清单驱动的安装或校准，不写入卸载动作；重复安装/升级不会因为版本已匹配而重复安装，也不会输出删除用户数据的日志。
- `FNOS-004-02-AC-04`：不内置 Codex 的替代路径被明确否决——registry 上 `latest`/`rc` 的 Codex 版本基线低于 `0.1.5-rc.2`，安装后 DSH Web 以 `settingsNamespace` 缺失报错退出；构建清单不得再声明 Codex 排除规则。
- `FNOS-004-02-AC-05`：FPK 产物检查、安装脚本回归测试和真实 NAS 升级验证均能证明上述新用户/老用户差异。
- `FNOS-004-02-AC-06`：FPK 内置插件的浏览器同级 HTTP 路由由网关内置前缀覆盖，用户无需在设置页手工登记：`@tnnevol/dsh-codebuddy` 的 RPC 频道 `/codebuddy` 与 `/api`、`/plugins`、`/open-in-app` 同级，浏览器 bridge 始终为其补上应用前缀；前缀按路径段边界匹配（`/codebuddyx` 不属于该频道）；用户规则不能覆盖或移除内置前缀。

### FNOS-004-03 验收条件

- `FNOS-004-03-AC-01`：新用户 Web profile 中不存在 `dshmarket` 时，执行 `dsh plugin --profile web add dshmarket@1.46.1`，安装成功后 bundle 能在 Web 重启后加载。
- `FNOS-004-03-AC-02`：检测到 profile 包清单或实际包目录中已有 `dshmarket` 时跳过 DSH CLI 安装，不覆盖、降级、删除现有版本、文件或配置。
- `FNOS-004-03-AC-03`：dshmarket 的自动安装命令始终使用精确版本 `1.46.1`，不使用 `latest`、`next` 或其他浮动 dist-tag。
- `FNOS-004-03-AC-04`：dshmarket 安装和跳过逻辑在当前 DSH 客户端完成验证；真实 NAS 只验证 FPK 安装链和 `dsh-fnos`，不把其他插件作为 NAS 前置条件。

### FNOS-004-04 验收条件

- `FNOS-004-04-AC-01`：FPK 不注册公开 `dsh` 命令——`config/resource` 不含 `usr-local-linker`，安装回调不含 `CLI_WRAPPER` / `setup_cli_wrapper`，构建校验拒绝重新引入 wrapper 的产物；真实 DSH CLI 存在于应用私有目录并可执行。
- `FNOS-004-04-AC-02`：真实 CLI 只由应用包用户在受控环境变量下调用；不存在任何由普通用户直接调用、却声称以应用包用户身份执行的入口。安装回调与网关都不依赖 setuid、`runuser` 或 sudo 完成身份切换。
- `FNOS-004-04-AC-03`：应用私有 `dsh --version`、`dsh --help` 与应用包用户下执行时输出目标版本，且在应用包用户环境中可运行 `dsh plugin --profile web ...`。
- `FNOS-004-04-AC-04`：真实 CLI、profile、插件依赖和配置文件的权限可通过 `id`、`stat` 和实际写入验证，非应用用户不能修改 DSH 配置或改变其所有权。

### FNOS-004-05 验收条件

- `FNOS-004-05-AC-01`：内部重启开始时旧 Token 不再被新的页面跳转、健康检查或代理鉴权路径继续使用；重启状态可被网关识别。
- `FNOS-004-05-AC-02`：DSH Web 生成新 Token 后，网关从本次启动结果捕获并原子持久化新 Token，再更新内存状态；Token 文件由应用包用户拥有且权限受限。
- `FNOS-004-05-AC-03`：重启期间到达的页面、HTTP、SSE、WebSocket 和并发请求只能等待新 Token 或获得可恢复响应，不能因复用旧 Token 导向未授权页面。
- `FNOS-004-05-AC-04`：首次启动、配置触发的内部重启、异常退出恢复和连续重启均验证新旧 Token 切换；旧 Token 不再生效，真实 NAS 记录完整网关证据。

### FNOS-004-06 验收条件

- `FNOS-004-06-AC-01`：构建前校验 DSH 版本、native 配置、锁文件、插件清单、捆绑包元数据和 FPK 文件名；任一版本或清单不一致都禁止发布。
- `FNOS-004-06-AC-02`：安装和升级流程可重复执行，不删除用户 `DSH_HOME`、profile、凭据、工作区、会话、授权目录或未列入新清单的旧插件。
- `FNOS-004-06-AC-03`：升级失败时返回非零并保留可恢复的旧运行时/配置状态；使用上一份完整 FPK 或受支持的回滚流程后，应用可以启动且用户数据保持不变。
- `FNOS-004-06-AC-04`：发布产物、版本清单、升级日志、回滚结果和当前客户端/NAS 验收证据可相互追溯；不把本地构建结果替代真实 NAS 证据。

### FNOS-004-07 验收条件

- `FNOS-004-07-AC-01`：执行官方 CLI 插件命令前，安装回调先检查应用私有全局目录中的 `@deepseek-ai/dsh@0.1.5-rc.2` 和 `pnpm@11.7.0`；两者均已安装且实际 CLI 版本精确匹配时不重复安装，仅在缺失、不可执行或版本不匹配时安装，且不依赖 NAS 全局 pnpm。
- `FNOS-004-07-AC-02`：缺失 Web profile 时首次执行 `dsh plugin --profile web add/update` 能由官方 CLI 自动初始化且不启动 Web；已有 profile 不被覆盖。
- `FNOS-004-07-AC-03`：安装/升级使用 `dsh plugin --profile web` 管理插件，FPK 不再调用 `install-dsh-plugins.mjs`、npm 直装或手工维护 bundle。
- `FNOS-004-07-AC-04`：自动命令只使用 `<package>@<fixed-version>`，清单拒绝 `latest`、`next` 和其他浮动 dist-tag，捆绑包版本与清单一致。
- `FNOS-004-07-AC-05`：新安装只 add 清单插件，版本变化只 update 精确版本；缺少清单的老插件不自动 remove，重复执行保持幂等。
- `FNOS-004-07-AC-09`：内置捆绑插件（FPK 的 `bundled-dsh-plugins/*.tgz`）每次安装/升级都强制以 FPK 内归档覆盖 profile 中的副本，**不比较版本号**。原因：`dsh plugin` 只是 pnpm 转发，`pnpm add` 对相同的 spec 字符串只看 `node_modules/.modules.yaml` 与 lockfile 里的 integrity，即使 tarball 内容已变也报 `Already up to date`；`install --force`、`--fix-lockfile`、`update`、`rebuild`、`store prune` 均不能解决。覆盖前通过 DSH CLI 执行 `remove`，再以同一 spec 重新 `add`；不触碰 pnpm 内部状态文件，profile 的依赖与 bundle 记录恢复指向 FPK 归档，且重复执行幂等。
- `FNOS-004-07-AC-10`：强制覆盖只对 FPK 中实际存在的内置归档生效；归档不存在的发布插件继续按版本精确安装/更新，缺少清单的老插件不自动 remove。安装失败时生命周期返回非零并输出可定位错误。
- `FNOS-004-07-AC-06`：DSH CLI、pnpm 或 profile 写入失败时生命周期返回非零，保留原 profile 数据并输出可定位错误。
- `FNOS-004-07-AC-08`：运行期插件安装与三方市场更新使用与 profile 一致的 pnpm store：网关启动 Web 时注入 `${DSH_HOME}/.pnpm-store-dir` 记录的 `PNPM_CONFIG_STORE_DIR`，`pnpm store path` 解析结果与该 profile `node_modules/.modules.yaml` 的 `storeDir` 相同，不出现 `ERR_PNPM_UNEXPECTED_STORE`；记录缺失或非法时清除继承值而不是猜测。
- `FNOS-004-07-AC-07`：当前 DSH 客户端完成 Codex Auth、CodeBuddy、Semi UI 和共享包的 CLI 管理、Bundle 生效和重启验证；真实 NAS 只验收 FPK、网关、CodeBuddy 和 `dsh-fnos`。

### FNOS-004-08 验收条件

- `FNOS-004-08-AC-01`：选中 Codex 模型时，会话输入框右侧出现 Codex 用量图标，CodeBuddy 图标不出现；选中 CodeBuddy 模型时相反。
- `FNOS-004-08-AC-02`：在两家供应商模型之间切换，图标随选中模型即时切换，不刷新页面、不丢失草稿；同一轮对话里不出现两家图标并存。
- `FNOS-004-08-AC-03`：未选模型，或选中模型供应商读不到时，两家用量图标都不出现。
- `FNOS-004-08-AC-04`：CodeBuddy 模型被选中但用户关闭 `showUsage` 偏好时，CodeBuddy 图标仍不显示（供应商条件与偏好取与）。
- `FNOS-004-08-AC-05`：图标隐藏后没有为它继续后台轮询用量的明显多余请求；Codex Auth、CodeBuddy 与共享包的单元测试与构建保持通过。

### FNOS-004-09 验收条件

- `FNOS-004-09-AC-01`：在 fnOS iframe 中打开会话，会话头部只出现插件提供的文件入口，不再出现 DSH 官方「打开应用」按钮，也不出现 Zed 等误判条目。
- `FNOS-004-09-AC-02`：入口外观与官方入口在头部的位置和尺寸一致，展开后是下拉菜单而非直接触发操作。
- `FNOS-004-09-AC-09`：会话头部两个条目的左右顺序与官方一致（文件入口在左、Session log 在右），顺序由插槽的 `priority`/`order` 决定而非注册先后；该顺序有测试用真实插槽核心验证，打平取值时测试失败。
- `FNOS-004-09-AC-10`：Session log 的触发控件是纯图标按钮（28px 圆形、透明、无边框、悬停出底色，与官方 `session-log-export` 一致），不渲染可见文案与边框；`…` 表意的菜单项各带图标。
- `FNOS-004-09-AC-03`：选择下拉项「文件管理」后，NAS 文件管理器被打开并定位到当前会话的工作目录。
- `FNOS-004-09-AC-04`：会话工作目录未知或为空时入口不渲染；SDK 调用失败时给出可见提示，且不把错误冒泡成未处理异常。
- `FNOS-004-09-AC-05`：独立浏览器中官方按钮行为不变，插件不注册该入口。
- `FNOS-004-09-AC-06`：fnOS 插件 typecheck、单元测试和构建通过；新增行为有单元测试覆盖遮蔽注册、工作目录判定和 SDK 调用分支。
- `FNOS-004-09-AC-07`：会话头部文件入口的图标以 `/fnos-plugins/static/<插件>/<资源>` 引用，由插件自己的路由返回包内资源，不内联进客户端 bundle；`/fnos-plugins` 属于网关内置前缀，浏览器 bridge 会为它补上应用前缀，且不写死宿主安装目录。
- `FNOS-004-09-AC-08`：资源缺失时路由返回 404，界面不因此崩溃或阻塞 DSH；插件包内不含该资源时也不回退读取 fnOS 宿主目录。
- `FNOS-004-09-AC-11`：导出到 NAS 的 ZIP 由 DSH 自己的 `/api/session.export` 生成；宿主向 loopback 请求该路由时必须转发当前浏览器的 `dsh-auth-*` Cookie 完成 browser-session 认证，再流转写入目标目录；不依赖任何无提供方的注入服务。
- `FNOS-004-09-AC-12`：文件入口的左侧主按钮 tooltip 使用动态模板「在{应用名称}打开」，名称取自当前选中的菜单项，不写死为文件管理。
- `FNOS-004-09-AC-13`：fnOS iframe 内 DSH 的「打开文件/定位文件」动作（`/api/present.open` 与 `/api/present.host`）改由 fnOS SDK 执行：`present.host` 不因 NAS 无桌面而报告不可用；`present.open` 先经插件 `/fnos-plugins/present/resolve` 按 Session 事件、工作区与文件系统校验出真实 Host 路径，再调用 fnOS `openFile`（`reveal` 走文件管理器），不再返回 409 `Host desktop unavailable`；解析或打开失败时返回可重试的错误状态，独立浏览器行为不变。

### P1 验收条件

- FPK 升级与回滚后，`DSH_HOME`、profile、凭据、工作区、授权目录和插件设置保留，应用能正常启动；安装/升级重复执行不会重装已存在的市场插件或重置 bundle。
- `dshmarket` 不得出现在 FPK 内置目录中；发布清单、版本锁定信息和来源文档互相一致，安装阶段通过精确版本 registry 包完成安装。
- fnOS 应用安装、升级、重启、网关 HTTP/SSE/WebSocket 以及 `dsh-fnos` 插件加载在真实 NAS 上完成验收；Codex Auth、CodeBuddy、Semi UI 和共享包在当前 DSH 客户端完成组合入口验证。两类证据分开记录。
- `pnpm run check -- --all`、`pnpm run build -- --docs` 和 `git diff --check` 通过，适配差异、回滚步骤和验证证据写入开发/验证文档后，需求状态才可改为“已完成”。

### 状态看板

| 阶段 | 状态 | 当前范围 | 下一步 |
| --- | --- | --- | --- |
| P0 DSH 与插件兼容性升级 | <Badge type="tip" text="已完成" /> | 运行时、catalog、插件接缝和 FPK 基线 | 无；已完成并验收通过 |
| P0 FPK 插件安装策略 | <Badge type="tip" text="已完成" /> | 内置 Codex 并随 FPK 安装，固定 dshmarket 且兼容已安装状态 | 无；已完成并验收通过 |
| P0 CLI 与 Token 运行修复 | <Badge type="tip" text="已完成" /> | 应用用户权限、CLI wrapper、重启后的 Token 原子刷新 | 无；已完成并验收通过 |
| P0 DSH CLI 插件管理 | <Badge type="tip" text="已完成" /> | 固定 DSH/pnpm、使用官方 CLI 自动初始化 profile、插件 CLI 操作和 bundle 写回 | 无；已完成并验收通过 |
| P0 用量图标按模型供应商显隐 | <Badge type="tip" text="已完成" /> | Codex / CodeBuddy 客户端 dock 注册、显隐条件、真值表单测与接线断言 | 无；已完成并验收通过 |
| P1 fnOS 原生文件入口 | <Badge type="tip" text="已完成" /> | fnOS iframe 内遮蔽官方「打开应用」，提供文件管理器入口，静态资源走插件自有前缀 | 无；已完成并验收通过 |
| P1 发布、升级回滚与 NAS 验收 | <Badge type="tip" text="已完成" /> | FPK 产物、用户数据、网关和目标环境证据 | 无；已完成并验收通过 |

## 变更记录

| 日期 | 变更 | 说明 |
| --- | --- | --- |
| 2026-09-12 | 新增 FNOS-004 | 记录 DSH 0.1.5-rc.2 适配、Codex 默认捆绑策略、固定版本 dshmarket、dsh CLI 权限包装和重启 Token 刷新需求 |
| 2026-09-12 | FNOS-004-01 进入计划 | 建立 PLAN-FNOS-004，首轮只实施 DSH 与插件适配 0.1.5-rc.2；其余功能暂不进入本轮计划 |
| 2026-09-12 | FNOS-004-02 进入计划 | 将 Codex 默认捆绑策略、新用户/老用户安装差异和非破坏性升级验收纳入 PLAN-FNOS-004 |
| 2026-09-12 | FNOS-004-07 进入计划 | 将 FPK 插件管理统一到目标 tag 提供的 DSH CLI，固定 DSH/pnpm/插件版本并移除自定义安装脚本 |
| 2026-09-13 | 上移 dshmarket 固定版本 | 发布清单更新为 `dshmarket@1.46.1`，同步构建校验常量与本需求、计划、插件文档中的固定版本，避免清单与校验常量不一致导致 FPK 构建失败 |
| 2026-09-13 | 恢复 Codex 默认捆绑 | 原「移除 Codex 默认捆绑」方案被证伪：registry 上 Codex 的 `latest`/`rc` 基线分别为 `0.1.0-rc.7` 和 `0.1.2-rc.1`，在 `0.1.5-rc.2` 上因 `settingsNamespace` 缺失导致 DSH Web 启动失败；改为由 FPK 内置与 `0.1.5-rc.2` 适配的 Codex 归档并按清单精确版本安装，同时保留非破坏性升级约束 |
| 2026-09-13 | 统一插件发布版本 | 四个运行时插件发布版本由 `0.1.5-rc.2.4` 改为 `0.1.5-rc.2`，与 DSH 运行时基线同号；改版前该版本未发布到 registry，不涉及撤回或重发；`dshPluginApi.version` 仍单独声明运行时兼容基线 |
| 2026-09-13 | 新增 FNOS-004-08 | 记录会话输入框用量进度图标按所选模型供应商显隐的需求：选中对应供应商模型才显示其图标，切换模型即时变化 |
| 2026-09-13 | FNOS-004-08 完成验收 | 实现按 `modelSelection` 投影的供应商显隐（`35f0e70`），`AC-01` 经用户在 DSH 客户端浏览器实测通过；`AC-02`/`AC-03`/`AC-04` 目前只有单元测试与接线断言证据，待补人工复现，见[客户端验收记录](/validation/FNOS-004-08-dsh-client-2026-09-13) |
| 2026-09-13 | 新增 FNOS-004-09 | 记录 fnOS 原生文件入口需求：官方「打开应用」按钮按编译期常量表探测应用，在 fnOS 上把 ZFS Event Daemon（`/usr/sbin/zed`）误判为 Zed 编辑器且取不到图标；改为在 iframe 内遮蔽该入口，用 fnOS JS SDK 提供文件管理器入口。上游 catalog 不可配置且本仓库不提交上游补丁，故在插件侧遮蔽。 |
| 2026-09-13 | 补充 FNOS-004-09 静态资源方案 | 插件静态资源改由插件自己的 `/fnos-plugins/static` 路由提供，网关把该前缀列为内置前缀；不读取 fnOS 宿主静态目录，也不放宽现有图片资源补前缀规则。原内联图标方案在 `AC-07`/`AC-08` 中改为资源引用 |
| 2026-09-13 | 补充 FNOS-004-09 头部布局与 Session log 控件 | 明确两个条目的左右顺序与官方一致（AC-09）、Session log 触发控件为纯图标按钮（AC-10）；顺序取值集中并加行为测试 |
| 2026-09-13 | 修复 FNOS-004-09「导出到 NAS」必然失败 | 上游取数原走 `ctx.get('apiProxy')`，但全仓与上游 DSH 均无该服务提供方，取值恒为 undefined、每次必 503；改为宿主向 loopback 请求 DSH 自己的 `/api/session.export`（AC-11） |
| 2026-09-13 | 新增 FNOS-004-07 "内置插件强制覆盖" | 记录捆绑插件必须每次安装都按 FPK 归档覆盖（不比较版本），并约束删除路径的推导与校验（AC-09/AC-10） |
| 2026-09-14 | FNOS-004 全部完成并验收 | 根据用户确认，FNOS-004-01 至 FNOS-004-09 及其验收条件全部完成并通过验收；需求状态更新为已完成 |
