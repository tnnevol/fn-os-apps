# fnOS

`@tnnevol/dsh-fnos` 补齐 DSH 在 fnOS 应用中的系统集成。当前插件版本为 `0.1.1-rc.2`，适配 DSH `0.1.1-rc.2`。

## 安装

`fn-deepseek-harness` 会在安装和升级时自动安装 npm `rc` 标签对应的版本。手动安装可执行：

```sh
dsh plugin --profile web add @tnnevol/dsh-fnos@rc
dsh --profile web --dump-config
```

插件不会禁用或修改 DSH 官方目录选择器。主题、文件授权和 fnOS 应用交互需要在 fnOS iframe 中运行；普通浏览器只能使用不依赖系统 SDK 的部分界面。

## 主题与窗口

当 DSH 主题设为「跟随系统」时，插件读取 fnOS 当前主题，并监听后续主题切换。DSH 明确选择浅色或深色后，以 DSH 设置为准。

插件只使用 `@trimjs/web-app` 的主题事件，不做定时轮询。fnOS 当前生效主题会写入插件设置，供下一次 Web profile 启动时恢复首屏主题。插件还会把 DSH 页面标题同步到 fnOS 应用窗口。

## 授权目录

打开「设置 → 插件 → fnos」可以查看应用可访问的 NAS 目录：

- 「添加授权目录」调用 fnOS 授权窗口，成功后立即刷新列表；
- 可取消用户授予的目录权限，但不会删除目录或文件；
- `TRIM_DATA_SHARE_PATHS` 提供的应用共享目录只展示，不提供取消按钮；
- Host 合并 fnOS 授权结果、`TRIM_DATA_ACCESSIBLE_PATHS` 和 `TRIM_DATA_SHARE_PATHS`，规范化后去重；
- 页面展示 fnOS 语义路径，读写和取消授权仍使用真实路径；
- 用户取消授权窗口时静默结束，不显示错误提示。

浏览器不会接触 `TRIM_API_TOKEN`。目录查询、授权变更和路径转换均由插件 Host 路由完成。

## 工作区与上下文

### 选择工作区

插件保留 DSH 原始工作区弹框，只在路径栏左侧增加 fnOS 图标。点击图标可从已授权目录中快速选择一个路径，选择结果会写回 DSH 原始目录流程，再由 DSH 完成工作区打开或登记。

该入口不会再次申请授权。目录较多时可以搜索，完整语义路径通过 Tooltip 查看。

### 引用 NAS 文件和目录

对话输入区左侧的彩色 fnOS 图标用于选择已授权的文件或目录。选择器支持目录懒加载和多选，选中项以文件或文件夹块显示在输入框上方；发送时，插件通过 DSH 的结构化引用把真实路径写入上下文。

该功能不会把 NAS 路径直接写进可见输入文本，也不会占用或替换其他插件的输入按钮。

## 打开文件与设置

在 fnOS 中点击上下文、工具结果或生成文件里的路径时，插件通过 `@trimjs/web-app` 的 `openFile()` 交给系统文件应用处理。是否可以打开以 fnOS 当前用户的真实权限为准，不以插件列表缓存做预判，因此不会调用 NAS 中不存在的 `xdg-open`。

设置页的「打开配置文件」同样通过 fnOS 文件应用打开当前 DSH 设置文件。离开 fnOS iframe 后，这些系统操作会安全跳过或回退到 DSH 原有行为。

## 导出会话日志

fnOS 环境中的 Session log 菜单提供两种导出方式：

- 下载到当前电脑；
- 导出 ZIP 到已授权的 NAS 目录。

NAS 导出只允许选择插件返回的授权目录，写入失败时会保留原有会话数据并显示错误。

## 运行边界

| 场景 | 行为 |
| --- | --- |
| fnOS 应用 iframe | 启用主题、标题、授权目录、系统文件打开、设置文件打开和 NAS 日志导出 |
| 普通浏览器访问 DSH | 不调用 fnOS 授权或文件 SDK，保留 DSH 原有打开方式 |
| 应用共享目录 | 可读取和选择，只展示，不允许取消授权 |
| 用户授权目录 | 可读取和选择，也可在确认后取消授权 |

## 排查

### 看不到 fnos 插件

```sh
dsh --profile web --dump-config | grep -n -C 3 'dsh-fnos'
```

如果出现 `cannot resolve profile bundle`，重新执行插件安装命令。不要保留指向开发机或旧 NAS 源码目录的 `link:`、`file:` 依赖。

### 授权目录为空

确认应用已获得文件访问权限，并从 fnOS 应用入口打开 DSH。直接访问 `127.0.0.1:3080` 或其他独立浏览器页面时，fnOS SDK 无法提供完整宿主能力。

### 文件无法打开

先在 fnOS 文件管理器中确认当前用户可以访问该真实路径。插件会直接调用系统 SDK；路径出现在授权目录列表中，不代表文件已存在或当前用户仍有读权限。

### 主题没有同步

确认 DSH 主题选择的是「跟随系统」，且页面运行在 fnOS 应用 iframe 中。明确选择浅色或深色时，插件不会覆盖 DSH 主题。

## 本地开发

```sh
pnpm --filter @tnnevol/dsh-fnos run check
dsh plugin --profile web add /absolute/path/to/fn-os-apps/plugins/dsh-fnos-plugin
dsh web --no-open
```

独立浏览器适合检查构建和非 SDK 界面；主题、授权、系统文件打开和 NAS 导出仍需在真实 fnOS 环境验收。

## 链接

- [npm](https://www.npmjs.com/package/@tnnevol/dsh-fnos)
- [源码](https://github.com/tnnevol/fn-os-apps/tree/main/plugins/dsh-fnos-plugin)
- [fnOS JS SDK](https://developer.fnnas.com/)
- [需求清单](/requirements/FNOS-001-dsh-fnos-adaptation)
- [实现计划](/plans/PLAN-FNOS-001-dsh-fnos-adaptation)
- [问题反馈](https://github.com/tnnevol/fn-os-apps/issues)
