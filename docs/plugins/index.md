# Harness 插件

这里记录由三方飞牛应用项目维护的 DeepSeek Harness（dsh）插件。插件以独立的 pnpm workspace package 维护，源码和构建产物均位于仓库的 [`plugins/`](https://github.com/tnnevol/fn-os-apps/tree/main/plugins) 目录。

## 插件目录

| 插件 | 版本 | 作用 | 项目源码 |
| --- | --- | --- | --- |
| `@tnnevol/dsh-codex-auth` | `0.1.0-rc.7.1` | ChatGPT/Codex OAuth 登录、凭据同步和 Codex 模型适配 | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/plugins/dsh-codex-auth-plugin) |
| `@tnnevol/dsh-fnos` | `0.1.0-rc.7` | fnOS 主题桥接：跟随 NAS 主题事件，同时保留 DSH 手动主题优先级 | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/plugins/dsh-fnos-plugin) |

## @tnnevol/dsh-fnos

这是随 `fn-deepseek-harness` FPK 内置的 fnOS 专用插件，当前完成 P0 主题能力：

- DSH 主题选择为“跟随系统”时，跟随 fnOS 当前主题和后续主题切换。
- DSH 主题选择为“浅色”或“深色”时，以 DSH 设置为准，不被 NAS 主题覆盖。
- 通过 `@trimjs/web-app` 的 `getPlatformConfig()` 获取初始主题，通过 `$on('os/theme')` 接收主题切换事件。
- 主题变化只通过 SDK 的 `$on('os/theme')` 事件同步，不额外执行轮询。
- 插件和 SDK 均由 FPK 内置，不依赖 NAS 安装 pnpm 或访问外部 CDN。

应用每次安装、升级和启动前都会将插件放入 Web profile 的本地 `node_modules` 并补齐 profile bundle 配置。插件的客户端入口使用 DSH 的 `immediately` bundle 机制，在主题模块首次创建前安装 fnOS-backed `matchMedia`，避免首次打开时主题状态落后于 NAS。

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

插件要求 DSH `0.1.0-rc.7`，可使用本地 DSH CLI 配合 `cordis.patch.yml` 调试。fnOS SDK 桥接只有在 fnOS micro app 宿主中启用，在独立浏览器中会安全跳过。

- [插件源码](https://github.com/tnnevol/fn-os-apps/tree/main/plugins/dsh-fnos-plugin)
- [插件 README](https://github.com/tnnevol/fn-os-apps/blob/main/plugins/dsh-fnos-plugin/README.md)

## @tnnevol/dsh-codex-auth

这是一个面向 DSH `0.1.0-rc.7` 的 Codex OAuth 插件，提供以下能力：

- 在 DSH Web 插件设置中登录和退出 ChatGPT/Codex 账号。
- 使用插件生成的一次性授权码完成 Codex 授权，不需要选择工作空间。
- 将 OAuth 凭据同步到 DSH 的通用凭据和模型适配器。
- 在模型设置中展示 OpenAI Codex 模型和登录状态。
- 直接展示 Codex 模型目录，支持模型列表选择、全选、恢复模型和获取模型。
- 可选启用图片识别；DSH `rc.7` 暂不支持 Codex 图像生成。

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
