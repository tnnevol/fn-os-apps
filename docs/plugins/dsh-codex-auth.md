# Codex Auth

`@tnnevol/dsh-codex-auth` 为 DSH 提供 ChatGPT/Codex 登录、模型目录和账号用量。当前插件版本为 `0.1.2-rc.1`，适配 DSH `0.1.2-rc.1`。

## 安装

`fn-deepseek-harness` 会在安装和升级时自动安装 npm `rc` 标签对应的版本。其他 DSH 环境可以执行：

```sh
dsh plugin --profile web add @tnnevol/dsh-codex-auth@rc
dsh --profile web --dump-config
```

安装后重启 Web profile。旧版 `dsh-codex-connect` 不应与本插件同时启用，否则可能重复注册 Codex 模型和设置插槽。

## 登录与用量

打开「设置 → Codex Auth」，点击「去登录」。插件会生成一次性授权码并打开 Codex 授权页面，不需要选择工作空间。授权码旁的复制按钮在 HTTP 页面中也可以使用。

登录成功后，账号用量不再在设置页展示；对话输入区右侧的紧凑用量状态保留，优先显示五小时窗口，没有五小时窗口时显示每周窗口。点击该状态可展开查看剩余额度与重置时间。

![Codex Auth 登录与设置](/images/plugins/dsh-codex-auth/settings.png)

## 全局模型

「全局模型」用于设置 DSH 会话默认使用的 Codex 模型和思考强度。选择器中的模型来自当前 Codex 模型目录；未配置时显示「请选择模型」。保存后，新建会话会采用这组默认值，仍可在对话输入区临时切换模型。

## 刷新模型目录

Codex Auth 页面提供「刷新模型目录」按钮。点击后插件读取当前 ChatGPT 账号**实际可用**的 Codex 模型与思考强度，并同步到 DSH 的 OpenAI Codex 模型配置；刷新成功后，消息框模型选择器与全局模型选择器都会显示账号当前可用的模型。内部服务型条目（如自动审查、预留位）不会写入，思考级别只保留 DSH 支持的范围。

- 刷新需要已登录；未登录时按钮不显示。
- 刷新失败（网络异常、接口不可用、写入被拒绝）会保留上一次有效的模型列表，并在页面显示错误提示。
- 账号接口与内置静态目录不一致时（例如上游发布了新模型而 DSH 内置表尚未更新），以刷新后的账号列表为准。

## 图片能力

图片能力默认关闭，可在 Codex Auth 页面中分别启用：

| 配置 | 作用 |
| --- | --- |
| 图片识别 | 注册 `view_image` 工具，让支持图片输入的 Codex 模型读取本地 PNG、JPEG、WebP 或 GIF |
| 图片上传 | 允许支持图片输入的 Codex 模型接收粘贴或上传到对话的图片 |

当前版本（DSH `0.1.2-rc.1`）不提供图像生成或图像输出，仅支持图片识别和图片上传。模型本身未声明图片输入能力时，即使打开开关也不能处理图片。

## 凭据与请求

OAuth 凭据保存在 `$DSH_HOME/.openai-codex-auth.json`，文件权限为 `0600`。插件会把有效访问令牌同步到 DSH 的通用凭据接口，退出登录时同时清理同步结果。

Web 设置通过同源插件路由访问 Host。使用 `fn-deepseek-harness` 时应从应用入口打开页面，不要绕过应用网关直接访问 DSH 监听端口。

## 排查

### 看不到 Codex Auth 设置页

确认组合配置包含插件：

```sh
dsh --profile web --dump-config | grep -n -C 3 'dsh-codex-auth'
```

如果出现 `cannot resolve profile bundle`，请重新执行 `dsh plugin --profile web add @tnnevol/dsh-codex-auth@rc`，不要只在 `package.json` 中手动补 bundle。插件安装后，「设置」侧栏会出现 Codex Auth 入口。

### 刷新模型目录后模型没有变化

- 确认页面显示「已登录」；刷新按钮只在登录后出现。
- 刷新成功后需在消息框模型选择器中重新查看——DSH 会在写入后重建模型目录，但已打开的页面可能需要刷新一次。
- 若显示错误提示，说明上游接口或配置写入暂时失败，当前仍保留上一次有效模型列表，可稍后重试。

## 本地开发

在仓库根目录执行检查：

```sh
pnpm --filter @tnnevol/dsh-codex-auth run check
```

将源码包安装到本地 Web profile 后启动 DSH：

```sh
dsh plugin --profile web add /absolute/path/to/fn-os-apps/plugins/dsh-codex-auth-plugin
dsh web --no-open
```

## 链接

- [npm](https://www.npmjs.com/package/@tnnevol/dsh-codex-auth)
- [源码](https://github.com/tnnevol/fn-os-apps/tree/main/plugins/dsh-codex-auth-plugin)
- [问题反馈](https://github.com/tnnevol/fn-os-apps/issues)
