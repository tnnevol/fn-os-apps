---
id: FNOS-002
title: FNOS-002 DSH 应用与插件优化
description: 记录 Codex 登录与用量状态、NAS 引用、共享 UI、FPK 网关和 fnOS 应用跳转需求。
status: validating
owner: tnnevol
targetVersion: 5.1.x
lastVerified: 2026-08-29
---

# FNOS-002 DSH 应用与插件优化

| 项目 | 内容 |
| --- | --- |
| 需求编号 | FNOS-002 |
| 提出日期 | 2026-08-24 |
| 需求状态 | <Badge type="warning" text="待 NAS 验证" /> |
| 关联计划 | [PLAN-FNOS-002 DSH 应用与插件优化](/plans/PLAN-FNOS-002-dsh-app-plugin-optimization) |

## 需求背景与目标

DSH 在 fnOS 中运行后，还有几处使用体验需要调整。Codex 登录状态和用量状态现在分散处理，未登录时仍可能显示状态，用量接口是否提供五小时窗口也没有反映到页面；NAS 引用可能改动输入框中的空格，输入框删除本次选择后 Tree 也不会同步取消勾选。FPK 网关仍由直接调用 `node:http` 的代码承担代理，三方插件使用自定义 API URL 时，还需要手工修改浏览器 bridge 的反代路径并重新打包 FPK。项目也缺少共享 Semi UI 组件的集中预览入口。

这些内容统一在 FNOS-002 中记录。涉及 fnOS 页面跳转的能力先调研，确认 JS SDK 支持后再安排开发。

## 需求目标

- 统一 Codex 登录与用量状态：只在确认登录后显示状态，用量接口提供五小时窗口时自动显示对应状态，接口未提供时自动隐藏。
- NAS 文件和目录引用不改动用户已有文本；Tree 面板打开期间，当前操作插入的引用被删除时同步取消对应勾选。
- 新增 DSH Semi UI 总览插件。
- 使用 `connect` 与 `http-proxy-middleware` 重写 FPK 网关，通过 tsdown 生成可直接随 FPK 分发的单文件入口；浏览器 Bridge 使用独立 JS 源文件维护，网关常驻时允许用户单独恢复 DSH Web。
- 由 fnOS 插件管理三方插件 API URL 反代配置，网关监听配置并将匹配的绝对 URL 请求改写到统一网关下的 DSH 服务。
- 调研 JS SDK 能否打开其他应用或应用中心的指定详情页。

## 涉及范围

| 模块 | 目录或入口 | 职责 |
| --- | --- | --- |
| Codex 插件 | `plugins/dsh-codex-auth-plugin` | 控制登录状态和用量窗口显示 |
| fnOS 插件 | `plugins/dsh-fnos-plugin` | 处理 NAS 引用、三方插件 API URL 反代配置和 JS SDK 调研 |
| 共享 UI | `packages/dsh-semi-ui`、待新增总览插件 | 展示共享组件和主题效果 |
| 网关源码包 | `packages/fnos-gateway` | 使用 `connect`、`http-proxy-middleware` 和 tsdown 维护网关源码、独立浏览器 Bridge 与构建入口 |
| FPK 网关产物 | `apps/fn-deepseek-harness/app/gateway-proxy.mjs` | 监听 fnOS Unix Socket，代理 DSH HTTP、WebSocket 和流式请求 |
| 项目文档 | `docs/` | 记录需求、调研结论和后续计划 |

## 功能列表

| 编号 | 优先级 | 功能 | 用户行为 | 状态 |
| --- | --- | --- | --- | --- |
| FNOS-002-01 | P1 | Codex 登录与用量状态 | 未登录时不显示状态；登录和退出后及时更新；接口提供五小时窗口时自动显示对应状态 | <Badge type="tip" text="已实现" /> |
| FNOS-002-02 | P1 | NAS 引用与 Tree 状态 | 插入引用时保留原文空格；面板打开期间删除本次引用后同步 Tree，历史引用不参与本次勾选 | <Badge type="tip" text="已实现" /> |
| FNOS-002-03 | P1 | Semi UI 总览插件 | 点击插件入口后跳转到独立路由，查看共享组件及主题效果 | <Badge type="tip" text="已实现" /> |
| FNOS-002-04 | P1 | FPK 网关、进程恢复与 API URL 反代 | 使用专业代理中间件；DSH Web 退出后可从网关恢复；用户可配置三方插件 API URL 反代规则并即时生效 | <Badge type="warning" text="待 NAS 验证" /> |
| FNOS-002-05 | P2 | fnOS 应用跳转调研 | 确认能否打开其他应用或应用中心的指定详情页 | <Badge type="warning" text="需调研" /> |

## 交互和行为约束

