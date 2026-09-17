# DeepSeek Harness

`fn-deepseek-harness` 是 DeepSeek Harness 的 fnOS Native 应用，通过 fnOS 网关以 iframe 打开 Web UI。

- 架构：x86
- 运行时：`nodejs_v24`
- DSH：`0.1.5-rc.2`
- Web 入口：`/app/fn-deepseek-harness`

## 功能

- DSH Web 界面和 fnOS 文件入口
- CodeBuddy、Codex Auth 等插件集成
- CodeBuddy 成长任务、任务中心和执行日志
- NAS 目录授权、文件引用和会话日志导出
- 第三方插件 API 反向代理

## 安装与运行

安装回调会检查并准备固定版本的 DSH、pnpm 和插件。已满足版本时直接复用，不会删除用户的 profile、凭据、会话或工作区。

DSH 数据目录为 `${TRIM_PKGHOME}`，npm 和 pnpm 配置也保存在该目录。npm 源由安装向导配置，失败时不会自动切换其他源。

应用使用 fnOS 包用户运行，不提供公开的 `dsh` 系统命令。管理员如需调用 CLI，请使用应用私有路径：

```bash
${DSH_HOME}/.npm-global/bin/dsh --help
```

常用命令：

```bash
dsh --profile web --dump-config
dsh plugin --profile web add <plugin>@<version>
dsh plugin --profile web update <plugin>@<version>
dsh plugin --profile web remove <plugin>
```

应用由 fnOS 网关管理，DSH Web 使用：

```bash
dsh web --no-open --host <host> --port <port> --trusted-host <authority...>
```

## node-pty native 文件

正式 FPK 需要在 Linux 构建机上准备 node-pty native 文件。构建机必须有 Node.js 24、g++、make 和 python3。

从仓库根目录构建时，选择内置 node-pty，或使用非交互参数：

```bash
pnpm run build -- \
  --fpk \
  --app fn-deepseek-harness \
  --bundle-dsh-native \
  --skip-bundle-dsh-plugins
```

构建流程会执行 `.github/scripts/prepare-dsh-native.sh`，并将文件写入：

```text
app/native/node-pty/<version>/pty.node
app/dsh-version
app/node-pty-versions
```

直接在应用目录执行 `fnpack build` 不会准备 native 文件。没有 native 文件且 NAS 没有 g++ 时，安装会失败。

## 数据目录

| 内容 | 路径 |
| --- | --- |
| DSH 数据 | `${TRIM_PKGHOME}` |
| npm 全局目录 | `${DSH_HOME}/.npm-global` |
| npm 配置 | `${DSH_HOME}/.npmrc` |
| pnpm store | `${TRIM_APPDEST_VOL}/@appshare/fn-deepseek-harness/.local/share/pnpm/store` |
| 网关运行数据 | `${TRIM_PKGVAR}` |

## 构建

```bash
pnpm run build -- --fpk --app fn-deepseek-harness --bundle-dsh-native --skip-bundle-dsh-plugins
```

生成的 FPK 位于 `apps/fn-deepseek-harness/`。正式发布包由 GitHub Actions 在 Linux runner 上构建。

## 卸载

卸载时可选择保留或删除应用数据。删除数据会清理 DSH、profile、凭据、会话和应用目录。
