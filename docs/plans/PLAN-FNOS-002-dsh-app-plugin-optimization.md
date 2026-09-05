---
id: PLAN-FNOS-002
title: PLAN-FNOS-002 DSH 应用与插件优化
description: DSH 版本统一、Codex 状态、NAS 引用与 Tree 同步、Semi UI 总览插件、fnOS 统一网关、DSH Web 恢复和三方插件 API URL 反代配置的实施计划。
status: validating
owner: tnnevol
targetVersion: 5.1.x
lastVerified: 2026-09-01
---

# PLAN-FNOS-002 DSH 应用与插件优化

| 项目 | 内容 |
| --- | --- |
| 计划编号 | PLAN-FNOS-002 |
| 计划日期 | 2026-08-28 |
| 对应需求 | [FNOS-002 DSH 应用与插件优化](/requirements/FNOS-002-dsh-app-plugin-optimization) |
| 计划状态 | <Badge type="warning" text="部分 NAS 验证（7 条业务用例、157 条自动化测试通过）" /> |

## 计划目标

本计划实施四个已经确认进入开发的功能：

- `FNOS-002-01`：统一 Codex 登录与用量状态；未登录时隐藏状态，登录后根据接口是否提供五小时窗口自动显示或隐藏对应额度；取得一次性授权码后自动尝试复制到剪切板，失败时保留手动复制入口。
- 版本脚本与插件版本发布流程由 `tooling/fn-os-apps-cli` workspace 中的 `fn-apps-cli` CLI 和 `bumpp` 负责，项目/FPK 与插件各自指定更新范围。
- `FNOS-002-02`：修正 NAS 文件和目录引用的插入规则；TreeSelect 使用独立关系模式支持多个文件/目录（含父子路径）同时选择，并在面板打开期间让本次引用删除状态反向同步到勾选节点，历史引用不参与当前选择。
- `FNOS-002-03`：新增 DSH Semi UI 总览插件，集中展示 `@tnnevol/dsh-semi-ui` 的公共组件、状态和浅色/深色主题效果。
- `FNOS-002-04`：使用 `connect` 与 `http-proxy-middleware` 重写 fnOS 统一网关代理；由常驻网关承载 FPK 状态并在 Web 左侧菜单提供 DSH Web 重启入口；由 fnOS 插件管理三方插件 API URL 反代规则，并让已打开的 DSH 页面立即取得最新配置。
- 跨功能版本约束：将 DSH 运行时、插件、`@deepseek-ai/dsh-*` 依赖、native 产物、FPK 安装流程和发布文档统一到 `0.1.2-rc.1`，不清理用户数据或配置。

网关改版不修改 fnOS 的登录校验，不把路径列表作为访问控制，也不修改 DSH 官方源码。代理目标固定为应用内部的 DSH 回环服务 `127.0.0.1:3080`。

## 实现范围和边界

| 模块 | 计划入口 | 实现责任 |
| --- | --- | --- |
| 网关源码包 | `packages/fnos-gateway` | 维护 `connect` 中间件、代理、内容改写、独立浏览器 Bridge、动态路径和生命周期 |
| 网关构建 | `packages/fnos-gateway/tsdown.app.config.ts` | 构建期读取 Bridge JS，并将 CLI 入口和运行依赖打包为单个 ESM 文件 |
| FPK 网关产物 | `apps/fn-deepseek-harness/app/gateway-proxy.mjs` | 作为生成文件随 FPK 分发，不在 NAS 安装依赖 |
| FPK 入口配置 | `apps/fn-deepseek-harness/app/ui/config` | 保持 `/app/fn-deepseek-harness` 和 `app.sock` 的统一网关声明 |
| FPK 进程管理 | `apps/fn-deepseek-harness/cmd/main`、网关控制中间件 | 以网关承载应用状态，分别启停网关和 DSH Web，维护启动锁、临时 PID 与健康检查 |
| fnOS 插件 Host | `plugins/dsh-fnos-plugin/src/` | 扩展设置 schema，校验路径并原子生成白名单 JSON |
| fnOS 插件 Client | `plugins/dsh-fnos-plugin/src/client/` | 修正 NAS 引用插入与 Tree 状态同步，并提供路径草稿编辑、保存和放弃交互 |
| 共享 Semi UI | `packages/dsh-semi-ui` | 提供按需导出的 Semi 组件、图标和 DSH 主题映射 |
| Semi UI 总览插件 | `plugins/dsh-semi-ui-showcase-plugin` | 提供设置入口、`#/plugins/semi-ui` 路由和组件总览页面；npm 包使用 `@tnnevol/dsh-semi-ui-showcase`，避免与共享包重名 |
| Codex 状态 Host | `plugins/dsh-codex-auth-plugin/src/usage.ts`、认证路由 | 规范化登录状态与 Codex 用量窗口 |
| Codex 状态 Client | `plugins/dsh-codex-auth-plugin/src/client/` | 只在已登录时显示状态，并根据接口响应显示五小时和每周用量 |
| 版本与发布 | `plugins/*`、`apps/fn-deepseek-harness/cmd/install_callback`、`.github/config/`、`docs/` | 统一 DSH/插件版本契约、FPK 安装回调、node-pty native 配置、发布清单和文档 |
| 版本脚本 workspace | `tooling/fn-os-apps-cli/`、根 `package.json`、`pnpm-workspace.yaml` | 使用 `bumpp` 分离项目/FPK 与插件版本更新、提交和 Tag |
| 文档与测试 | `docs/`、各包 `tests/` | 验证配置契约、版本脚本、代理行为、即时同步、构建与 NAS 运行 |

DSH 和 fnOS 官方项目只作为契约参考，不修改、不提交上游补丁。`apps/fn-deepseek-harness/app/gateway-proxy.mjs` 是构建产物，业务源码只在 `packages/fnos-gateway/src/` 中维护。

### 网关源码结构

```text
packages/fnos-gateway/
├── src/
│   ├── client/
│   │   └── bridge.js          # 浏览器端 Bridge，可独立检查和测试
│   ├── bridge-script.ts       # 注入标签、运行时配置和安全序列化
│   ├── proxy.ts               # HTTP、WebSocket 与响应改写
│   └── cli.ts                 # FPK 网关入口
├── tsdown.config.ts
└── tsdown.app.config.ts       # 构建期读取 bridge.js 并生成单文件产物
```

`bridge.js` 是浏览器代码的唯一源码。`bridge-script.ts` 不再保存完整脚本模板，只负责取得构建期导入的文本、注入经过 `JSON.stringify` 序列化的运行时配置，并生成安全的 `<script>` 标签。

### FPK 统一网关产物结构

```text
apps/fn-deepseek-harness/
├── app/
│   ├── gateway-proxy.mjs      # tsdown 生成的单文件 ESM 网关
│   └── ui/
│       └── config             # gatewayPrefix + gatewaySocket
└── cmd/
    └── main                   # 进程启停和状态检测
```

安装后：

```text
${TRIM_APPDEST}/app.sock
  └─ fnOS 统一网关转发
       └─ gateway-proxy.mjs
            └─ http://127.0.0.1:3080
```

Socket 文件只创建在 `${TRIM_APPDEST}`。用户可变配置写入 `${TRIM_PKGVAR}`，不写入升级时会替换的应用安装目录。

## 目标架构和数据流

### Codex 登录与用量状态

<FlowGrid
  :columns="3"
  :steps="[
    {
      label: 'Codex Auth Host',
      detail: '提供登录状态与 ChatGPT WHAM 用量响应',
      variant: 'primary'
    },
    {
      label: 'Client 状态模型',
      detail: '统一规范化认证状态和全部用量窗口'
    },
    {
      label: '状态展示',
      detail: '登录状态是前置条件',
      children: [
        { label: '未登录或鉴权失败', detail: '隐藏状态' },
        { label: '已登录', detail: '显示每周用量', variant: 'success' },
        { label: '存在 18,000 秒窗口', detail: '追加五小时用量', variant: 'success' }
      ]
    }
  ]"
