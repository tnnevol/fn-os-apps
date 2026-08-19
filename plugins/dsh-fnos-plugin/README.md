# @tnnevol/dsh-fnos

飞牛 fnOS 专用的 DeepSeek Harness 插件。当前 P0 能力是让 DSH 的 `system` 主题选择跟随 fnOS Web 宿主主题，显式选择 `light` 或 `dark` 时仍以 DSH 配置为准。

## 主题适配

- 使用 fnOS 官方 `@trimjs/web-app` SDK 的 `getPlatformConfig()` 获取初始主题。
- 在 Web 宿主环境使用 `$on('os/theme')` 接收主题切换事件。
- 主题变化只通过 SDK 的 `$on('os/theme')` 事件同步，不额外执行轮询。
- 通过 `prefers-color-scheme` 兼容层和 DSH rc.7 的主题运行时刷新当前页面，不修改 DSH 源码。
- DSH 的 `light`、`dark`、`system` 偏好仍由官方 `ui-theme` 写入 DSH 设置文件；fnOS 主题只参与 `system` 分支。
- 独立浏览器或本地裸 `dsh web` 找不到 fnOS SDK 时自动降级，不阻塞工作台。

## 本地调试

在仓库根目录执行：

```sh
pnpm --filter @tnnevol/dsh-fnos run check
```

使用本地 DSH CLI 调试时，先在本仓库构建，再在 DSH 源码仓库中把本地插件目录加入 `web` profile：

```sh
cd /absolute/path/to/fn-os-apps
pnpm --filter @tnnevol/dsh-fnos run build

cd /absolute/path/to/deepseek-harness
pnpm dsh plugin --profile web add /absolute/path/to/fn-os-apps/plugins/dsh-fnos-plugin
pnpm dsh --profile web
```

本地裸 DSH 页面没有 fnOS 宿主，主题桥接会安全跳过；安装到 fnOS FPK 后，应用网关提供本地打包的 SDK 文件。
