# @tnnevol/dsh-codex-auth

这是一个面向 DSH `0.1.1-rc.2` 的 Codex OAuth 插件，提供 ChatGPT/Codex 登录、凭据同步、Codex 模型目录和图片输入能力。

## 功能

- 在 DSH Web 插件设置中登录和退出 ChatGPT/Codex 账号。
- 使用插件生成的一次性授权码完成 Codex 授权，不需要选择工作空间。
- 将 OAuth 凭据同步到 DSH 的通用凭据和模型适配器。
- 在模型设置中展示 OpenAI Codex 模型和登录状态。
- 直接展示 Codex 模型目录，支持模型列表选择、全选、恢复模型和获取模型。
- 可选启用图片识别和图片上传。

## 功能展示

文档中的图片支持点击打开大图，可进行缩放、拖拽、全屏查看和下载。

### Codex Auth 授权与用量

在「设置 → 插件」中可以完成 Codex 登录、退出登录和用量刷新，并查看每周使用限额的剩余比例。图片识别和图片上传能力也会在同一面板中明确展示当前状态。

![Codex Auth 授权、用量与图片能力设置](/images/plugins/dsh-codex-auth/settings.png)

### Codex 模型目录

在「设置 → 模型」中可以看到 Codex 登录状态和模型目录。模型目录支持获取模型、选择模型、编辑模型配置以及保存修改。

![OpenAI Codex 模型目录设置](/images/plugins/dsh-codex-auth/models.png)

## 安装

在 DSH 的 Web profile 中安装插件：

```sh
dsh plugin --profile web add @tnnevol/dsh-codex-auth
dsh --profile web --dump-config
```

安装后重启 Web profile。该插件不应与旧版 `dsh-codex-connect` 同时启用，以免重复注册 Codex 模型能力。

## 本地调试

插件开发环境要求 Node.js 24+，并使用本地 DSH CLI 调试：

```sh
pnpm --filter @tnnevol/dsh-codex-auth run check
pnpm --filter @tnnevol/dsh-codex-auth run build
pnpm dsh web --patch /absolute/path/to/fn-os-apps/plugins/dsh-codex-auth-plugin/cordis.patch.yml
```

## 项目链接

- [插件源码](https://github.com/tnnevol/fn-os-apps/tree/main/plugins/dsh-codex-auth-plugin)
- [插件 README](https://github.com/tnnevol/fn-os-apps/blob/main/plugins/dsh-codex-auth-plugin/README.md)
- [提交问题](https://github.com/tnnevol/fn-os-apps/issues)