/>

登录状态是整个状态模块的前置条件。五小时用量不再作为独立功能编号，也不增加用户设置开关。

### NAS 引用插入与 Tree 状态同步

<FlowGrid
  :columns="4"
  :steps="[
    {
      label: '输入草稿',
      detail: '读取当前 draft 和插入位置',
      variant: 'primary'
    },
    {
      label: '选择 NAS 引用',
      detail: '记录打开面板前的 occurrence 基线'
    },
    {
      label: '插入 structured reference',
      detail: '只处理插入位置',
      children: [
        { label: '前方已有空白', detail: '不补空格' },
        { label: '前方没有空白', detail: '补一个空格' },
        { label: '其他文本', detail: '保持原样', variant: 'success' }
      ]
    },
    {
      label: '监听当前 input.occurrences',
      detail: '只同步本次面板关联引用',
      children: [
        { label: '本次引用仍存在', detail: '保持 Tree 勾选' },
        { label: '本次引用已删除', detail: '取消对应勾选', variant: 'success' },
        { label: '历史引用变化', detail: '不影响当前 Tree' }
      ]
    }
  ]"
/>

引用仍使用 DSH 的 `slash/input-insert-reference` 契约。插件只计算插入 span 和必要分隔，不通过全局 `trim` 或重写完整 draft 清理用户输入。Tree 的反向同步基于当前面板操作建立的 occurrence 集合，不根据路径扫描全部历史引用。

### Semi UI 总览插件

<FlowGrid
  :columns="4"
  :steps="[
    {
      label: '@tnnevol/dsh-semi-ui',
      detail: '按需导出共享组件和图标',
      variant: 'primary'
    },
    {
      label: 'DSH 主题适配',
      detail: '语义 Token 映射并安装共享主题'
    },
    {
      label: '设置插件入口',
      detail: '点击打开组件总览'
    },
    {
      label: '#/plugins/semi-ui',
      detail: 'Hash 路由与历史记录',
      children: [
        { label: 'shell.overlay', detail: '挂载独立全屏页面' },
        { label: '组件分类', detail: '按类别预览' },
        { label: '主题状态', detail: '浅色、深色与系统主题' },
        { label: '交互状态', detail: '选中、禁用、浮层', variant: 'success' }
      ]
    }
  ]"
/>

总览插件只消费共享包的公开导出，不从 Semi Design 深层路径再次引入组件。新增公共组件时，先在共享包统一封装和映射主题，再加入总览。

DSH `0.1.2-rc.1` 没有公开的 Router/Page 注册服务，因此总览使用 `#/plugins/semi-ui` 作为插件路由，并在 `shell.overlay` list slot 中渲染覆盖 AppFrame 的独立页面。Hash 不改变 fnOS 统一网关请求路径，直接刷新仍由原 DSH HTML 入口承载；不得注册或替换 `conversation`、`sidebar` 等 single slot。

### 统一网关请求

<FlowGrid
  :columns="4"
  :steps="[
    {
      label: '浏览器请求',
      detail: '/app/fn-deepseek-harness/...',
      variant: 'primary'
    },
    {
      label: 'fnOS 统一网关',
      detail: '校验登录态并注入 X-Trim-* Header'
    },
    {
      label: 'fnos-gateway',
      detail: '通过 app.sock 接收请求',
      children: [
        { label: '内置路由', detail: '配置、恢复与事件' },
        { label: '路径改写', detail: '去除统一网关前缀' },
        { label: '代理中间件', detail: 'HTTP 与 WebSocket' }
      ]
    },
    {
      label: 'DSH Web',
      detail: '127.0.0.1:3080',
      variant: 'success'
    }
  ]"
/>

Node HTTP Server 只负责承载 Unix Socket；请求代理、WebSocket 升级、代理错误和响应事件由 `http-proxy-middleware` 处理，不再维护手写的上游转发流程。

### 浏览器 Bridge 构建与注入

<FlowGrid
  :columns="4"
  :steps="[
    {
      label: 'bridge.js',
      detail: '独立维护浏览器代码并执行语法检查',
      variant: 'primary'
    },
    {
      label: 'tsdown 构建插件',
      detail: '使用 fs 在构建期读取并导出为虚拟文本模块'
    },
    {
      label: 'bridge-script.ts',
      detail: '序列化网关前缀和初始规则，生成 script 标签'
    },
    {
      label: '单文件 FPK 网关',
      detail: 'Bridge 内容已内联，NAS 不再读取源码文件',
      variant: 'success'
    }
  ]"
/>

本阶段选用“构建期读取、HTML 内联”的交付方式，以保持 `gateway-proxy.mjs` 单文件部署。两个 tsdown 配置复用同一个 Rolldown 插件：插件通过 `fs.readFile` 读取 `src/client/bridge.js`，向 `virtual:fnos-gateway-bridge` 导出字符串；网关源码只导入该虚拟模块。

不得在 NAS 运行时读取 `packages/fnos-gateway/src/client/bridge.js`。如果以后因 CSP 或缓存策略改成 `<script src>`，网关应提供 `/__fnos-gateway/assets/bridge.js` 内置路由，并把资源复制到 `apps/fn-deepseek-harness/app` 后随 FPK 分发；两种交付方式只保留一种，避免重复执行 Bridge。

### DSH Web 进程恢复

<FlowGrid
  :columns="4"
  :steps="[
    {
      label: 'FPK 运行状态',
      detail: 'cmd/main 只以常驻 gateway.pid 判断应用是否运行',
      variant: 'primary'
    },
    {
      label: '网关检查上游',
      detail: '独立检查 DSH PID 与 127.0.0.1:3080 健康状态',
      children: [
        { label: 'DSH 正常', detail: '继续代理', variant: 'success' },
        { label: 'DSH 已退出', detail: '进入降级状态', variant: 'warning' }
      ]
    },
    {
      label: 'Web 端重启入口',
      detail: '左侧菜单提供按钮，故障时由网关恢复页兜底'
    },
    {
      label: '替换 Web 进程',
      detail: '成功后恢复 DSH 页面',
      variant: 'success',
      children: [
        { label: '启动锁', detail: '拒绝重复启动' },
        { label: '临时 PID', detail: '写入 app.pid.starting' },
        { label: '健康检查', detail: '等待 3080 可访问' },
        { label: '原子替换', detail: '更新正式 app.pid' }
      ]
    }
  ]"
/>

DSH Web PID 不再作为 fnOS 应用状态的组成部分。不能通过保留陈旧 PID 维持状态；正式 PID 只记录已经通过健康检查的进程，常驻网关负责在 Web 不可用时提供控制面。

### 三方插件 API URL 反代配置

<FlowGrid
  :columns="4"
  :steps="[
    {
      label: '编辑 API URL 反代规则',
      detail: 'DSH 设置 → 插件 → fnOS',
      variant: 'primary'
    },
    {
      label: 'Host 校验与保存',
      detail: '持久化设置并原子写入 path-allowlist.json'
    },
    {
      label: '网关热更新',
      detail: 'fs.watch 监听父目录并替换有效快照'
    },
    {
      label: '页面即时生效',
      detail: 'SSE 推送完整快照，bridge 更新路径 Set',
      variant: 'success'
    }
  ]"
/>

浏览器 bridge 只对同源、未带统一网关前缀且命中路径边界的绝对 URL 进行转换：

```text
/plugin-store/catalog
  → /app/fn-deepseek-harness/plugin-store/catalog
  → app.sock
  → http://127.0.0.1:3080/plugin-store/catalog
```

`/api` 和 `/plugins` 继续作为网关内置反代路径，不进入用户配置，也不能在 UI 中删除。用户配置仅保存三方插件 API URL 的路径前缀。

### 已打开页面即时更新

