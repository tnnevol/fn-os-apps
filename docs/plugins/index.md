# Harness 插件

这里记录由三方飞牛应用项目维护的 DeepSeek Harness（dsh）插件。插件以独立的 pnpm workspace package 维护，源码和构建产物均位于仓库的 [`plugins/`](https://github.com/tnnevol/fn-os-apps/tree/main/plugins) 目录。

## 插件目录

| 插件 | 版本 | 作用 | 使用文档 | 项目源码 |
| --- | --- | --- | --- | --- |
| `@tnnevol/dsh-codex-auth` | `0.1.1-rc.2.2` | ChatGPT/Codex OAuth 登录、凭据同步和 Codex 模型适配 | [Codex Auth](/plugins/dsh-codex-auth) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/plugins/dsh-codex-auth-plugin) |
| `@tnnevol/dsh-fnos` | `0.1.1-rc.2.2` | fnOS 主题桥接、授权目录管理、工作区跳转和上下文文件访问 | [fnOS](/plugins/dsh-fnos) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/plugins/dsh-fnos-plugin) |

## 集成说明

- FPK 只从 npm 安装已发布插件，不集成工作空间中的未发布源码。
- 插件通过应用的 `published-dsh-plugins.json` 发布清单安装到 DSH Web profile。
- 两个插件共用 `@tnnevol/dsh-semi-ui`，统一管理按需引入的 Semi UI 组件和 DSH 主题样式。
- 插件要求与当前应用匹配的 DSH 版本；安装、升级和本地调试请以各插件文档为准。
