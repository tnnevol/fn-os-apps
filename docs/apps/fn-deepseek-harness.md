<AppIcon name="fn-deepseek-harness" alt="DeepSeek Harness 图标" />

# DeepSeek Harness

## 应用简介

DeepSeek Harness 是 DeepSeek AI 开源的插件化智能代理工具。本应用通过 fnOS 统一网关以 iframe 方式打开 dsh Web UI。

## 主要能力

- 提供 DeepSeek Harness Web 操作界面。
- 通过 fnOS 应用入口访问，不需要单独暴露 Web 服务端口。
- 支持 fnOS 主题同步和应用访问权限配置。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-deepseek-harness` |
| 目标平台 | x86 |
| 依赖 | `nodejs_v24` |
| 启动命令 | `dsh web --host <host> --port <port> --trusted-host <authority...>` |

## 安装配置

安装向导会配置监听地址、监听端口、可信访问地址和可选 npm 镜像源：

- 默认监听地址为 `127.0.0.1`，由 fnOS 统一网关访问。
- 默认端口为 `3080`，iframe 入口需要固定端口。
- 使用 `127.0.0.1` 时，可信访问地址填写打开 NAS Web 时浏览器地址栏中的 host 或 host:port。
- npm 官方源默认使用 `https://registry.npmjs.org/`；安装失败不会自动切换其他源。

应用的 npm 镜像源、数据目录和环境变量详见应用目录中的 [README](https://github.com/tnnevol/fn-os-apps/blob/main/apps/fn-deepseek-harness/README.md)。

## 数据与卸载

应用使用 `DSH_HOME` 保存 dsh 相关内容，并通过 fnOS 的共享目录声明管理数据。卸载时可以选择保留数据，或卸载 `@deepseek-ai/dsh` 并清空应用数据目录。

## 相关链接

- [上游项目](https://github.com/deepseek-ai/deepseek-harness)
- [应用实现](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-deepseek-harness)
- [应用详细 README](https://github.com/tnnevol/fn-os-apps/blob/main/apps/fn-deepseek-harness/README.md)
