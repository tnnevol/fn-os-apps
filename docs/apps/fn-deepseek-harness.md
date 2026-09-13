<AppIcon name="fn-deepseek-harness" alt="DeepSeek Harness 图标" />

# DeepSeek Harness

## 应用简介

DeepSeek Harness 是 DeepSeek AI 开源的插件化智能代理工具。本应用通过 fnOS 统一网关以 iframe 方式打开 dsh Web UI。

## 主要能力

- 提供 DeepSeek Harness Web 操作界面。
- 通过 fnOS 应用入口访问，不需要单独暴露 Web 服务端口。
- 安装并启用固定版本的 [Codex Auth](/plugins/dsh-codex-auth)、[fnOS](/plugins/dsh-fnos) 插件和 dshmarket。
- 提供 fnOS 插件所需的文件权限、应用网关和数据目录。

## Harness 插件

FPK 安装和升级时会根据发布清单按精确版本安装插件：

- `@tnnevol/dsh-codex-auth@0.1.5-rc.2`：ChatGPT 账号登录 Codex、模型目录、用量和图片输入；内置归档随 FPK 分发；
- `@tnnevol/dsh-fnos@0.1.5-rc.2`：fnOS 主题、授权目录、NAS 文件访问和会话日志导出；
- `dshmarket@1.46.1`：三方插件，不进入 FPK；安装阶段通过 DSH CLI 单独安装，已安装时不会覆盖用户版本。

Codex 必须随 FPK 内置：registry 上 `latest`/`rc` 的 Codex 版本基线分别为 `0.1.0-rc.7` 和 `0.1.2-rc.1`，在 DSH `0.1.5-rc.2` 上会因 `@deepseek-ai/dsh-settings` 不再导出 `settingsNamespace` 而使 DSH Web 启动失败。升级老用户时不卸载、不删除、不覆盖已有 Codex 凭据、模型配置和 profile bundle。

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
- npm 官方源默认使用 `https://registry.npmjs.org/`；向导选择的源会持久化到 `${DSH_HOME}/.npmrc`，由 npm、pnpm 和 DSH CLI 统一读取，安装失败不会自动切换其他源。pnpm store 路径单独持久化到 `${DSH_HOME}/.pnpm-store-dir`，通过 `PNPM_CONFIG_STORE_DIR` 提供给 pnpm，避免 npm 报告未知的 `store-dir` 配置。安装阶段会先检查应用自己的 npm 全局目录中的 `pnpm@11.7.0`；固定版本的可执行文件已经存在且版本校验通过时直接复用，否则才安装该固定版本，供 DSH CLI 管理 profile 插件。
- 安装时同样检查应用自己的 npm 全局目录中的 `@deepseek-ai/dsh@0.1.5-rc.2` 及其 CLI 实际版本；本地存在且可执行时复用，否则使用 npm 安装该固定版本，并使用 FPK 内置的 `node-pty@1.2.0-beta.15` native 文件。
- Web profile 在首次执行 `dsh plugin --profile web add/update` 时由官方 CLI 自动初始化，插件通过 `dsh plugin --profile web add/update/remove` 管理，不再执行应用自定义插件脚本。选择 FPK 内置插件时，只将仓库中的本地插件制成 npm 归档并通过 DSH CLI 的 `file:` spec 安装，确保运行依赖可被解析；旧版 `link:` 安装会在升级时修复。清单中的三方插件不进入 FPK，仍由 DSH CLI 单独安装。
- 应用不注册公开的 `dsh` 系统命令：安装回调不生成 `app/bin/dsh` wrapper，`config/resource` 也不声明 `usr-local-linker`。飞牛 fnOS 未向非 root 调用者提供可用的身份切换机制（`runuser` 以非 root 执行时报 `may not be used by non-root users`，指定 `--group` 时报 `only root can specify alternative groups`，`su` 需要密码，`setpriv` 返回 `Operation not permitted`），且需求禁止依赖 setuid 或不受控的 sudo，因此由普通用户调用的 wrapper 无法保证以应用包用户身份执行。
- 安装回调会从 Web profile 的 `node_modules/.modules.yaml` 复用已有 pnpm store，并将最终路径持久化到 `${DSH_HOME}/.pnpm-store-dir`，避免应用目录从 `@appshare` 切换到 `@apphome` 后触发 `ERR_PNPM_UNEXPECTED_STORE`，同时不污染 npm 的 `.npmrc`。
- 该 store 路径在**运行期**同样生效：网关启动 DSH Web 时从 `${DSH_HOME}/.pnpm-store-dir` 读出安装期记录并注入 `PNPM_CONFIG_STORE_DIR`。否则 DSH Web 在 profile 目录里调用的 pnpm 会按 `@apphome` 推导出另一个 store，与 profile 固定的 store 不一致，导致插件安装与三方应用商店更新全部以 `ERR_PNPM_UNEXPECTED_STORE` 失败。记录缺失或非法时清除继承值，不做猜测。
- 应用安装、升级和启动前会复用已有 Web profile，保留用户配置、凭据、工作区和未列入新清单的旧插件；DSH CLI 在插件变更后负责写回 bundle 配置。
- `cmd/main` 只启动网关；网关以应用包用户直接运行真实 DSH CLI 启动 Web，捕获本轮启动 Token 后持久化。浏览器 iframe 地址始终不带 Token：仅首次不带 DSH 会话 Cookie 的首页请求会把 Token 注入上游以换取会话 Cookie，其后的上游请求只使用 Cookie。DSH 会对任何携带 Token 的首页请求返回 303 到干净路径，若对每个请求都注入 Token，就会出现“重定向次数过多”。

应用的 npm 镜像源、数据目录和环境变量详见应用目录中的 [README](https://github.com/tnnevol/fn-os-apps/blob/main/apps/fn-deepseek-harness/README.md)。

## 数据与卸载

应用使用 `DSH_HOME` 保存 dsh 相关内容，并通过 fnOS 的共享目录声明管理数据。卸载时可以选择保留数据，或卸载 `@deepseek-ai/dsh` 并清空应用数据目录。

## 相关链接

- [上游项目](https://github.com/deepseek-ai/deepseek-harness)
- [应用实现](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-deepseek-harness)
- [应用详细 README](https://github.com/tnnevol/fn-os-apps/blob/main/apps/fn-deepseek-harness/README.md)
