# Harness 插件

这里记录由三方飞牛应用项目维护的 DeepSeek Harness（dsh）插件。插件以独立的 pnpm workspace package 维护，源码和构建产物均位于仓库的 [`plugins/`](https://github.com/tnnevol/fn-os-apps/tree/main/plugins) 目录。

## 插件目录

| 插件 | 版本 | 作用 | 项目源码 |
| --- | --- | --- | --- |
| `@tnnevol/dsh-codex-auth` | `0.1.0-rc.7.2` | ChatGPT/Codex OAuth 登录、凭据同步和 Codex 模型适配 | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/plugins/dsh-codex-auth-plugin) |
| `@tnnevol/dsh-fnos` | `0.1.0-rc.7` | fnOS 主题桥接、NAS 主题事件和授权目录管理 | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/plugins/dsh-fnos-plugin) |

## @tnnevol/dsh-fnos

这是为 `fn-deepseek-harness` 开发的 fnOS 专用插件，提供 P0 主题能力和 P1 授权目录、工作区快捷跳转能力。插件源码继续在本仓库维护，但未发布版本不再随 FPK 本地打包：

- DSH 主题选择为“跟随系统”时，跟随 fnOS 当前主题和后续主题切换。
- DSH 主题选择为“浅色”或“深色”时，以 DSH 设置为准，不被 NAS 主题覆盖。
- 通过 `@trimjs/web-app` 的 `getPlatformConfig()` 获取初始主题，通过 `$on('os/theme')` 接收主题切换事件。
- 主题变化只通过 SDK 的 `$on('os/theme')` 事件同步，不额外执行轮询。
- `@trimjs/web-app` 作为插件的构建依赖，随插件客户端 bundle 一起内置到 FPK；运行时不需要 NAS 安装 pnpm，也不需要访问外部 CDN。

### 工作区快捷跳转

- 保留 DSH 原始工作区弹框、菜单和工作区打开逻辑，只接入官方公开的 `directoryFlow` 子流程。
- 点击原始“添加工作区”后展示已授权目录，超过 10 个目录时提供搜索，列表使用 fnOS 语义化路径。
- 点击目录或“选择其他目录”后交回 DSH 原生 `onPicked`；已有路径复用工作区，新路径由 DSH 登记为工作区后打开。
- “选择其他目录”调用 fnOS 目录选择器；取消操作静默结束，不修改 ACL、文件或会话数据。
- fnOS 应用 bundle 会禁用官方自动目录选择插件，避免同一个 DSH 目录流程插槽被重复占用；未修改 DSH 官方源码。

### 授权目录

在「设置 → 插件 → fnos」中：

- 展开卡片时读取应用当前已授权的 NAS 目录，并使用 `trim.file.convertPath` 转换为语义化路径后展示。
- 点击“添加授权目录”调用 fnOS `pickSharedFile()`，授权成功后立即重新读取列表。
- 点击“取消授权”前会确认操作；只移除应用 ACL，不删除目录或文件。
- `TRIM_DATA_SHARE_PATHS` 中的应用共享目录会出现在列表中，但仅展示，不提供删除/取消授权按钮。
- 列表、添加和删除请求由插件 Host 侧调用 fnOS API，浏览器不会接触 `TRIM_API_TOKEN`。
- 插件会合并 `TRIM_DATA_ACCESSIBLE_PATHS`、`TRIM_DATA_SHARE_PATHS` 与 fnOS 授权 API 的目录，按规范化路径去重。
- 目录展示使用 `trim.file.convertPath` 的语义化路径，删除请求仍使用 Host 内部的真实路径。
- 取消授权弹框或返回空结果时静默结束，不显示权限角色类红色警告。
- fnOS API 不可用、权限不足或当前页面不是 NAS iframe 时，卡片展示可理解的错误并保留刷新入口。

当前 P1 已完成代码和本地验证，仍需在真实 fnOS NAS 上验证 API Scope、权限环境变量、共享目录只读状态和删除行为。

