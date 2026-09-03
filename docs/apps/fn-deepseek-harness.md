<AppIcon name="fn-deepseek-harness" alt="DeepSeek Harness 图标" />

# DeepSeek Harness

## 应用简介

DeepSeek Harness 是 DeepSeek AI 开源的插件化智能代理工具。本应用通过 fnOS 统一网关以 iframe 方式打开 dsh Web UI。

## 主要能力

- 提供 DeepSeek Harness Web 操作界面。
- 通过 fnOS 应用入口访问，不需要单独暴露 Web 服务端口。
- 安装已发布的 [Codex Auth](/plugins/dsh-codex-auth) 和 [fnOS](/plugins/dsh-fnos) 插件。
- 提供 fnOS 插件所需的文件权限、应用网关和数据目录。

## Harness 插件

FPK 安装和升级时会根据发布清单安装 npm `rc` 标签对应的插件：

- `@tnnevol/dsh-codex-auth`：ChatGPT/Codex 登录、模型目录、全局模型、用量和图片输入；
- `@tnnevol/dsh-fnos`：fnOS 主题、授权目录、NAS 文件访问和会话日志导出。

插件功能、兼容版本和排查命令统一维护在[插件总览](/plugins/)中，应用文档不再重复记录插件内部实现。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-deepseek-harness` |
| 目标平台 | x86 |
| 依赖 | `nodejs_v24` |
| 启动命令 | `dsh web --no-open --host <host> --port <port> --trusted-host <authority...>` |

## 安装配置

安装向导会配置监听地址、监听端口、可信访问地址和可选 npm 镜像源：

- 默认监听地址为 `127.0.0.1`，由 fnOS 统一网关访问。
- 默认端口为 `3080`，iframe 入口需要固定端口。
- 使用 `127.0.0.1` 时，可信访问地址填写打开 NAS Web 时浏览器地址栏中的 host 或 host:port。
- npm 官方源默认使用 `https://registry.npmjs.org/`；安装失败不会自动切换其他源。应用安装、升级和卸载流程统一使用 `nodejs_v24` 提供的 npm，不会安装或卸载 pnpm。
- 安装时固定检查应用自己的 npm 全局目录中的 `@deepseek-ai/dsh@0.1.2-alpha.4`；本地存在该精确版本时复用，否则使用 npm 安装该固定版本，并使用 FPK 内置的 `node-pty@1.2.0-beta.15` native 文件。
- 应用安装、升级和启动前会自动修复旧版 Web profile 的官方 bundle 基线（`@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`），并保留已有的第三方插件和用户配置；这两个 bundle 缺失时，终端、Agent 循环和网页搜索设置卡片不会出现。安装器只维护官方 bundle 基线和发布清单中的插件，不会对 `@tnnevol/dsh-fnos` 执行额外的本地依赖迁移、删除或补丁操作。

应用的 npm 镜像源、数据目录和环境变量详见应用目录中的 [README](https://github.com/tnnevol/fn-os-apps/blob/main/apps/fn-deepseek-harness/README.md)。

## 数据与卸载

应用使用 `DSH_HOME` 保存 dsh 相关内容，并通过 fnOS 的共享目录声明管理数据。卸载时可以选择保留数据，或卸载 `@deepseek-ai/dsh` 并清空应用数据目录。

## 相关链接

- [上游项目](https://github.com/deepseek-ai/deepseek-harness)
- [应用实现](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-deepseek-harness)
- [应用详细 README](https://github.com/tnnevol/fn-os-apps/blob/main/apps/fn-deepseek-harness/README.md)