- Codex 未登录、加载中或鉴权失败时隐藏成功状态，登录入口保留。
- 五小时用量以接口返回的 `limit_window_seconds` 为准；只有明确等于 18,000 秒的窗口才展示，不根据 `primary_window` 或 `secondary_window` 的位置猜测。
- 五小时窗口没有用户配置项，不写入插件设置；接口刷新后，设置卡片和对话输入区状态同步更新。
- Codex 配置面板可同时展示五小时和每周窗口；对话输入区状态栏只展示一个紧凑窗口，优先五小时、否则每周，没有可识别窗口时隐藏。
- NAS 引用只处理插入位置。前面已有空白时不补空格，没有空白时补一个空格。
- fnOS Tree 面板每次打开时记录已有引用作为操作基线；面板打开后新插入的引用属于本次操作，之前已存在的引用不自动映射为当前 Tree 选中状态。
- 面板保持打开时，用户从输入框删除本次操作插入的 structured reference，Tree 必须同步取消对应节点；删除历史引用不得改变当前 Tree 状态。
- 当前操作关联使用 DSH occurrence 身份区分，不只按路径判断。同一路径存在历史引用和本次引用时，只同步本次 occurrence。
- Semi UI 总览插件使用 `@tnnevol/dsh-semi-ui` 的公开组件，并覆盖浅色和深色主题。
- 设置中的插件卡片只保留总览入口；点击后进入 `#/plugins/semi-ui`。总览页面使用 DSH `shell.overlay` 插槽呈现，不覆盖 `conversation`、`sidebar` 等 single slot。
- 总览路由支持浏览器前进、后退和刷新；关闭总览时返回进入前的 DSH 页面。未安装插件时该 Hash 不得影响 DSH 正常启动。
- 网关源码放在 `packages/fnos-gateway`，使用 tsdown 将依赖打包到 `apps/fn-deepseek-harness/app/gateway-proxy.mjs`；NAS 安装阶段不再安装网关的 npm 依赖。
- 浏览器注入代码必须放在独立 `.js` 文件中维护，不在 TypeScript 中保留 `BRIDGE_SCRIPT_BODY` 一类大段模板字符串。默认由构建插件使用 `fs` 读取源文件并作为虚拟模块内联到单文件 ESM，NAS 运行时不读取仓库源码路径。
- HTML 默认直接注入构建后的 Bridge 内容；若以后改用 `<script src>`，必须由网关提供稳定的内部静态路由，并将对应资源纳入 FPK，不允许引用 `packages/` 源码目录。
- 网关监听 `app/ui/config` 声明的 `app.sock`，统一网关公开路径保持 `/app/fn-deepseek-harness`，上游固定为 DSH 回环地址 `127.0.0.1:3080`。
- FPK 运行状态以常驻网关进程为准，DSH Web PID 只表示可单独恢复的上游子进程；Web 退出不能清除网关状态或重复启动网关。
- DSH Web 不可用时，网关提供独立恢复页面和“启动 Web”按钮。恢复接口只接受管理员的同源 POST 请求。
- 启动中的 PID 先写临时状态，只有 DSH Web 健康检查通过后才原子替换正式 PID；失败时网关继续运行并展示错误。
- 反代规则只决定三方插件绝对 API URL 是否补统一网关前缀，不作为接口访问权限控制；fnOS 网关登录校验与插件自身权限仍按原规则执行。
- 自定义路径由 fnOS 插件设置卡片统一编辑，点击“保存”后写入 `${TRIM_PKGVAR}/gateway/path-allowlist.json`；“放弃”恢复服务端已保存内容。
- 网关通过 `fs.watch` 读取最新配置，并把完整快照推送给已打开的页面；配置变更不要求刷新 DSH Web。
- 应用跳转调研以 [fnOS 页面路由文档](https://developer.fnnas.com/api/page/routing) 和真实 NAS 表现为准，不使用未公开的内部路由。

## fnOS 应用跳转调研结论

- fnOS 公开的页面路由接口只包含文件、文件管理器、当前应用设置页和外部 URL，没有公开“打开应用中心详情页”的接口。
- 当前项目安装的 `@trimjs/web-app@0.4.2` 类型声明中存在 `openApp(anchor)` 和 `openCustomApp(appName, options)`，说明 Web 宿主具备打开其他应用的内部桥接能力。
- SDK 没有公开应用中心的 `appName`、详情页锚点和 `OpenAppParams` 参数契约，公开文档也没有承诺该行为。现阶段不能确认 fnOS 插件可以稳定直达 DeepSeek Harness 的应用中心详情页。
- `FNOS-002-05` 继续保持“需调研”。只有在真实 NAS 上验证出稳定参数，并确认系统版本、权限和失败行为后，才进入详细计划。

## 不在本次范围内

- 不修改 DSH 官方源码和 Codex OAuth 流程。
- 不调整 Codex 模型调用、OAuth 和图片能力；用量接口只用于状态展示，不修改额度或刷新规则。
- 不改动 NAS 授权、路径转换和权限校验规则。
- 不把动态路径列表扩展成接口访问控制、防火墙或插件权限系统。
- 不自动扫描三方插件源码推断 API URL；反代规则由用户在 fnOS 插件设置中明确维护。
- 不对 DSH Web 进行无限自动重启；本阶段提供明确的人工恢复入口和并发启动保护。
- 不承诺 JS SDK 已支持跨应用跳转。

## 验收条件与完成状态

### P1 验收条件

- Codex 登录状态在登录、退出和异常场景下显示正确。
- 用量接口返回 18,000 秒窗口时显示五小时剩余额度和重置时间；未返回、字段不完整或请求失败时不显示该窗口。
- 五小时窗口显隐不依赖用户设置，刷新用量后能根据最新接口响应自动变化。
- NAS 文件和目录引用保留原文空格，不产生重复空格；面板打开期间删除本次引用会立即取消对应 Tree 勾选，历史引用不会进入当前选择状态。
- Semi UI 总览插件可正常安装和卸载；点击入口可进入独立总览路由，浏览器前进、后退和刷新有效，组件在浅色、深色主题下显示正常。
- 新网关兼容 HTTP、WebSocket、SSE、插件 API 和静态资源，产物位于 FPK 的 `app` 目录，并在真实 fnOS 统一网关入口完成验证。
- Bridge 可作为独立 JS 文件完成语法检查和单元测试；生成的单文件网关不包含未替换占位符，也不依赖 NAS 上不存在的 Bridge 源文件。
- DSH Web 被单独终止后，fnOS 应用仍保持运行状态；访问入口显示恢复页面，管理员可启动 Web，成功后自动恢复 DSH 页面且不会产生第二个网关进程。
- 恢复过程使用启动锁、临时 PID 和健康检查；重复点击、启动失败及陈旧 PID 不会产生多个 DSH Web 或误杀无关进程。
- fnOS 插件可查看、添加、删除三方插件 API URL 反代规则；未保存的修改不影响当前配置，“放弃”后恢复已保存值。
- 保存后 JSON 使用约定结构写入 `${TRIM_PKGVAR}/gateway/path-allowlist.json`，网关无需重启即可加载。
- 已打开页面能收到最新路径快照；新增路径随后发起的 `fetch`、XHR、`EventSource`、WebSocket 和动态脚本请求会补 `/app/fn-deepseek-harness` 前缀并代理到 `127.0.0.1:3080`。
- 无效或损坏配置不会替换最后一次有效快照，也不会导致网关或 DSH 退出。

### P2 调研条件

- 查清 JS SDK 是否支持打开其他应用和应用中心详情页，并记录系统版本、宿主和权限限制。
- 实机验证后再决定是否进入详细计划。

### 状态看板

| 阶段 | 状态 | 当前范围 | 下一步 |
| --- | --- | --- | --- |
| P1 应用与插件优化 | <Badge type="warning" text="待 NAS 验证" /> | Codex 状态、NAS 引用、UI 总览和网关代理 | 在真实 fnOS 环境完成网关与恢复流程验收 |
| P2 fnOS 应用跳转 | <Badge type="warning" text="需调研" /> | 已确认 SDK 存在跨应用桥接方法，应用中心详情页参数未公开 | 在真实 fnOS 环境验证稳定参数和兼容范围 |

## 变更记录

| 日期 | 变更 | 说明 |
| --- | --- | --- |
| 2026-08-24 | 新增 FNOS-002 | 记录 Codex 登录状态需求 |
| 2026-08-25 | 合并 NAS 引用需求 | 将原 FNOS-003 合并到本需求 |
| 2026-08-27 | 扩展需求范围 | 增加 UI 总览、网关代理和应用跳转调研 |
| 2026-08-27 | 精简需求文档 | 合并重复功能和验收说明，技术细节留到详细计划 |
| 2026-08-28 | 增加 Codex 用量显隐需求 | 五小时窗口由接口能力自动决定，不提供用户开关 |
| 2026-08-28 | 合并 API URL 反代需求 | 将原 FNOS-003 合并到 FNOS-002-04，确认代理技术、持久配置和即时生效规则 |
| 2026-08-28 | 合并 Codex 状态功能 | 将原 FNOS-002-06 合并到 FNOS-002-01，登录状态和用量状态统一规划 |
| 2026-08-28 | 更新应用跳转调研 | SDK 存在未公开的跨应用方法，但无法确认可稳定直达应用中心 DSH 详情页 |
| 2026-08-29 | 增加 DSH Web 恢复需求 | FPK 状态改由常驻网关承载，Web 退出后通过网关恢复页面单独启动 |
| 2026-08-29 | 明确 Semi UI 总览路由 | 插件入口跳转独立 Hash 路由，通过 `shell.overlay` 展示总览页面 |
| 2026-08-29 | 增加 Tree 反向同步需求 | 输入框删除本次面板插入的引用时同步取消勾选，并隔离历史引用状态 |
| 2026-08-29 | 调整 Bridge 源码组织 | 注入脚本改为独立 JS 文件维护，构建期读取并内联到单文件网关产物 |
| 2026-08-29 | 完成 P1 开发 | 完成 Codex 状态、NAS 引用同步、Semi UI 总览和新网关代码，进入真实 NAS 验证 |
