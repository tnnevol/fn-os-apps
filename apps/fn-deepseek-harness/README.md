# DeepSeek Harness

`fn-deepseek-harness` 是 DeepSeek Harness 的 fnOS Native 应用封装，通过 fnOS 统一网关以 iframe 方式打开 Web UI。

- 上游项目：[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
- 架构：`x86`
- 运行时依赖：`nodejs_v24`
- 应用版本：以 [`manifest`](manifest) 中的 `version` 为准
- Web 入口：`/app/fn-deepseek-harness`

## 启动方式

安装回调会在 Node.js v24 环境中执行：

```bash
npm i @deepseek-ai/dsh -g
dsh --help
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

多个地址使用英文逗号分隔。应用代理会将根路径的 `/api`、`/plugins` 请求改写到 iframe 网关前缀，并处理 dsh HMR 使用的 `/plugins/events` EventSource。

应用入口保留 `allUsers=false`，并将入口访问权限设置为可编辑。管理员可以在应用设置中配置允许访问 DeepSeek Harness 的用户。

## fnOS 主题适配

应用声明了 `micro_app=true`，并在统一网关返回的页面中加载飞牛官方 `@trimjs/web-app@0.4.2` SDK。主题适配层通过 `getPlatformConfig()` 读取初始主题，并通过 `$on('os/theme')` 监听 fnOS Web 宿主的后续切换。

适配层将 fnOS 的 `light/dark` 同步到 dsh 的 `prefers-color-scheme`，由 dsh 自己的主题呈现器更新页面。这样在 dsh 设置中明确选择 `light` 或 `dark` 时以用户选择为准，选择 `system` 时才会跟随 NAS 主题。SDK 的 `$on('os/theme')` 是实时同步主通道；在宿主未转发主题事件时，首次收到事件前会每 5 秒重新读取一次平台配置，并在事件恢复后停止兜底轮询。SDK 文件随应用本地打包，NAS 运行时不依赖外部 CDN；在独立浏览器中打开时，SDK 会自动跳过宿主主题同步。

## 环境变量与数据目录

| 变量 | 当前值 |
| --- | --- |
| `HOME` | `${TRIM_APPDEST_VOL}/@appshare/fn-deepseek-harness` |
| `DSH_HOME` | `${TRIM_PKGHOME}` |
| `NPM_CONFIG_CACHE` | `${DSH_HOME}/.npm-cache` |
| `NPM_CONFIG_PREFIX` | `${DSH_HOME}/.npm-global` |

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

删除数据卸载时会卸载 `@deepseek-ai/dsh`，并清空 `@apphome`、`@appshare`、`@appdata` 和 `@appconf` 中对应应用目录的内容，但保留这些目录本身。

当前升级流程不会自动在 `@apphome` 和 `@appshare` 之间迁移历史数据。变更存储布局前请先备份需要保留的数据。

## 构建

在当前应用目录执行：

```bash
./build
```

构建脚本默认自动递增 patch 版本并生成 `fn-deepseek-harness.fpk`。也可以通过 `VERSION_BUMP=minor` 或 `VERSION_BUMP=major` 选择递增级别。构建失败时会恢复 manifest 版本。