1. 网关生成 HTML 时注入当前有效路径快照和 bridge。
2. bridge 使用完整前缀访问网关内置 SSE 路由 `/__fnos-gateway/path-allowlist/events`。
3. `fs.watch` 检测到 JSON 变化后，网关完成解析、校验和去重。
4. 新配置有效且与当前快照不同，网关向所有 SSE 连接发送完整快照。
5. bridge 原子替换内存中的自定义路径 `Set`，后续请求立即使用新配置。
6. SSE 断线自动重连；重连后服务端先发送一次最新完整快照，避免漏掉中间事件。

SSE 路由由网关自身处理，不转发到 DSH。它经过 fnOS 统一网关登录校验，但不包含用户数据或敏感配置。

### Codex 用量状态

<FlowGrid
  :columns="4"
  :steps="[
    {
      label: 'WHAM 用量接口',
      detail: '返回账户用量窗口',
      variant: 'primary'
    },
    {
      label: 'CodexUsageService',
      detail: 'Host 端读取并规范化安全字段'
    },
    {
      label: '插件用量路由',
      detail: '/plugins/dsh-codex-auth-plugin/auth/usage'
    },
    {
      label: 'Client 窗口匹配',
      detail: '18,000 秒显示五小时状态；无有效窗口则隐藏',
      variant: 'success'
    }
  ]"
/>

窗口类型根据 `limitWindowSeconds` 判断，不固定把 `primaryWindow` 当成五小时窗口。每周窗口按 604,800 秒识别。配置面板同时展示识别到的五小时和每周窗口；对话输入区状态栏只展示一个窗口，优先五小时、否则每周，没有可识别窗口时隐藏。整个用量区受已登录状态约束。

## 分阶段任务

### P1：Codex 登录与用量状态

| 任务 ID | 对应功能 | 实现内容 | 状态 |
| --- | --- | --- | --- |
| PLAN-FNOS-002-T01-01 | FNOS-002-01 | 明确 Auth Host 返回的登录、未登录、加载中和失败状态，Client 不再根据卡片是否存在猜测登录结果 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T01-02 | FNOS-002-01 | 将设置卡片和对话输入区的状态展示统一受“已登录”条件控制，登录与退出后立即刷新 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T01-03 | FNOS-002-01 | 提取统一窗口查找逻辑，按 18,000 秒识别五小时窗口、按 604,800 秒识别每周窗口 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T01-04 | FNOS-002-01 | 仅在已登录且识别到五小时窗口时渲染对应进度和重置时间，不增加用户配置开关 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T01-05 | FNOS-002-01 | 补充未登录、退出、鉴权失败、窗口乱序、无时长和请求失败测试 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T01-06 | FNOS-002-01 | 登录接口返回授权码后自动复制到剪切板；复制失败时保留手动复制按钮并显示提示，补充成功/失败回归测试 | <Badge type="tip" text="已完成" /> |

### P1：NAS 引用与 Tree 状态

| 任务 ID | 对应功能 | 实现内容 | 状态 |
| --- | --- | --- | --- |
| PLAN-FNOS-002-T02-01 | FNOS-002-02 | 按 DSH structured reference 合同计算占位符、label、分隔空格和 draftRev，逐项生成后续 CAS 插入位置 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T02-02 | FNOS-002-02 | 插入首个引用前检查相邻字符；已有空白不新增，没有空白时只补一个空格 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T02-03 | FNOS-002-02 | 多选引用沿用 DSH structured reference 插入，使用 DSH 的占位符草稿长度推进偏移；引用之间保持一个分隔，不清理用户原有前导、尾随或连续空格 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T02-04 | FNOS-002-02 | 删除引用时只删除该引用和插件生成的必要分隔，不吞掉引用前后的用户文本与空格 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T02-05 | FNOS-002-02 | Tree 面板打开时记录已有 fnOS occurrence ID 作为基线，并为本次成功插入的路径维护 occurrence 关联 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T02-06 | FNOS-002-02 | 面板未关闭时监听 `input.occurrences`；本次关联 occurrence 消失后从 `desiredPaths` 移除对应路径，历史 occurrence 不参与同步 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T02-07 | FNOS-002-02 | 补充空 draft、空格、换行、多选、删除、光标恢复、历史同路径、本次删除、关闭重开和外部 draft 更新测试 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T02-08 | FNOS-002-02 | 将 TreeSelect 改为 `unRelated` 独立选择模式，移除无效 `treeCheckable` 属性，验证父子和多个兄弟节点均可同时选中 | <Badge type="tip" text="已完成" /> |

### P1：Semi UI 总览插件

| 任务 ID | 对应功能 | 实现内容 | 状态 |
| --- | --- | --- | --- |
| PLAN-FNOS-002-T03-01 | FNOS-002-03 | 创建 `plugins/dsh-semi-ui-showcase-plugin`，npm 包名使用 `@tnnevol/dsh-semi-ui-showcase`，建立独立 Client 插件构建入口 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T03-02 | FNOS-002-03 | 在设置插件列表注册“DSH Semi UI”轻量入口卡片，只展示说明和“打开组件总览”按钮 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T03-03 | FNOS-002-03 | 实现可清理的 Hash 路由控制器，识别 `#/plugins/semi-ui`，监听 `hashchange`、`popstate` 并接入浏览器历史记录 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T03-04 | FNOS-002-03 | 在 `shell.overlay` list slot 注册路由页面；仅路由命中时挂载全屏总览，不占用 DSH single slot | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T03-05 | FNOS-002-03 | 页面增加标题、返回按钮和分类导航，按类别展示按钮、图标、提示、下拉、级联、树、树选择和弹框 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T03-06 | FNOS-002-03 | 每类组件覆盖默认、悬停、聚焦、选中、半选、禁用、加载和错误等适用状态 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T03-07 | FNOS-002-03 | 复用 `installSemiDshTheme()`，验证浅色、深色及系统主题切换，不在总览插件复制主题 CSS | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T03-08 | FNOS-002-03 | 增加共享包公开导出、路由前进后退、刷新恢复、Slot 卸载、主题安装和构建产物测试，并更新插件文档 | <Badge type="tip" text="已完成" /> |

### P1：FPK 网关与插件路径

| 任务 ID | 对应功能 | 实现内容 | 状态 |
| --- | --- | --- | --- |
| PLAN-FNOS-002-T04-01 | FNOS-002-04 | 完成 `packages/fnos-gateway` 分层，使用 `connect` 组织中间件、使用 `http-proxy-middleware` 代理 HTTP 与 WebSocket | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T04-02 | FNOS-002-04 | 配置 tsdown 库构建和 FPK 构建，将单文件 ESM 产出到 `apps/fn-deepseek-harness/app/gateway-proxy.mjs` | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T04-03 | FNOS-002-04 | 保留前缀剥离、Header 过滤、Location/HTML/CSS/JS 改写、SSE 心跳和优雅退出 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T04-04 | FNOS-002-04 | 在 fnOS 插件设置中增加三方插件 API URL 反代规则的草稿、添加、删除、保存和放弃交互 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T04-05 | FNOS-002-04 | fnOS 插件 Host 校验设置并原子生成 `${TRIM_PKGVAR}/gateway/path-allowlist.json` | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T04-06 | FNOS-002-04 | 网关启动加载配置并监听父目录；配置有效时热替换内存快照，失败时保留最后一次有效值 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T04-07 | FNOS-002-04 | 增加网关内置 SSE 路由，将完整路径快照即时推送给已打开页面 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T04-08 | FNOS-002-04 | bridge 统一处理 `fetch`、XHR、`EventSource`、WebSocket 和动态脚本的绝对 URL 路径 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T04-09 | FNOS-002-04 | 调整 FPK 构建与 `cmd/main` 环境变量，验证生成产物、Unix Socket 和固定回环上游 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T04-10 | FNOS-002-04 | 在真实 fnOS NAS 验证代理、路径保存、即时生效、升级和回滚 | <Badge type="warning" text="部分 NAS 验证" /> |
| PLAN-FNOS-002-T04-11 | FNOS-002-04 | 调整 `cmd/main status`：以网关 PID 代表 FPK 运行状态，修复死亡但非空 PID 文件无法清理的问题 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T04-12 | FNOS-002-04 | 拆分网关和 DSH Web 的启动逻辑；网关已运行时只恢复 Web，不删除 Socket 或重复启动网关 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T04-13 | FNOS-002-04 | 在 Web 左侧菜单和网关恢复页提供“重启 Web”按钮，并增加管理员恢复路由 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T04-14 | FNOS-002-04 | 使用启动锁、`app.pid.starting`、超时健康检查和原子 rename 管理 Web PID | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T04-15 | FNOS-002-04 | 验证 Web 被终止、重复点击、启动失败、PID 复用、网关退出和 FPK stop/config_callback 场景 | <Badge type="warning" text="部分验证" /> |
| PLAN-FNOS-002-T04-16 | FNOS-002-04 | 将 `BRIDGE_SCRIPT_BODY` 拆到 `src/client/bridge.js`；两个 tsdown 构建复用虚拟模块插件，在构建期读取并内联 Bridge | <Badge type="tip" text="已完成" /> |

