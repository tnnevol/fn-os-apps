# Harness 插件

这里记录由三方飞牛应用项目维护的 DeepSeek Harness（dsh）插件。插件以独立的 pnpm workspace package 维护，源码和构建产物均位于仓库的 [`plugins/`](https://github.com/tnnevol/fn-os-apps/tree/main/plugins) 目录。

## 插件目录

| 插件 | 版本 | 作用 | 项目源码 |
| --- | --- | --- | --- |
| `@tnnevol/dsh-codex-auth` | `0.1.0-rc.7.2` | ChatGPT/Codex OAuth 登录、凭据同步和 Codex 模型适配 | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/plugins/dsh-codex-auth-plugin) |
| `@tnnevol/dsh-fnos` | `0.1.0-rc.8` | fnOS 主题桥接、授权目录管理、工作区跳转和上下文文件访问 | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/plugins/dsh-fnos-plugin) |

## @tnnevol/dsh-fnos

这是为 `fn-deepseek-harness` 开发的 fnOS 专用插件，提供 P0 主题能力和 P1 授权目录、工作区快捷跳转能力。插件源码继续在本仓库维护，但未发布版本不再随 FPK 本地打包：

- DSH 主题选择为“跟随系统”时，跟随 fnOS 当前主题和后续主题切换。
- DSH 主题选择为“浅色”或“深色”时，以 DSH 设置为准，不被 NAS 主题覆盖。
- 通过 `@trimjs/web-app` 的 `getPlatformConfig()` 获取初始主题，通过 `$on('os/theme')` 接收主题切换事件。
- 主题变化只通过 SDK 的 `$on('os/theme')` 事件同步，不额外执行轮询。
- 当 DSH 选择“跟随系统”且运行在真实 fnOS Web 宿主时，将 fnOS 当前生效主题写入 `dsh-fnos-authorized-directories` 设置中的 `systemTheme` 字段；下次 Web profile 返回首页时，Host 先用该缓存替换 DSH 官方首屏 bootstrap，避免先显示浏览器系统主题、再切换到 NAS 主题。
- 该过程不会把 DSH 的 `system` 偏好改成固定的浅色或深色；显式选择浅色/深色时不写入 fnOS 主题缓存，并清理旧缓存。
- fnOS SDK 当前只提供 NAS 的最终生效主题（`light`/`dark`），没有提供“NAS 是否选择跟随系统”的独立偏好字段，因此插件只能在 DSH 为 `system`、SDK 处于真实 fnOS Web 宿主且设置可写时执行缓存同步。
- `@trimjs/web-app` 作为插件的构建依赖，随插件客户端 bundle 一起内置到 FPK；运行时不需要 NAS 安装 pnpm，也不需要访问外部 CDN。

### 工作区快捷跳转

- 保留 DSH 原始工作区弹框、菜单和工作区打开逻辑；插件只在路径栏左侧增加快捷入口。
- 目录流程保留 DSH 原始的路径输入、目录列表、目录打开、确认和取消语义；插件使用无文字的 fnOS 黑白 logo 按钮。
- 点击 fnOS logo 后打开插件自己的授权目录下拉面板，使用 fnOS 语义化路径展示；选中目录后将真实路径写回 DSH 原始路径输入框并触发原生 Enter 导航，随后仍由 DSH 原生 `onPicked` 完成工作区复用或登记。
- 插件目录列表超过 10 个目录时提供搜索；该入口只展示当前已授权目录和应用共享目录，不申请新 ACL，不调用 fnOS SDK 目录选择器。
- fnos 插件只使用 DSH 公开的目录流程插槽，不通过 fnOS 应用 bundle 禁用或替换官方目录选择器，也不修改 DSH 官方源码；官方目录流程与 fnOS 目录入口的兼容性由真实 NAS 验收确认。

### 内容输入框 NAS 文件和目录

- 内容输入框左侧使用彩色 fnOS 官方 logo 作为 TreeSelect 入口，通过 DSH 的 `conversation.input.left` 插槽加入，不覆盖其他插件按钮。
- 点击后打开按需加载的 Semi `TreeSelect`；树根和子目录通过 `/plugins/dsh-fnos/authorized-directories/entries` 懒加载，支持进入目录和多选。
- 该入口不调用 fnOS SDK 文件/目录选择器，也不弹出“选择文件/选择目录”的二级菜单；只有授权范围内的 NAS 路径可被选择，完整路径通过 Tooltip 查看。
- 选中的文件和目录以图标+名称块显示在输入框顶部，支持去重、取消勾选和逐项移除；输入文本不写入 NAS 路径，提交时 codec 将原始 NAS 路径发送到上下文。

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

### 上下文文件访问

点击 DSH 上下文、工具结果或生成文件中的路径时，插件会复用 DSH 的 `workspaces.openPath()` 入口。在 fnOS iframe 内，插件直接调用 `@trimjs/web-app` 的 `openFile(path)`，由 fnOS 文件应用和当前用户权限决定是否可以打开；不再先依据插件展示的授权目录列表做拦截，避免授权列表延迟或路径表示差异导致误报“尚未授权”。插件不调用 `xdg-open`，不会因为 NAS 缺少系统打开器而出现 `spawn xdg-open ENOENT`。独立浏览器仍使用 DSH 原生打开逻辑，便于本地调试。

FPK 只从 npm 安装发布清单中的插件。`@tnnevol/dsh-fnos` 发布后，需要将精确版本或 dist-tag 加入 `apps/fn-deepseek-harness/app/published-dsh-plugins.json`，安装和升级回调才会把它安装到 Web profile 并补齐 bundle 配置。主题首次渲染由 fnOS 插件在 Host 侧读取的 `systemTheme` 缓存参与；插件启动后再通过 SDK 获取 fnOS 真实主题，并仅在 DSH 选择“跟随系统”时接管主题同步。

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

插件开发环境要求 Node.js 24+，并使用本地 DSH CLI 调试：

```sh
pnpm --filter @tnnevol/dsh-codex-auth run check
pnpm --filter @tnnevol/dsh-codex-auth run build
pnpm dsh web --patch /absolute/path/to/fn-os-apps/plugins/dsh-codex-auth-plugin/cordis.patch.yml
```

### 项目链接

- [插件源码](https://github.com/tnnevol/fn-os-apps/tree/main/plugins/dsh-codex-auth-plugin)
- [插件 README](https://github.com/tnnevol/fn-os-apps/blob/main/plugins/dsh-codex-auth-plugin/README.md)
- [提交问题](https://github.com/tnnevol/fn-os-apps/issues)
