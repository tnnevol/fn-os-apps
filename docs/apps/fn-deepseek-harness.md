<AppIcon name="fn-deepseek-harness" alt="DeepSeek Harness 图标" />

# DeepSeek Harness

## 应用简介

DeepSeek Harness 是 DeepSeek AI 开源的插件化智能代理工具。本应用通过 fnOS 统一网关以 iframe 方式打开 dsh Web UI。

## 主要能力

- 提供 DeepSeek Harness Web 操作界面。
- 通过 fnOS 应用入口访问，不需要单独暴露 Web 服务端口。
- 提供 [`@tnnevol/dsh-fnos`](../plugins/) 所需的 fnOS 权限和应用网关；插件发布并加入 FPK 发布清单后可启用主题、授权目录和工作区适配。

### fnOS 主题同步

安装 `@tnnevol/dsh-fnos` 后，当 DSH 主题设置为“跟随系统”时，插件会通过 fnOS Web SDK 获取当前主题，并监听 `os/theme` 事件同步后续切换；设置为“浅色”或“深色”时，以 DSH 自身设置为准。主题变化只依赖 SDK 事件，不执行额外轮询。

### 授权目录

安装 `@tnnevol/dsh-fnos` 后，在「设置 → 插件 → fnos」中可以查看当前应用已授权的 NAS 目录。列表使用 fnOS 的语义化路径展示，不直接显示 `/vol1/...` 这类内部路径。点击“添加授权目录”打开 fnOS 目录选择器，授权成功后列表立即刷新；点击目录后的“取消授权”只移除应用 ACL，不删除目录或文件。`TRIM_DATA_SHARE_PATHS` 中声明的应用共享目录也会在列表中展示，但不提供删除/取消授权入口。授权目录能力依赖应用的 `trim.file.sharedAccess` 和 `trim.file.path` 权限；打开文件、浏览目录内容还会使用 `trim.file.userAcl` 检查当前网关用户，真实 NAS 权限行为以系统校验为准。

插件安装后，在原始 DSH 工作区弹框中点击“添加工作区”，会在官方公开的目录流程中展示已授权目录；超过 10 个目录时提供搜索，并支持通过 fnOS logo 选择其他目录。选中结果交回 DSH 原生工作区流程，由 DSH 复用已有工作区或登记新路径后打开。插件不会修改 ACL、复制文件或接管整个工作区菜单。取消授权弹框或返回空结果时静默结束，不显示权限角色类红色警告。插件会合并 fnOS 授权 API、`TRIM_DATA_ACCESSIBLE_PATHS` 和 `TRIM_DATA_SHARE_PATHS` 并去重，页面只展示语义化路径。

### 上下文文件访问

点击 DSH 上下文、工具结果或生成文件中的路径时，插件会复用 DSH 原有入口。在 fnOS iframe 内，插件直接调用 `@trimjs/web-app` 的 `openFile()`，由 fnOS 文件应用和当前用户权限决定是否可以打开；不再依据插件展示的授权目录列表预先拦截，避免已授权路径因为列表延迟或路径表示差异被误判。该流程不调用 Linux `xdg-open`，因此不依赖 NAS 安装 `xdg-utils`。独立浏览器调试时继续使用 DSH 原生行为。

当前 FPK 只从 npm 安装发布清单中的插件，不包含未发布的 `@tnnevol/dsh-fnos` 本地构建产物。插件发布后，需要将精确版本加入应用发布清单才会随 FPK 自动安装。

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
- 安装时固定检查应用全局 npm 前缀中的 `@deepseek-ai/dsh@0.1.0-rc.8`；本地存在该精确版本时复用，否则安装该固定版本，并使用 FPK 内置的 `node-pty@1.2.0-beta.15` native 文件。
- 应用安装、升级和启动前会自动修复旧版 Web profile 的官方 bundle 基线（`@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`），并保留已有的第三方插件和用户配置；这两个 bundle 缺失时，终端、Agent 循环和网页搜索设置卡片不会出现。安装器只维护官方 bundle 基线和发布清单中的插件，不会对 `@tnnevol/dsh-fnos` 执行额外的本地依赖迁移、删除或补丁操作。

应用的 npm 镜像源、数据目录和环境变量详见应用目录中的 [README](https://github.com/tnnevol/fn-os-apps/blob/main/apps/fn-deepseek-harness/README.md)。

## 数据与卸载

应用使用 `DSH_HOME` 保存 dsh 相关内容，并通过 fnOS 的共享目录声明管理数据。卸载时可以选择保留数据，或卸载 `@deepseek-ai/dsh` 并清空应用数据目录。

## 相关链接

- [上游项目](https://github.com/deepseek-ai/deepseek-harness)
- [应用实现](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-deepseek-harness)
- [应用详细 README](https://github.com/tnnevol/fn-os-apps/blob/main/apps/fn-deepseek-harness/README.md)