### P1：Codex 动态模型目录

| 任务 ID | 对应功能 | 实现内容 | 状态 |
| --- | --- | --- | --- |
| PLAN-FNOS-002-T05-01 | FNOS-002-05 | Host 新增模型目录刷新服务：复用 OAuth 凭据调用 `chatgpt.com/backend-api/codex/models`，归一化当前账号可用模型与思考级别 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T05-02 | FNOS-002-05 | 将上游模型归一化为 llm-pi-ai OpenAI Codex profile entry（slug/名称/输入模态/上下文/思考级别 wire 值），处理 DSH 思考级别能力范围（含接口返回 `ultra` 的归并策略） | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T05-03 | FNOS-002-05 | 新增 Web 路由触发刷新并把归一化列表写入 `llm-pi-ai.providers.openai-codex` 配置（触发适配器 snapshot 重建），失败时保留上一次有效列表 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T05-04 | FNOS-002-05 | Client Codex Auth 卡片增加“刷新模型目录”入口：已登录时触发、展示结果与错误，未登录时引导先登录 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-T05-05 | FNOS-002-05 | 补充单元测试：响应归一化、思考级别归并、写入载荷、失败回退、路由鉴权与客户端交互 | <Badge type="warning" text="部分验证（待真实环境）" /> |

### Turbo 任务与发布工具

| 任务 ID | 实现内容 | 状态 |
| --- | --- | --- |
| PLAN-FNOS-002-TT-01 | 引入 Turbo，使用 `turbo.json` 声明 build、typecheck、test、check 和网关应用构建依赖；根 `package.json` 只提供统一任务入口 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-TT-02 | 合并版本入口为交互式 `version`，由 `@clack/prompts` 选择项目/FPK或插件区域，`tooling/fn-os-apps-cli` workspace 通过 `fn-apps-cli` CLI 暴露，全部使用 TypeScript 并由 tsdown 编译 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-TT-03 | 根目录仅暴露交互式 `build`；支持选择文档构建和复选 FPK，DSH FPK 自动先编译网关，插件通过 Turbo 自动先编译 `dsh-semi-ui`，共享包不进入顶层构建选择，移除 `fnos-gateway` 的 `build:fpk` | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-TT-04 | 引入 `changelogithub`，由根 `release:notes` 任务生成 Tag 对应 Release 日志，移除 workflow 内手写 Release 日志生成 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-TT-05 | 由独立 `program.ts` 暴露 Commander 实例，各 `commands/*.ts` 模块注册命令并实现 `action`，`src/index.ts` 统一加载并解析；按 `commands/`、`config/`、`core/`、`ui/`、`sdd/` 拆分版本、构建、提示、进程和文档检查职责 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-TT-06 | 为 `@tnnevol/fn-os-apps-cli` 暴露 `fn-apps-cli` bin，根 `package.json` 的业务任务统一通过 `pnpm exec fn-apps-cli` 调用，workspace 更名为 `tooling/fn-os-apps-cli` | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-TT-07 | 增加唯一根 `start` 入口，交互选择插件 Turbo watch 或 VitePress 文档服务；插件启动自动包含共享 UI 依赖并保持持续监听 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-TT-08 | 将 SDD、文档、共享包和插件检查统一收敛到 `fn-apps-cli check`，支持交互选择和 `--sdd`、`--docs`、`--packages`、`--plugins`、`--all` 参数 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-TT-09 | 重构开发指南全部子菜单，补充应用开发配置说明、统一任务操作手册，以及 `package.json` 入口、CLI、Turbo、workspace package 和 GitHub Workflow 的流程图与依赖关系图 | <Badge type="tip" text="已完成" /> |
| PLAN-FNOS-002-TT-10 | 增加 `fn-apps-cli publish` npm 发布入口，交互选择一个或多个 DSH 插件，在所有询问完成后统一调用插件 `publish:rc` 脚本 | <Badge type="tip" text="已完成" /> |

### 版本统一（跨功能发布约束）

状态：<Badge type="warning" text="待 FPK/NAS 验证" />

版本统一内容原记录在 FNOS-003，现迁移到 FNOS-002 作为所有 DSH 功能的共同发布约束，不新增 `FNOS-002-05` 或其他功能编号。

| 任务 ID | 实现内容 | 状态 |
| --- | --- | --- |
| PLAN-FNOS-002-TV-01 | 将 DSH 插件自身版本、`@deepseek-ai/dsh-*` peer/dev 依赖和 compatibility 声明统一为 `0.1.2-alpha.4` | <Badge type="tip" text="已修改" /> |
| PLAN-FNOS-002-TV-02 | 将 FPK 安装/升级回调固定到 `@deepseek-ai/dsh@0.1.2-alpha.4`，发布清单只安装已发布的 alpha 插件 | <Badge type="tip" text="已修改" /> |
| PLAN-FNOS-002-TV-03 | 同步 node-pty native 构建参数、FPK 构建产物、workspace 包版本和版本相关文档 | <Badge type="tip" text="已修改" /> |
| PLAN-FNOS-002-TV-04 | 在真实 NAS 验证安装、升级、插件加载和版本回滚，确认 `DSH_HOME`、profile、凭据、工作区和插件配置保留 | <Badge type="warning" text="待 NAS 验证" /> |
| PLAN-FNOS-002-TV-05 | 将 DSH 插件版本、`@deepseek-ai/dsh-*` catalog 依赖和 compatibility 声明从 `0.1.2-alpha.4` 统一到 `0.1.2-rc.1`，并把 `@earendil-works/pi-ai` 对齐到 DSH rc.1 锁定的 `0.84.2` | <Badge type="tip" text="已修改" /> |
| PLAN-FNOS-002-TV-06 | 将 FPK 安装/升级回调固定到 `@deepseek-ai/dsh@0.1.2-rc.1`，node-pty 维持 `1.2.0-beta.15`，native 配置文件与 CI 工作流同步改名 | <Badge type="tip" text="已修改" /> |
| PLAN-FNOS-002-TV-07 | 已发布插件清单补入 `@tnnevol/dsh-fnos`，并按精确版本固定安装：`@tnnevol/dsh-codex-auth@0.1.2-rc.1`、`@tnnevol/dsh-fnos@0.1.2-rc.1.1`；插件发布脚本改用 `--tag rc` | <Badge type="tip" text="已修改" /> |
| PLAN-FNOS-002-TV-08 | 确认 fnOS 插件客户端 `remote`/`remote.session` inject 声明完整（修复旧构建产物 `cannot get property "remote.session" without inject` 加载失败），并在 NAS 重装损坏副本 | <Badge type="warning" text="待 NAS 验证" /> |
| PLAN-FNOS-002-TV-09 | 在 `scripts` pnpm workspace 以 TypeScript/tsdown 合并 `version` 入口，使用 `@clack/prompts` 选择项目/FPK或指定插件，再由 `bumpp` 分别指定文件、提交信息和 Tag，废弃根目录自定义 `bump` 脚本 | <Badge type="tip" text="已完成" /> |

