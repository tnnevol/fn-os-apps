# @tnnevol/dsh-codex-auth

一个独立的 DeepSeek Harness Codex OAuth 插件，适配 DSH `0.1.0-rc.7`。

## 功能

- 在 DSH Web 的“插件”设置中提供 ChatGPT 登录和退出登录入口。
- 通过 `@earendil-works/pi-ai` 发起 Codex device-code 授权，由插件展示一次性授权码并轮询登录结果。
- 授权页面不要求选择工作空间；用户只需在 Codex 授权页面提交插件生成的一次性代码。
- 复用 `dsh-codex-connect` 的凭据文件格式：`$DSH_HOME/.openai-codex-auth.json`。
- 复用 `dsh-llm-pi-ai` 的官方模型设置入口，使 OpenAI Codex 在模型列表中显示登录状态，并在编辑详情的“自定义设置”中显示可编辑的模型目录。
- OAuth 登录成功后，将当前 access token 同步到 `OPENAI_CODEX_AUTH_TOKEN` 凭据引用；OAuth 文件仍是唯一登录源，凭据引用只是给通用 pi-ai adapter 和官方模型页使用的镜像。
- Codex 编辑页隐藏通用的 API 密钥和 API 地址字段，避免用户误改 OAuth 管理的认证与端点；模型目录仍使用 DSH 官方编辑器。
- 获取可用模型的选择框增加“全选”，确认按钮文案为“添加”，并使用官方保存按钮的主色。
- 在“设置 → 插件 → Codex Auth”中提供图片识别开关；开启后按 DSH 附件规范注册 `view_image`，仅允许当前图片模型读取经过文件系统权限控制的本地图片。
- 图像生成开关会明确显示为当前不可用：DSH `rc.7` 的 Codex provider 只声明图片输入，不提供图像输出能力。
- 通过 DSH `rc.7` 的 keyed slot `settings.plugin.item` 注册 UI，并显式提供 `key`。

## 本地构建

在仓库根目录执行：

```sh
pnpm --filter @tnnevol/dsh-codex-auth install
pnpm --filter @tnnevol/dsh-codex-auth run check
```

## 使用本地 DSH CLI 调试

先确保本地 DSH 源码已经安装依赖并可运行，然后在 DSH 仓库目录执行：

```sh
pnpm --filter @tnnevol/dsh-codex-auth run build
pnpm dsh web --patch /absolute/path/to/fn-os-apps/plugins/dsh-codex-auth-plugin/cordis.patch.yml
```

`cordis.patch.yml` 使用包名加载 Host bundle；如果要调试尚未构建的源码，可将 patch 中的 `name` 改成源码入口的绝对路径，并使用 DSH skill 中的 `--patch` 调试流程。

## 安装到 profile

```sh
dsh plugin --profile web add @tnnevol/dsh-codex-auth
dsh --profile web --dump-config
```

安装后重新启动 Web profile。该插件不应与旧的 `dsh-codex-connect` 同时注册同一套 Codex 模型能力；迁移时请先停用旧插件，再启用本插件。
