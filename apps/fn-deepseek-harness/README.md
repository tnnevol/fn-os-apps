# DeepSeek Harness

`fn-deepseek-harness` 是 DeepSeek Harness 的 fnOS Native 应用封装，通过 fnOS 统一网关以 iframe 方式打开 Web UI。

- 上游项目：[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
- 架构：`x86`
- 运行时依赖：`nodejs_v24`
- 应用版本：以 [`manifest`](manifest) 中的 `version` 为准
- Web 入口：`/app/fn-deepseek-harness`

## 启动方式

发布的 FPK 固定适配 `@deepseek-ai/dsh@0.1.1-rc.2`，并固定预编译 `node-pty@1.2.0-beta.15`。安装回调只接受本地精确版本 `0.1.1-rc.2`；本地没有该版本时才从安装向导选择的 npm 源使用 npm 安装固定版本。`app/scripts/install-node-pty.sh` 会暂时跳过 node-pty 的 native 生命周期脚本，执行 DSH 依赖树中其他包的生命周期脚本，再写入构建机生成的 native 文件，因此 NAS 不需要安装 g++ 或重新编译。

FPK 只处理 [`app/published-dsh-plugins.json`](app/published-dsh-plugins.json) 中声明的已发布插件。安装和升级阶段使用安装向导选择的 npm 源，通过 npm 按清单中的精确版本或 dist-tag 安装并补齐 `dsh.profile.bundles`；应用启动只校验已安装版本，不会每次启动联网。当前清单使用 `@tnnevol/dsh-codex-auth` 和 `@tnnevol/dsh-fnos` 的 `rc` dist-tag，因此后续发布新的 rc 版本不需要修改 FPK 清单。未发布插件不会在 FPK 构建阶段编译、打包或复制到 Web profile，发布后需要先加入该清单才会随应用安装。

最终固定使用应用全局路径中的 `dsh` 并执行 `dsh --help` 验证：

```bash
${DSH_HOME}/.npm-global/bin/dsh --help
```

安装默认使用 npm 官方源 `https://registry.npmjs.org/`。安装引导中的 npm 镜像源字段为可选项，只有选择其他源时才会覆盖默认源。应用只使用所选源安装，不会在安装失败后自动切换其他源：

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
dsh web --host <host> --port <port> --trusted-host <authority...>
```

向导默认监听 `127.0.0.1`，端口默认 `3080`。选择 `127.0.0.1` 时，应用通过 fnOS 统一网关访问；“可信访问地址”应填写浏览器打开 NAS Web 时地址栏中的 `host` 或 `host:port`，例如：

```text
192.168.119.6
192.168.119.6:5666
```

多个地址使用英文逗号分隔。应用代理会将根路径的 `/api`、`/plugins` 请求改写到 iframe 网关前缀，并处理 dsh HMR 使用的 `/plugins/events` EventSource。代理同时为 DSH 的 HTML、CSS 和 JavaScript 资源补齐 `/app/fn-deepseek-harness` 前缀，兼容 Vite 的 module-preload 和 `langs/*` 共享语法资源。

## DSH native 依赖构建

GitHub Actions 在构建 `fn-deepseek-harness` 时会执行 [`.github/scripts/prepare-dsh-native.sh`](../../.github/scripts/prepare-dsh-native.sh)，构建参数维护在 [`.github/config/dsh-native-0.1.1-rc.2.env`](../../.github/config/dsh-native-0.1.1-rc.2.env)：

1. 读取固定的 DSH、Node.js、node-pty 和 node-gyp 版本参数，不再在 workflow 中解析完整 DSH 依赖树；
2. 在 Node.js v24、带有 g++/make/python3 的 Linux runner 中直接安装并编译 `node-pty@1.2.0-beta.15`；
3. 将对应的 `build/Release` native 文件，以及 DSH/node-pty 版本文件打进 FPK。

发布包名称会追加 DSH 版本，例如：

```text
fn-deepseek-harness-v5.0.12-dsh-0.1.1-rc.2.fpk
```

其中 `-dsh-` 后的版本就是 FPK 内置并在 NAS 上安装的 DSH 版本。构建产物中的 `pty.node` 不提交到源码仓库，由 workflow 在打包前生成。

## 环境变量与数据目录

| 变量 | 当前值 |
| --- | --- |
| `HOME` | `${TRIM_APPDEST_VOL}/@appshare/fn-deepseek-harness` |
| `DSH_HOME` | `${TRIM_PKGHOME}` |
| `NPM_CONFIG_CACHE` | `${DSH_HOME}/.npm-cache` |
| `NPM_CONFIG_PREFIX` | `${DSH_HOME}/.npm-global` |
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

带内置 native 依赖的正式包仅由 tag workflow 生成。本地执行 `fnpack build` 不会调用 native 依赖准备脚本；该脚本位于 `.github/scripts/`，仅供 GitHub Actions 在 Linux runner 上构建正式包使用。