版本约束的验收以实际可安装、可启动和插件可加载为准；本地 package.json 一致不等于 NAS 验收完成。

## 详细交互

### P1：Codex 登录与用量状态

1. 未登录、登录状态加载失败或鉴权失效时，不展示“已登录”、周用量和五小时用量；保留登录入口和必要的错误反馈。
2. 登录成功后立即重新获取认证状态和用量，展示“已登录”与有效用量窗口。
3. 用户退出后立即清空 Client 中的认证和用量快照，不等待下一次定时刷新。
4. 配置面板在用量响应包含 18,000 秒窗口时增加“五小时使用限额”，同时保留每周窗口；不包含时不渲染五小时行。
5. 对话输入区状态栏只展示一个紧凑窗口，优先显示五小时窗口，没有时显示每周窗口；两个窗口都无法识别时隐藏状态栏。
6. 刷新按钮只触发重新读取，不改变插件设置；响应完成后两个入口使用同一份规范化结果。

### P1：NAS 引用与 Tree 状态同步

1. 用户在输入框已有文本后选择 NAS 文件或目录，插件在当前插入位置写入 DSH 引用。
2. 插入位置前是普通字符时，引用前补一个空格；前面已是空格、制表符或换行时不再补。
3. 插入位置位于文本中间时，前后文本和原始空白保持不变，不能对整个 draft 调用 `trim`、`trimEnd` 或正则归一化。
4. 一次选择多个引用时，引用之间保持可解析的单个分隔；用户原本输入的连续空格不参与清理。
5. 用户取消勾选或删除引用时，只移除对应 structured reference 和插件为该引用生成的分隔，光标回到可继续输入的位置。
6. Tree 面板打开时，插件记录输入框中已有的 fnOS occurrence ID；这些引用属于历史基线，不显示为本次 Tree 勾选。
7. 用户在当前面板勾选节点并成功插入引用后，插件记录该路径对应的本次 occurrence，而不是只记录路径文本。
8. 面板保持打开时，用户在输入框中删除本次 occurrence，Tree 立即取消对应节点的勾选；其他本次引用继续保持选中。
9. 删除或修改面板打开前就存在的历史 occurrence，不改变当前 Tree 的勾选状态。同一路径同时存在历史引用和本次引用时，两者按 occurrence 身份分别处理。
10. 面板关闭时清理操作基线和本次关联；再次打开后重新建立基线，不将上一次面板留下的引用同步为当前选中状态。

同步边界：

- 同步来源使用 `input.occurrences` 中 `source === 'fnos-file'` 的 structured reference，不解析 textarea 可见字符串猜测引用。
- `desiredPaths` 只表示当前面板操作状态；历史引用、其他插件引用和普通文本变化不写入该集合。
- 插件发起的取消勾选删除与用户直接删除要经过同一份关联状态，避免 effect 循环重复调用 `setDraft`。
- 插入尚未成功、draft revision 已过期或 occurrence 尚未出现时，不提前把节点标记为已关联；等待下一次输入快照确认。

### P1：Semi UI 组件总览路由

入口：`DSH 设置 → 插件 → DSH Semi UI → 打开组件总览`。

1. 设置卡片只展示插件用途和“打开组件总览”按钮，不在设置弹框内直接渲染组件样例。
2. 用户点击按钮后先关闭设置弹框，再通过 History API 进入 `#/plugins/semi-ui`；路由变化不触发整页请求，也不改变 fnOS 统一网关前缀。
3. 路由命中后，插件通过 `shell.overlay` 展示覆盖 DSH AppFrame 的总览页面。页面包含标题、返回按钮、组件分类导航和预览内容区。
4. 用户切换分类时只更新页面内部状态，URL 保持总览路由；每个组件样例显示名称、适用状态和实际可交互控件。
5. 用户点击返回按钮时优先执行 `history.back()`；如果页面由刷新或外部链接直接进入，则清除插件 Hash 并返回 DSH 默认页面。
6. 浏览器前进、后退和刷新必须恢复与 URL 一致的页面；非 `#/plugins/semi-ui` Hash 原样保留，插件不能接管未知路由。
7. 插件卸载或 HMR 时移除 `hashchange`、`popstate` 监听和 Slot 注册；如果用户正位于总览路由，页面回落到 DSH 默认界面，不留下遮罩。

页面布局：

- 顶部栏固定展示返回按钮、“DSH Semi UI”和当前主题状态。
- 左侧分类导航在窄屏下改为顶部横向分类，不新增独立滚动遮罩。
- 内容区按组件分组，每组展示默认状态和需要人工触发的浮层状态。
- Tooltip、Dropdown、Cascader、TreeSelect、Modal 等 Portal 组件必须在总览路由中验证主题 Token 和层级。
- 总览插件只导入 `@tnnevol/dsh-semi-ui`；发现缺少组件时先扩展共享包，再回到总览插件使用。

路由实现约束：

- 路由常量统一定义为 `SEMI_UI_SHOWCASE_ROUTE = '#/plugins/semi-ui'`，入口、控制器和测试共享同一来源。
- 路由状态和组件样例状态只存在于 Client，不增加 Host API、设置 schema 或持久化文件。
- 通过 `ctx.effect()` 管理浏览器事件和 Slot disposer，不在模块顶层安装永久监听。
- `shell.overlay` 是 list slot，注册项使用插件唯一 ID；页面根节点负责 `position: absolute; inset: 0` 和指针事件。
- 不注册 `conversation`、`sidebar` 或 `root`，避免替换 DSH 官方页面和子插槽。

### P1：三方插件 API URL 反代配置

入口：`DSH 设置 → 插件 → fnOS → API URL 反代`。

1. 卡片加载时读取服务端已保存路径，显示为当前值并建立独立草稿。
2. 用户点击“添加路径”增加输入项，填写 `/plugin-store` 这类 URL 路径前缀。
3. 用户可删除草稿项；修改期间不写设置文件，也不通知网关。
4. “保存”仅在草稿发生变化且所有路径有效时可用：
   - Client 统一提交完整路径数组。
   - Host 再次校验、规范化和去重。
   - DSH 设置和白名单 JSON 均成功后返回保存成功。
   - 网关监听配置并通过 SSE 推送，已打开页面无需刷新。
5. “放弃”丢弃当前草稿，恢复最近一次从服务端读取的路径。
6. 保存失败时保留草稿，显示明确错误；页面不会伪装成已生效。
7. 保存成功后 Client 重新读取服务端数据，展示真实配置。

路径输入约束：

- 必须是以单个 `/` 开头的 URL 绝对路径前缀，例如 `/plugin-store`。
- 不接受完整 URL、查询参数、Hash、协议相对路径、`.`、`..` 或百分号编码后的路径分隔符。
- 去除末尾 `/`，根路径 `/` 不允许配置。
- 使用路径边界匹配；`/plugin` 可以匹配 `/plugin` 与 `/plugin/a`，不能匹配 `/plugin-other`。
- `/api`、`/plugins` 和 `/__fnos-gateway` 属于系统保留路径，用户不能重复添加或覆盖。

该列表不是权限名单。命中只代表 bridge 为三方插件 API 请求补充统一网关前缀，实际访问仍受 fnOS 登录态、DSH 路由和三方插件自身权限约束。

### P1：DSH Web 重启按钮用户交互流程

1. DSH Web 正常时，网关透明代理请求；除左侧菜单的重启入口外，不展示额外恢复页面。
2. DSH Web 正常时，浏览器 Bridge 在左侧菜单追加“重启 Web”按钮；管理员点击后向网关发送重启请求，完成健康检查后自动刷新页面。
3. 网关发现上游连接失败后：
   - 已打开页面由 bridge 展示“DSH Web 已停止”的恢复提示。
   - 用户刷新或重新打开应用时，由网关直接返回独立恢复页面，不依赖 DSH 或 fnOS 插件加载。
