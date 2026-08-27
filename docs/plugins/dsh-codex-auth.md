# Codex Auth

`@tnnevol/dsh-codex-auth` 为 DSH 提供 ChatGPT/Codex 登录、模型目录和账号用量。当前插件版本为 `0.1.1-rc.2.2`，适配 DSH `0.1.1-rc.2`。

## 安装

`fn-deepseek-harness` 会在安装和升级时自动安装 npm `rc` 标签对应的版本。其他 DSH 环境可以执行：

```sh
dsh plugin --profile web add @tnnevol/dsh-codex-auth@rc
dsh --profile web --dump-config
```

安装后重启 Web profile。旧版 `dsh-codex-connect` 不应与本插件同时启用，否则可能重复注册 Codex 模型和设置插槽。

## 登录与用量

打开「设置 → 插件 → Codex Auth」，点击「去登录」。插件会生成一次性授权码并打开 Codex 授权页面，不需要选择工作空间。授权码旁的复制按钮在 HTTP 页面中也可以使用。

登录成功后，面板会显示每周剩余用量和重置时间。点击「刷新」可以立即更新；登录等待状态和账号用量也会自动刷新。

![Codex Auth 登录、用量和能力设置](/images/plugins/dsh-codex-auth/settings.png)

## 全局模型

「全局模型」用于设置 DSH 会话默认使用的 Codex 模型和思考强度。选择器中的模型来自当前 Codex 模型目录；未配置时显示「请选择模型」。保存后，新建会话会采用这组默认值，仍可在对话输入区临时切换模型。

## 模型目录

在「设置 → 模型 → OpenAI Codex」中可以查看和同步模型目录：

- 「获取模型」读取当前可用模型；
- 「恢复模型」恢复插件内置目录；
- 模型选择弹框支持全选，确认后先更新编辑草稿，点击「保存」才会生效；
- Codex 的模型 ID 和显示名称为只读，其他供应商的模型字段不受影响；
- Codex 编辑器不展示 API 密钥和 API 地址，OAuth 凭据由插件单独管理。

![OpenAI Codex 模型目录](/images/plugins/dsh-codex-auth/models.png)

## 图片能力

图片能力默认关闭，可在 Codex Auth 面板中分别启用：

| 配置 | 作用 |
| --- | --- |
| 图片识别 | 注册 `view_image` 工具，让支持图片输入的 Codex 模型读取本地 PNG、JPEG、WebP 或 GIF |
| 图片上传 | 允许支持图片输入的 Codex 模型接收粘贴或上传到对话的图片 |

当前版本不提供图像生成。模型本身未声明图片输入能力时，即使打开开关也不能处理图片。

## 凭据与请求

OAuth 凭据保存在 `$DSH_HOME/.openai-codex-auth.json`，文件权限为 `0600`。插件会把有效访问令牌同步到 DSH 的通用凭据接口，退出登录时同时清理同步结果。

Web 设置通过同源插件路由访问 Host。使用 `fn-deepseek-harness` 时应从应用入口打开页面，不要绕过应用网关直接访问 DSH 监听端口。

## 排查

### 看不到插件卡片

确认组合配置包含插件：

```sh
dsh --profile web --dump-config | grep -n -C 3 'dsh-codex-auth'
```

如果出现 `cannot resolve profile bundle`，请重新执行 `dsh plugin --profile web add @tnnevol/dsh-codex-auth@rc`，不要只在 `package.json` 中手动补 bundle。

### 模型目录没有 OpenAI Codex

检查组合配置中是否同时存在 `dsh-codex-auth` 和 `llm-pi-ai` 的 `openai-codex` 提供方。旧版 `dsh-codex-connect` 或遗留补丁可能覆盖同一模型配置，应先备份再清理冲突项。

### 登录后仍无法读取用量

先点击「刷新」。账号用量来自 ChatGPT 的账号接口，网络异常、令牌过期或上游接口暂时不可用时，模型调用不一定同时失效。

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