FPK 只从 npm 安装发布清单中的插件。`@tnnevol/dsh-fnos` 发布后，需要将精确版本或 dist-tag 加入 `apps/fn-deepseek-harness/app/published-dsh-plugins.json`，安装和升级回调才会把它安装到 Web profile 并补齐 bundle 配置。主题首次渲染由 DSH 已保存的配置负责；插件启动后再通过 SDK 获取 fnOS 真实主题，并仅在 DSH 选择“跟随系统”时接管主题同步。

### 本地调试

在仓库根目录执行：

```sh
cd /absolute/path/to/fn-os-apps
pnpm --filter @tnnevol/dsh-fnos run check
pnpm --filter @tnnevol/dsh-fnos run build

cd /absolute/path/to/deepseek-harness
pnpm dsh plugin --profile web add /absolute/path/to/fn-os-apps/plugins/dsh-fnos-plugin
pnpm dsh --profile web
```

插件要求 DSH `0.1.0-rc.8`，可使用本地 DSH CLI 配合 `cordis.patch.yml` 调试。fnOS SDK 桥接只有在 fnOS micro app 宿主中启用，在独立浏览器中会安全跳过。

- [插件源码](https://github.com/tnnevol/fn-os-apps/tree/main/plugins/dsh-fnos-plugin)
- [插件 README](https://github.com/tnnevol/fn-os-apps/blob/main/plugins/dsh-fnos-plugin/README.md)

## @tnnevol/dsh-codex-auth

这是一个面向 DSH `0.1.0-rc.8` 的 Codex OAuth 插件，提供以下能力：

- 在 DSH Web 插件设置中登录和退出 ChatGPT/Codex 账号。
- 使用插件生成的一次性授权码完成 Codex 授权，不需要选择工作空间。
- 将 OAuth 凭据同步到 DSH 的通用凭据和模型适配器。
- 在模型设置中展示 OpenAI Codex 模型和登录状态。
- 直接展示 Codex 模型目录，支持模型列表选择、全选、恢复模型和获取模型。
- 可选启用图片识别；当前插件未启用 Codex 图像生成。

## 功能展示

文档中的图片支持点击打开大图，可进行缩放、拖拽、全屏查看和下载。

### Codex Auth 授权与用量

在「设置 → 插件」中可以完成 Codex 登录、退出登录和用量刷新，并查看每周使用限额的剩余比例。图片识别、图片上传和图像生成能力也会在同一面板中明确展示当前状态。

![Codex Auth 授权、用量与图片能力设置](/images/plugins/dsh-codex-auth/settings.png)

### Codex 模型目录

在「设置 → 模型」中可以看到 Codex 登录状态和模型目录。模型目录支持获取模型、选择模型、编辑模型配置以及保存修改。

![OpenAI Codex 模型目录设置](/images/plugins/dsh-codex-auth/models.png)

### 安装

在 DSH 的 Web profile 中安装插件：

```sh
dsh plugin --profile web add @tnnevol/dsh-codex-auth
dsh --profile web --dump-config
```

安装后重启 Web profile。该插件不应与旧版 `dsh-codex-connect` 同时启用，以免重复注册 Codex 模型能力。

### 本地调试

插件要求 Node.js 22.19+ 或 Node.js 24+，并使用本地 DSH CLI 调试：

```sh
pnpm --filter @tnnevol/dsh-codex-auth run check
pnpm --filter @tnnevol/dsh-codex-auth run build
pnpm dsh web --patch /absolute/path/to/fn-os-apps/plugins/dsh-codex-auth-plugin/cordis.patch.yml
```

### 项目链接

- [插件源码](https://github.com/tnnevol/fn-os-apps/tree/main/plugins/dsh-codex-auth-plugin)
- [插件 README](https://github.com/tnnevol/fn-os-apps/blob/main/plugins/dsh-codex-auth-plugin/README.md)
- [提交问题](https://github.com/tnnevol/fn-os-apps/issues)