4. 管理员在 Web 端点击“重启 Web”后，页面向网关控制路由发送同源 POST 请求；普通用户只看到不可用状态，不能执行重启操作。
5. 网关取得启动锁后启动新的 DSH Web，把候选 PID 写入 `app.pid.starting`，并周期检查 PID 和 `127.0.0.1:3080`。
6. 健康检查成功后，网关原子替换 `${TRIM_PKGVAR}/app.pid`，返回成功并重新加载 DSH 页面。
7. 重启失败或超时后，网关终止候选进程、清理临时 PID 和启动锁，保留恢复页面及错误摘要，允许再次点击“重启 Web”。
8. 并发请求命中已有启动任务时复用当前状态，不再次创建进程。
9. fnOS 执行 `cmd/main stop` 时，先阻止新的恢复操作，再停止 DSH Web 和网关，最后清理 PID、锁和 Socket。

控制路由建议使用 `/__fnos-gateway/control/web/start` 和 `/__fnos-gateway/control/web/status`。它们由网关自身处理，不转发到 DSH。

## 数据、权限和错误处理

### NAS 引用

- structured reference 的 `ref`、路径和序列化格式保持现有契约，只调整插入 span 与分隔字符。
- 不持久化输入框草稿，不把 NAS 路径复制到新的设置文件。
- 插入失败时保留当前 draft，不继续插入剩余引用；删除失败时不重写整段文本。
- 面板打开时保存 `operationBaselineOccurrenceIds`，本次关联单独保存 occurrence ID 与路径的映射；不能仅用 `Set<path>` 判断引用归属。
- 输入快照变化后，只对“本次关联集合减去当前 occurrence 集合”的差集取消 Tree 勾选；基线 occurrence 和未关联 occurrence 始终忽略。
- occurrence 尚未从插入事务回写时保留 pending 状态；确认成功或失败后再更新 Tree，避免异步快照使节点闪烁或误取消。
- 面板关闭、组件卸载、会话切换和 HMR 时清空基线、pending 与本次关联，防止状态串到下一次操作。
- 光标恢复只能定位当前活动输入框，组件卸载后不保留定时器或 DOM 引用。

### Semi UI 总览

- 总览状态只存在于 Client 组件内，不注册新的 Host 数据接口和设置 schema。
- 路由仅精确匹配 `#/plugins/semi-ui`；查询参数、未知 Hash 和 DSH 未来新增路由不由插件接管。
- 入口跳转前记录来源是否为插件内部导航；返回按钮不能无条件 `history.back()`，避免直接打开总览链接时离开 DSH 应用。
- Portal 浮层继续挂载到 DSH 页面，由共享主题安装器统一提供 Token；插件卸载时清理主题安装引用和 Slot 注册。
- 总览插件不得直接导入共享包未公开的内部文件，也不得复制 `theme.ts` 中的 CSS。

### 三方插件 API URL 反代配置

配置文件：

```json
{
  "version": 1,
  "paths": ["/plugin-store", "/my-plugin-api"]
}
```

| 项目 | 约束 |
| --- | --- |
| 文件位置 | `${TRIM_PKGVAR}/gateway/path-allowlist.json` |
| 写入方 | `@tnnevol/dsh-fnos` Host 插件 |
| 读取方 | `@tnnevol/fnos-gateway` |
| 持久化来源 | DSH fnOS 插件设置；插件启动时可补建缺失 JSON |
| 文件写入 | 同目录临时文件、完整校验、原子 rename |
| 文件监听 | 监听 `${TRIM_PKGVAR}/gateway` 目录，兼容原子替换文件 |
| 文件权限 | 仅应用运行用户可写；不包含 Token、用户身份或文件授权信息 |

错误处理：

- 文件不存在：使用空的自定义路径集合，保留 `/api` 和 `/plugins` 内置规则；fnOS 插件启动后按已保存设置生成文件。
- JSON 损坏、版本不支持或路径无效：记录错误并保留最后一次有效内存快照，不清空当前配置。
- `fs.watch` 事件重复：短防抖后重新读取完整文件，不依赖事件类型或文件名代表最终状态。
- watcher 创建失败：网关启动失败并给出明确日志，不增加轮询兜底。
- SSE 客户端断开：立即清理连接；浏览器由 `EventSource` 自动重连并获取最新快照。
- DSH 设置保存成功但 JSON 写入失败：Host 拒绝本次设置更新，Client 保留草稿并提示保存失败。
- 上游不可达：返回 502，不暴露内部堆栈、配置路径或请求凭据。

### DSH Web 进程状态

| 文件或状态 | 用途 | 生命周期 |
| --- | --- | --- |
| `${TRIM_PKGVAR}/gateway.pid` | fnOS FPK 运行状态的主 PID | 网关成功启动后写入，`cmd/main stop` 后删除 |
| `${TRIM_PKGVAR}/app.pid` | 当前已通过健康检查的 DSH Web PID | Web 启动成功后原子替换，停止时删除 |
| `${TRIM_PKGVAR}/app.pid.starting` | 候选 DSH Web PID | 启动期间存在，成功 rename，失败清理 |
| `${TRIM_PKGVAR}/web-start.lock` | 跨请求启动互斥 | 启动前原子创建，成功、失败或超时后释放 |

- `kill -0` 只能作为初筛；停止或替换 PID 前还要核对 `/proc/<pid>/cmdline` 与预期 DSH 命令，避免 PID 复用后误杀其他进程。
- FPK `status` 只判断网关控制面是否存活。DSH Web 状态通过网关状态接口展示为正常、启动中、已停止或启动失败。
- 控制路由必须经过 fnOS 统一网关认证，仅接受 `X-Trim-Isadmin: true`、同源且方法为 POST 的启动请求。
- 网关退出后不再具备恢复能力，此时 `cmd/main status` 返回 `3`，由 fnOS 应用中心负责重新启动整个应用。

### 网关与 fnOS 权限

- fnOS 统一网关负责登录校验并注入可信 `X-Trim-*` Header；代理不得接受客户端伪造的同名身份 Header 覆盖 fnOS 上下文。
- 代理目标只接受配置的回环主机和有效端口，不支持用户通过白名单修改上游地址。
- 路径前缀转换不扩大插件接口权限，不绕过 Host 端的用户、管理员或文件 ACL 校验。
- 去除 hop-by-hop Header，保留 DSH 所需的 Cookie、流式响应和 WebSocket Upgrade 行为。

### Codex 登录与用量

- 沿用现有 Host 端 OAuth 刷新和 WHAM 用量请求，浏览器不接触 Token 和账户凭据。
- Client 只接收剩余百分比、窗口时长和重置时间等安全字段。
- 不持久化五小时窗口，也不写入 `dsh-codex-auth` 设置。
- 401、网络错误、响应非对象或窗口字段无效时，不渲染登录成功和用量状态。

## 依赖、风险和决策

