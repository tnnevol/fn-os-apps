# DeepSeek Harness

`fn-deepseek-harness` 是 DeepSeek Harness 的 fnOS Native 应用封装，通过 fnOS 统一网关以 iframe 方式打开 Web UI。

- 上游项目：[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
- 架构：`x86`
- 运行时依赖：`nodejs_v24`
- 应用版本：以 [`manifest`](manifest) 中的 `version` 为准
- Web 入口：`/app/fn-deepseek-harness`

## 启动方式

发布的 FPK 固定适配 `@deepseek-ai/dsh@0.1.5-rc.2`，并固定预编译 `node-pty@1.2.0-beta.15`。安装回调会先在应用自己的 npm 全局目录中检查 `pnpm@11.7.0` 和 `@deepseek-ai/dsh@0.1.5-rc.2` 的可执行文件及实际版本；固定版本已经安装且 CLI 版本校验通过时直接复用并跳过安装，只有缺失、不可执行或版本不匹配时才安装固定版本。安装完成后，回调会从已安装 DSH 依赖树读取 `@deepseek-ai/dsh-attachment-local` 的实际版本，再应用 fnOS 持久化补丁，不假设它与 DSH 使用相同版本号。`app/scripts/install-node-pty.sh` 会暂时跳过 node-pty 的 native 生命周期脚本，执行 DSH 依赖树中其他包的生命周期脚本，再写入构建机生成的 native 文件，因此 NAS 不需要安装 g++ 或重新编译。

FPK 只处理 [`app/published-dsh-plugins.json`](app/published-dsh-plugins.json) 中声明的插件。安装顺序固定为 Node.js → DSH → `pnpm@11.7.0` → `dsh plugin --profile web`；缺失 profile 由官方 CLI 首次执行插件命令时自动初始化。插件安装、更新和移除统一使用 `dsh plugin --profile web add/update/remove`，不再调用自定义插件安装脚本。构建选择内置插件时，只将仓库中存在的本地插件制成 npm 包归档打入 FPK，并由 DSH CLI 使用 `file:` spec 安装运行依赖；旧版同版本 `link:` 安装会在升级时重装归档。三方插件不进入内置目录，仍单独按精确版本安装。当前清单包含 `@tnnevol/dsh-fnos@0.1.5-rc.2.4` 和三方插件 `dshmarket@1.45.1`；dshmarket 不进入 FPK，安装阶段由 DSH CLI 单独安装，已安装时跳过，不覆盖、降级或删除用户版本。FPK 不再携带 Codex 插件；老用户升级不会删除已有 Codex 插件、配置或凭据。

本 FPK 不再注册公开的 `dsh` 系统命令（既不生成 `app/bin/dsh` wrapper，也不通过 `usr-local-linker` 暴露）。飞牛 fnOS 没有为非 root 调用者提供可用的身份切换机制（`runuser` 以非 root 执行时报 `may not be used by non-root users`，指定 `--group` 时报 `only root can specify alternative groups`，`su` 需要密码，`setpriv` 返回 `Operation not permitted`），而需求又禁止依赖 setuid 或不受控的 sudo，因此任何由普通用户直接调用的 wrapper 都无法真正以 DSH 应用包用户身份执行。管理员需要 CLI 时，请在应用包用户下直接运行应用私有路径的 `dsh`。`cmd/main` 只启动网关进程；网关以应用包用户直接运行真实 DSH CLI 启动 Web，不经 wrapper 或独立启动脚本。网关捕获启动 URL 中的 Token 后写入运行目录。浏览器地址始终保持无 Token：只有首次不带 DSH 会话 Cookie 的首页请求会把 Token 注入上游以换取 Cookie，之后的上游请求只带 Cookie——DSH 对任何携带 Token 的首页请求都会回 303 到干净路径，重复注入会造成“重定向次数过多”死循环。

使用应用全局路径中的 `dsh` 并执行 `dsh --help` 验证：

```bash
${DSH_HOME}/.npm-global/bin/dsh --help
```

profile 插件命令示例：

```bash
dsh --profile web --dump-config
dsh plugin --profile web add <plugin>@<version>
dsh plugin --profile web update <plugin>@<version>
dsh plugin --profile web remove <plugin>
```

安装默认使用 npm 官方源 `https://registry.npmjs.org/`。安装引导中的 npm 镜像源字段为可选项，选择后会持久化写入 `${DSH_HOME}/.npmrc`，供 npm、pnpm 和 DSH CLI 后续统一读取；pnpm store 单独持久化到 `${DSH_HOME}/.pnpm-store-dir`，通过 `PNPM_CONFIG_STORE_DIR` 注入，避免 npm 读取 pnpm 专用配置时产生未知配置警告。应用只使用该配置源安装，不会在安装失败后自动切换其他源：

| 可选镜像 | 地址 |
| --- | --- |
| yarn | `https://registry.yarnpkg.com/` |
| tencent | `https://mirrors.tencent.com/npm/` |
| cnpm | `https://r.cnpmjs.org/` |
| taobao | `https://registry.npmmirror.com/` |
| npmMirror | `https://skimdb.npmjs.com/registry/` |
| huawei | `https://repo.huaweicloud.com/repository/npm/` |

应用启动时执行：

```bash
dsh web --no-open --host <host> --port <port> --trusted-host <authority...>
```

应用由 fnOS 网关托管 Web 页面，因此启动时使用 `--no-open` 禁止 DSH 在 NAS 服务进程中尝试打开本机浏览器。

DSH Web 每次启动都会生成新的 launch Token。网关先写入临时文件再原子替换 Token 文件，Token 写入完成后才更新内存中的代理凭据；内部重启会清除旧 Token，避免页面请求、SSE 和 WebSocket 继续使用旧凭据。

向导默认监听 `127.0.0.1`，端口默认 `3080`。选择 `127.0.0.1` 时，应用通过 fnOS 统一网关访问；“可信访问地址”应填写浏览器打开 NAS Web 时地址栏中的 `host` 或 `host:port`，例如：

```text
192.168.119.6
192.168.119.6:5666
```

多个地址使用英文逗号分隔。应用代理会将根路径的 `/api`、`/plugins` 请求改写到 iframe 网关前缀，并处理 dsh HMR 使用的 `/plugins/events` EventSource。代理同时为 DSH 的 HTML、CSS 和 JavaScript 资源补齐 `/app/fn-deepseek-harness` 前缀，兼容 Vite 的 module-preload 和 `langs/*` 共享语法资源。

## DSH native 依赖构建

GitHub Actions 在构建 `fn-deepseek-harness` 时会执行 [`.github/scripts/prepare-dsh-native.sh`](../../.github/scripts/prepare-dsh-native.sh)，构建参数维护在 [`.github/config/dsh-native-0.1.5-rc.2.env`](../../.github/config/dsh-native-0.1.5-rc.2.env)：

1. 读取固定的 DSH、Node.js、node-pty 和 node-gyp 版本参数，不再在 workflow 中解析完整 DSH 依赖树；
2. 在 Node.js v24、带有 g++/make/python3 的 Linux runner 中直接安装并编译 `node-pty@1.2.0-beta.15`；
3. 将对应的 `build/Release` native 文件，以及 DSH/node-pty 版本文件打进 FPK。

发布包名称会追加 DSH 版本，例如：

```text
fn-deepseek-harness-v<app-version>-dsh-0.1.5-rc.2.fpk
```

其中 `-dsh-` 后的版本就是 FPK 内置并在 NAS 上安装的 DSH 版本。构建产物中的 `pty.node` 不提交到源码仓库，由 workflow 在打包前按 `.github/config/dsh-native-0.1.5-rc.2.env` 生成。

## 环境变量与数据目录

| 变量 | 当前值 |
| --- | --- |
| `HOME` | `${TRIM_APPDEST_VOL}/@appshare/fn-deepseek-harness` |
| `DSH_HOME` | `${TRIM_PKGHOME}` |
| `NPM_CONFIG_CACHE` | `${DSH_HOME}/.npm-cache` |
| `NPM_CONFIG_PREFIX` | `${DSH_HOME}/.npm-global` |
| `NPM_CONFIG_USERCONFIG` | `${DSH_HOME}/.npmrc` |
| pnpm store | `${TRIM_APPDEST_VOL}/@appshare/fn-deepseek-harness/.local/share/pnpm/store`；实际路径持久化到 `${DSH_HOME}/.pnpm-store-dir`，升级时优先复用 Web profile 已记录的 store |
| npm 全局目录 | `${DSH_HOME}/.npm-global/lib/node_modules` |
| npm 全局可执行目录 | `${DSH_HOME}/.npm-global/bin` |

`config/resource` 声明了 `data-share`：

```json
{
  "data-share": {
    "shares": [
      { "name": "fn-deepseek-harness" }
    ]
  }
}
```

文件访问还声明了 `trim.file.userAcl`，用于 Host 根据统一网关转发的当前用户 UID 检查实际读取权限；应用服务用户的 `TRIM_UID` 不作为浏览器用户权限使用。

删除数据卸载时会卸载 `@deepseek-ai/dsh`，并清空 `@apphome`、`@appshare`、`@appdata` 和 `@appconf` 中对应应用目录的内容，但保留这些目录本身。

当前升级流程不会自动在 `@apphome` 和 `@appshare` 之间迁移历史数据。变更存储布局前请先备份需要保留的数据。

## 构建

在当前应用目录执行：

```bash
fnpack build
```

通过仓库 CLI 构建正式 FPK 时使用 `--bundle-dsh-plugins`。该选项只内置仓库可解析的本地插件；清单中的三方插件不会被复制到 FPK，安装回调仍通过 DSH CLI 单独安装。`dshmarket@1.45.1` 只在清单中固定版本，不进入 FPK；缺少时通过精确版本 registry 安装，已安装时跳过。

带内置 native 依赖的正式包仅由 tag workflow 生成。本地执行 `fnpack build` 不会调用 native 依赖准备脚本；该脚本位于 `.github/scripts/`，仅供 GitHub Actions 在 Linux runner 上构建正式包使用。
