# Harness 插件

这里集中维护 fn-os-apps 提供的 DeepSeek Harness 插件和共享 UI 包。功能说明以文档站为准，插件目录里的 README 只保留 npm 包所需的简短介绍。

## 插件

| 包名 | 版本 | 适用场景 | 文档 | 源码 |
| --- | --- | --- | --- | --- |
| `@tnnevol/dsh-codex-auth` | `0.1.1-rc.2.2` | 使用 ChatGPT 账号登录 Codex，并把模型、用量和图片输入能力接入 DSH | [Codex Auth](/plugins/dsh-codex-auth) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/plugins/dsh-codex-auth-plugin) |
| `@tnnevol/dsh-fnos` | `0.1.1-rc.2.2` | 在 fnOS 中补充主题、授权目录、NAS 文件访问和会话日志导出 | [fnOS](/plugins/dsh-fnos) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/plugins/dsh-fnos-plugin) |

两个插件均适配 DSH `0.1.1-rc.2`。npm 的 `latest` 标签可能仍指向旧版本，手动安装时请使用 `rc` 标签。

## 共享 UI

[`@tnnevol/dsh-semi-ui`](/plugins/dsh-semi-ui) 统一封装插件使用的 Semi Design 组件，并将亮色、深色、交互色和浮层样式映射到 DSH 主题变量。它是仓库内部共享包，不是需要单独安装到 Web profile 的运行时插件。

## 在 fnOS 应用中安装

`fn-deepseek-harness` 安装或升级时，会按照 [`published-dsh-plugins.json`](https://github.com/tnnevol/fn-os-apps/blob/main/apps/fn-deepseek-harness/app/published-dsh-plugins.json) 将已发布插件安装到 Web profile。应用启动阶段只检查插件是否可解析，不会临时从工作空间源码构建插件。

在其他 DSH 环境中可以手动安装：

```sh
dsh plugin --profile web add @tnnevol/dsh-codex-auth@rc
dsh plugin --profile web add @tnnevol/dsh-fnos@rc
dsh --profile web --dump-config
```

安装完成后重启 Web profile。不要直接编辑 `profiles/web/package.json` 添加 bundle；使用 `dsh plugin` 命令可以同时维护依赖和 profile 配置。

## 兼容要求

- DSH：`0.1.1-rc.2`
- Node.js：`^22.19.0` 或 `>=24.0.0`
- fnOS 专用能力：需要在 fnOS 应用 iframe 中运行
- 问题反馈：[GitHub Issues](https://github.com/tnnevol/fn-os-apps/issues)