| 项目 | 风险或决策 | 处理方式 |
| --- | --- | --- |
| `connect` | 只提供中间件编排，不直接解决代理与 WebSocket | 与 `http-proxy-middleware` 组合，Node Server 仅监听 Unix Socket |
| `http-proxy-middleware` | `selfHandleResponse` 下需自行完成可改写响应 | 只缓冲 HTML/CSS/JS；SSE、下载和其他响应保持流式转发 |
| 单文件 FPK 产物 | NAS 上不应再安装网关依赖 | tsdown 将两个运行依赖内联，构建检查禁止残留外部 import |
| Bridge 源码与产物 | TypeScript 模板难以检查；运行时读取源码又会依赖仓库目录 | 独立维护 `bridge.js`，构建插件读取后内联；运行时不访问源码文件，避免 FPK 缺少资源 |
| Bridge 配置注入 | 直接字符串替换可能残留占位符或形成 `</script>` 提前闭合 | 配置统一 `JSON.stringify` 后注入，测试占位符、特殊字符和脚本闭合边界 |
| `fs.watch` | 原子替换会触发 rename，直接监听文件可能失效 | 监听父目录并重新读取完整文件；不使用轮询兜底 |
| 页面即时更新 | bridge 原本只在 HTML 加载时取得路径 | 增加内置 SSE 快照通道，打开页面原子替换 Set |
| 多页面连接 | 每个 DSH 页面都会保持 SSE | 维护连接集合，连接关闭或网关退出时统一清理 |
| 路径误配置 | 过宽路径可能改写非插件请求 | 禁止根路径和保留路径，按路径段边界匹配 |
| 配置职责 | 白名单容易被误解为权限控制 | UI 和文档统一称“三方插件 API URL 反代配置”，明确只做 URL 改写 |
| FPK 状态语义 | DSH Web 退出会让 fnOS 把整个应用标记为停止 | 以网关 PID 表示可管理的应用控制面，Web 状态单独展示 |
| PID 复用 | 仅使用 `kill -0` 可能把无关进程误认为 DSH | 停止前核对 `/proc/<pid>/cmdline`，候选 PID 通过健康检查后再发布 |
| 重复启动 | 多页面或重复点击可能创建多个 Web 进程 | 使用跨请求启动锁和共享启动状态，网关运行时不重复创建网关 |
| 恢复入口依赖 | DSH 插件随 Web 一起退出，无法承担恢复 UI | Web 端“重启 Web”按钮、恢复页面和控制路由直接由常驻网关提供 |
| NAS 引用分隔 | DSH 插入事务会自行追加尾随空格，重复补空格可能改动原文 | 纯函数计算前缀，测试 DSH 插入后的完整 draft，不对全文做 trim |
| Tree 反向同步 | 仅按路径同步会把面板打开前的同路径历史引用误认为本次选择 | 以面板打开基线和 occurrence 身份维护本次关联，历史引用不进入 `desiredPaths` |
| 输入快照时序 | 插入调用成功后 occurrence 可能在后续 revision 才出现，立即求差集会误取消勾选 | 增加 pending 关联阶段，收到对应 occurrence 或明确失败后再参与反向同步 |
| Semi UI 总览 | 总览插件和共享包可能循环依赖或重复打包 Semi | 总览插件单向依赖共享包，公共组件只从共享包导出，构建检查 bundle 契约 |
| DSH 页面路由 | `0.1.2-rc.1` 没有公开 Router/Page 注册服务，替换 single slot 会破坏官方页面 | 使用 Hash 路由和 `shell.overlay` list slot；精确匹配插件路由并完整清理监听与注册 |
| Portal 主题 | Tooltip、Modal 等浮层不在设置卡片 DOM 内 | 继续使用 body 级主题属性和 DSH 语义 Token，浅色/深色分别截图验证 |
| 认证状态竞争 | 退出后旧用量请求可能晚于状态更新返回 | 以最新认证快照或请求序号为准，未登录时丢弃旧用量结果 |
| WHAM 用量接口 | 字段可能变化 | Host 规范化，只依赖已存在的安全字段 |
| 窗口顺序 | 五小时窗口不保证固定位置 | 遍历全部窗口并按秒数匹配 |

## 测试、打包和发布

### 网关包检查

- 单元测试覆盖路径规范化、边界匹配、统一网关前缀剥离、Location 和资源路径改写。
- 代理集成测试覆盖 GET、POST、请求体、Cookie、错误响应、SSE、WebSocket 和上游断开。
- 动态配置测试覆盖首次加载、原子替换、重复事件、损坏 JSON、保留最后有效快照和 watcher 清理。
- bridge 测试覆盖 `fetch`、XHR、`EventSource`、WebSocket、动态脚本以及配置 SSE 即时更新。
- `bridge.js` 单独执行 JavaScript 语法检查；构建测试确认虚拟模块读取成功、运行时配置完成安全序列化，并且产物中没有 `__PREFIX__` 等未替换占位符。
- 进程恢复测试覆盖网关存活但 DSH 退出、同源管理员校验、普通用户拒绝、并发启动、健康检查成功/超时、临时 PID 清理和网关优雅停止。
- 运行：

```bash
pnpm --filter @tnnevol/fnos-gateway run typecheck
pnpm --filter @tnnevol/fnos-gateway run test
pnpm --filter @tnnevol/fnos-gateway run build
pnpm --filter @tnnevol/fnos-gateway run build:app
```

构建后检查 `apps/fn-deepseek-harness/app/gateway-proxy.mjs`：

- 是 Node 24 可运行的单文件 ESM。
- 不引用仓库 `node_modules`、源码相对路径或 NAS 不存在的依赖。
- 已包含 Bridge 内容，不在 NAS 运行时读取 `packages/fnos-gateway/src/client/bridge.js`，也不会同时执行内联脚本和 `<script src>` 版本。
- 输出位置与 `cmd/main` 的 `PROXY_SCRIPT` 一致。
- `app/ui/config` 继续声明 `gatewayPrefix` 和 `gatewaySocket: "app.sock"`。

### fnOS 插件检查

- Host 测试覆盖设置校验、原子 JSON 写入、失败回滚和启动补建。
- Client 测试覆盖草稿、添加、删除、保存、放弃、保存失败和重新读取。
- 引用测试覆盖已有文本无空格、已有空格、换行、多选引用、删除引用、插入失败和光标恢复；TreeSelect 集成/契约测试覆盖多个兄弟节点及父子路径同时选择且不丢失。
- Tree 同步测试覆盖本次单选/多选引用被直接删除、部分删除、历史引用删除、历史同路径与本次引用并存、异步 revision、关闭重开、会话切换和卸载清理。
- 运行：

```bash
pnpm --filter @tnnevol/dsh-fnos run typecheck
pnpm --filter @tnnevol/dsh-fnos run test
pnpm --filter @tnnevol/dsh-fnos run build
```

### Semi UI 共享包与总览插件检查

- 共享包导出契约测试覆盖总览插件使用的全部组件，不允许总览插件绕过公开入口深层导入 Semi。
- Client 注册测试确认设置入口和总览页面各注册一次，卸载后清理 Slot、路由监听和主题副作用。
- 路由测试覆盖入口跳转、直接刷新、前进、后退、返回按钮、未知 Hash、不重复挂载和 HMR 卸载。
- Slot 测试确认只注册 `settings.plugin.item` 与 `shell.overlay`，不注册 `conversation`、`sidebar` 或 `root`。
- 在浅色、深色和系统主题下人工检查组件状态，重点验证 Portal 浮层、边框、文字和选中态。
- 共享包先执行：

```bash
pnpm --filter @tnnevol/dsh-semi-ui run typecheck
pnpm --filter @tnnevol/dsh-semi-ui run test:unit
pnpm --filter @tnnevol/dsh-semi-ui run build
```

总览插件执行：

```bash
pnpm --filter @tnnevol/dsh-semi-ui-showcase run typecheck
pnpm --filter @tnnevol/dsh-semi-ui-showcase run test:unit
pnpm --filter @tnnevol/dsh-semi-ui-showcase run build
```

### Codex 插件检查

```bash
pnpm --filter @tnnevol/dsh-codex-auth run typecheck
pnpm --filter @tnnevol/dsh-codex-auth run test
pnpm --filter @tnnevol/dsh-codex-auth run build
```

测试至少覆盖未登录、登录、退出、鉴权失败，以及五小时窗口位于 primary、位于 secondary、只有每周窗口、缺少时长和接口失败；登录返回授权码时覆盖自动复制成功、剪切板拒绝和手动复制回退。

### FPK 与真实 NAS 验证

- 构建 FPK，确认生成的网关、fnOS 插件和 UI 配置正确打包。
- 安装后确认 Socket 位于 `${TRIM_APPDEST}/app.sock`，公开入口保持 `/app/fn-deepseek-harness`。
- 验证 fnOS 登录 Header、HTTP、SSE、WebSocket、静态资源、DSH 官方 API 和已安装插件 API。
- 在正常 DSH Web 左侧菜单点击“重启 Web”，确认网关重启上游并自动刷新；单独终止 DSH Web 后，确认 `cmd/main status` 仍返回运行、网关和 Socket 未重建，并能打开包含“重启 Web”按钮的恢复页面。
- 分别使用管理员和普通用户访问恢复入口；只有管理员可执行启动，连续点击不会产生多个 Web PID。
- 验证启动成功后正式 PID 原子更新并自动恢复 DSH 页面；模拟启动失败后，网关保持运行且临时 PID 和锁被清理。
- 终止网关后确认 `cmd/main status` 返回未运行，fnOS 应用中心仍可重新启动整个应用。
- 在设置中新增第三方路径并保存，不刷新页面直接请求对应接口，确认请求进入 DSH 3080。
- 删除路径并保存，确认已打开页面立即停止对该路径补前缀。
- 验证损坏 JSON 不清空当前有效路径，也不导致网关退出。
- 验证应用升级保留 `${TRIM_PKGVAR}` 配置；回滚时不删除 DSH 设置、会话、工作区、授权目录或白名单 JSON。
- 运行 `pnpm run check -- --sdd --docs`。
- 校验 DSH、插件依赖、FPK 安装回调、native 配置、发布清单和文档均指向 `0.1.2-rc.1`；在 NAS 安装/升级后检查用户数据和插件配置未被清理。

## 参考资料

| 能力 | 用途 | 参考资料 |
| --- | --- | --- |
| fnOS 统一网关 | `gatewayPrefix`、`gatewaySocket`、Unix Socket 和认证 Header | [fnOS 统一网关](https://developer.fnnas.com/docs/core-concepts/gateway-registration) |
| fnOS 环境变量 | 区分 `${TRIM_APPDEST}` 与 `${TRIM_PKGVAR}` | [fnOS 环境变量](https://developer.fnnas.com/docs/core-concepts/environment-variables) |
| fnOS 生命周期 | `cmd/main` 的 start、stop、status 和退出码 | [fnOS 应用框架](https://developer.fnnas.com/docs/core-concepts/framework) |
| connect | 网关中间件编排 | [connect](https://github.com/senchalabs/connect) |
| http-proxy-middleware | HTTP、WebSocket 和代理事件 | [http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware) |
| tsdown | 库构建与单文件 FPK 产物 | [tsdown](https://tsdown.dev/) |
| Node.js `fs.watch` | 监听配置目录 | [Node.js File system](https://nodejs.org/api/fs.html#fswatchfilename-options-listener) |
| EventSource | 向已打开页面推送完整配置快照 | [MDN EventSource](https://developer.mozilla.org/docs/Web/API/EventSource) |
| DSH 设置卡片 | Host/Client 设置命名空间和统一保存 | [DeepSeek Harness 设置卡片](https://deepseek-harness.github.io/deepseek-harness/reference/cookbook/adding-a-settings-card) |
| DSH 插件源码 | 插件契约和生命周期参考 | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) |
| DSH 输入引用 | structured reference、输入 Slot 和插入事务 | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) |
| DSH 页面插槽 | `shell.overlay` list slot 和插件生命周期 | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) |
| History API | Hash 路由的前进、后退和状态恢复 | [MDN History API](https://developer.mozilla.org/docs/Web/API/History_API) |
| Semi Design | 组件行为与按需引入 | [Semi Design](https://semi.design/zh-CN/) |

## 完成状态

| 阶段 | 状态 | 完成条件 |
| --- | --- | --- |
| 自动化测试质量门禁 | <Badge type="tip" text="已通过" /> | 根目录 `pnpm run test:unit` 的 39 个测试文件、157 条测试全部通过；不替代真实 NAS、FPK 和故障注入验收 |
| P1 Codex 登录与用量状态 | <Badge type="tip" text="已实现" /> | 插件测试通过，并在登录、退出、异常及有无五小时窗口场景验证显示结果 |
| P1 NAS 引用与 Tree 状态 | <Badge type="tip" text="已实现" /> | 插入和删除引用不改动原有文本空格；删除本次引用同步 Tree，历史引用隔离；覆盖多选与生命周期测试 |
| P1 Semi UI 总览插件 | <Badge type="tip" text="已实现" /> | 设置入口可跳转独立路由，刷新与历史导航有效；插件可安装卸载，公共组件在浅色、深色和系统主题下显示正常 |
| P1 FPK 网关、进程恢复与插件路径 | <Badge type="warning" text="部分 NAS 验证（7 条业务用例、157 条自动化测试通过）" /> | 自动化测试 157/157 通过；真实 NAS 已验证刷新、Web 重启、完整静态图片路径和 DSH iframe 恢复，剩余代理、实时连接、权限和升级回滚场景继续验证 |
| 版本统一（跨功能约束） | <Badge type="warning" text="待 FPK/NAS 验证" /> | 本地版本、依赖、安装回调、native 配置、发布清单和文档已统一为 `0.1.2-rc.1`，待目标 NAS 完成安装、升级和回滚验证 |

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-04 | 版本统一目标从 `0.1.2-alpha.4` 调整为 `0.1.2-rc.1`：pi-ai 对齐 `0.84.2`；FPK 回调、native 配置与 CI 同步；发布清单补入 `@tnnevol/dsh-fnos` 并按精确版本固定安装（codex-auth `0.1.2-rc.1`、fnos `0.1.2-rc.1.1`）；确认 fnos 插件 `remote.session` inject 修复（TV-05～TV-08）。 |
| 2026-09-04 | 增加 Codex 授权码自动复制任务（T01-06）。 |
| 2026-08-28 | 建立 PLAN-FNOS-002，纳入 Codex 五小时用量自动显隐 |
| 2026-08-28 | 将原 FNOS-003 合并到 FNOS-002-04，确定 `connect + http-proxy-middleware`、tsdown FPK 产物、持久 JSON、`fs.watch + SSE` 即时更新和保存/放弃交互 |
| 2026-08-28 | 将五小时用量并入 FNOS-002-01，并增加登录状态、NAS 引用空格和 Semi UI 总览插件计划 |
| 2026-08-29 | 使用 VitePress FlowGrid 重绘架构流程，并增加常驻网关承载状态和 DSH Web 人工恢复计划 |
| 2026-08-29 | 完善 Semi UI 总览计划：设置卡片改为入口，使用 `#/plugins/semi-ui` 与 `shell.overlay` 展示独立页面 |
| 2026-08-29 | 增加 fnOS Tree 反向同步计划：面板打开期间按 occurrence 身份同步本次引用删除，并隔离历史选择状态 |
| 2026-08-29 | 完成 P1 代码实现和本地构建，网关、恢复控制面与 fnOS Header 行为转入真实 NAS 验证 |
| 2026-08-30 | 修正 NAS 引用同步实现：匹配完整 ref、保留分隔空格归属、支持懒加载节点和部分插入，并补充 61 项插件测试 |
| 2026-08-30 | 合并需求编号并记录 NAS 验证结果：现行需求统一使用 FNOS-002-04，已验证 Web 正常重启且 FPK 应用状态保持启用 |
| 2026-08-31 | 迁移版本统一计划 | 将原 PLAN-FNOS-003 的版本、依赖、FPK、native 和发布任务迁移为本计划的跨功能约束；FNOS-003 改用于 FPK 应用运行设置 |
| 2026-08-31 | 同步刷新与重启验证状态 | 真实 fnOS 环境已验证侧边菜单刷新、重启均正常，刷新不会影响 iframe 外部页面 |
| 2026-09-01 | 补充真实 NAS 浏览器验收 | 7 条用例通过；记录 Codex 用量、TreeSelect、快捷键、主题、刷新/重启和静态资源 Network 证据，T04-10 进入部分 NAS 验证 |
| 2026-09-01 | 更新自动化测试状态 | 根目录 `pnpm run test:unit` 通过，39 个测试文件、157 条自动化测试全部通过；未将未完成真实环境验收的业务用例标记为通过 |
