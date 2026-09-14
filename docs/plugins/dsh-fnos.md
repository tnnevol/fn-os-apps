# fnOS

`@tnnevol/dsh-fnos` 补齐 DSH 在 fnOS 应用中的系统集成。当前插件版本为 `0.1.5-rc.2`，适配 DSH `0.1.5-rc.2`。

## 安装

`fn-deepseek-harness` 会在安装和升级时通过 DSH CLI 安装精确版本。手动安装可执行：

```sh
dsh plugin --profile web add @tnnevol/dsh-fnos@0.1.5-rc.2
dsh --profile web --dump-config
```

插件不会禁用或修改 DSH 官方目录选择器。主题、文件授权和 fnOS 应用交互需要在 fnOS iframe 中运行；普通浏览器只能使用不依赖系统 SDK 的部分界面。

## 主题与窗口

当 DSH 主题设为「跟随系统」时，插件读取 fnOS 当前主题，并监听后续主题切换。DSH 明确选择浅色或深色后，以 DSH 设置为准。

插件只使用 `@trimjs/web-app` 的主题事件，不做定时轮询。fnOS 当前生效主题会写入插件设置，供下一次 Web profile 启动时恢复首屏主题。插件还会把 DSH 页面标题同步到 fnOS 应用窗口。

## 授权目录

![授权目录设置页](/images/plugins/dsh-fnos/authorized-directories.jpg)

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

## 刷新与重启 Web

fnOS 应用侧边菜单提供「刷新」和「重启 Web」入口：

- 「刷新」只刷新 DSH Web iframe，不刷新 iframe 外部的 fnOS 宿主页面；
- 「重启 Web」由常驻网关恢复 DSH Web，完成健康检查后刷新 iframe；
- 按下 macOS 的 `⌘ + ,` 或 Windows/Linux 的 `Ctrl + ,` 可打开 DSH 设置；
- 已验证刷新和重启入口均可正常使用，Web 重启期间 FPK 应用保持启用。

## 会话头部布局

fnOS iframe 内的会话头部有两个条目，左右顺序与官方一致：**左侧**是 fnOS 文件入口的分体按钮，**右侧**是 Session log 的 `…` 图标按钮。

顺序由插槽的排序规则决定（`priority` 升序、再 `order` 升序），取值集中在 `header-utility-seats.ts` 并由测试用真实插槽核心验证。这里需要留意：两个条目的 `order` 一旦打平，位置就会静默地改由注册顺序决定、与官方相反。不会报错，只是两个按钮换了位置，因此有专门的顺序测试守着。

## 导出会话日志

![会话日志导出菜单](/images/plugins/dsh-fnos/session-log-export.jpg)

fnOS 环境中的 Session log 菜单由头部右侧的 `…` 图标按钮展开（28px 圆形、透明无边框、悬停才出底色，与官方 `session-log-export` 一致）。菜单提供两种导出方式，每项带图标：

- 下载到当前电脑；
- 导出 ZIP 到已授权的 NAS 目录。

NAS 导出只允许选择插件返回的授权目录，写入失败时会保留原有会话数据并显示错误。

导出的 ZIP 由 DSH 自己的 `/api/session.export` 生成：插件宿主半边向本机 loopback 地址请求该路由，并转发当前浏览器的 `dsh-auth-*` Cookie 完成 browser-session 认证，再把返回的流写入所选目录。不在插件里重复实现会话日志打包（flush、附件收集等），也不依赖不存在的 `apiProxy` 服务。loopback 只绕过 Host/Origin 信任检查，不能省略 browser-session Cookie。

## 会话头部文件入口

![会话头部文件入口：分体按钮与菜单](/images/plugins/dsh-fnos/header-file-entry.jpg)

fnOS iframe 内的会话头部提供与官方同款的分体按钮：**左半**执行当前选中的文件操作（只显示该操作的图标），**右半**的箭头展开菜单选择。当前提供一项：

- **文件管理**：调用 fnOS 文件管理器并定位到当前会话的工作目录；左侧主按钮 tooltip 使用「在{应用名称}打开」模板，根据当前选中的菜单项动态显示，例如「在文件管理打开」。

这个入口取代了 DSH 官方的「打开应用」按钮。官方按钮按内置的编译期应用表探测本机应用，在 fnOS 上会把系统自带的 `zed`（ZFS Event Daemon，与 Zed 编辑器同名）误判为编辑器，且取不到对应图标，菜单里因此出现一个点了也打不开编辑器的条目。该应用表不可配置，所以插件在 fnOS iframe 内遮蔽它并改用 fnOS 自己的文件能力。

分体按钮的尺寸、圆角、分隔线、hover 和失败态都对齐官方入口，保证与头部其它控件同高；左半按钮用 fnOS 文件管理器自己的图标，菜单项由数组驱动，后续追加 fnOS 文件能力只需增加一项。它在头部的左右位置见上一节。

### 插件静态资源

插件的前端资源（如图标）由插件自己的路由提供，以 URL 引用而不是内联进客户端脚本，与官方 `ui-open-in-app` 的做法一致。资源随插件包发布，可以随包更新并被浏览器正常缓存。

取用链路：客户端引用 `/fnos-plugins/static/dsh-fnos/<资源>`；该前缀同时列在网关的内置前缀中（与 `/api`、`/plugins`、`/open-in-app` 同级），浏览器 bridge 才会为它补上 `/app/fn-deepseek-harness` 应用前缀；fnOS 把该前缀路由到网关 socket，网关剥掉网关前缀后转发给 DSH，最终由插件注册的同名前缀路由返回包内 `lib/assets/` 下的资源。

该命名空间归插件自己所有：它不代理 DSH 的既有路径，也不读取 fnOS 宿主的静态资源目录（`/usr/trim/www/static` 是宿主未公开的内部布局，随版本可能变动，且会被现有「图片资源补应用前缀」规则改写成指向本应用的错误地址）。路由只接受显式列举的资源名，请求路径仅用于查表、不拼进文件系统路径，因此不存在路径穿越；未列出的名字一律 404。

替换后的入口只在 fnOS iframe 内注册，普通浏览器访问 DSH 时官方按钮行为不变。工作目录未知时不显示入口；打开失败会在按钮上给出提示，不静默失败、也不回退到 NAS 上不存在的系统打开命令。

当前不支持「文件预览」和「文本编辑器」：它们按具体文件路径工作，对工作目录没有意义。后续接入时需要先确定作用对象（某个具体文件而不是目录）。

## presented-file 打开适配

DSH 交付文件卡片上的「默认应用/文件管理器」动作原本请求 `/api/present.open`，由宿主进程调用本机桌面 opener。NAS 服务没有桌面环境，这条路径恒为 409 `Host desktop unavailable`。插件在 fnOS iframe 内包装 `fetch`：

- `/api/present.host` 直接返回可用，避免卡片因探测失败而禁用动作；
- `/api/present.open` 改为请求插件的 `/fnos-plugins/present/resolve`，携带 `sessionId`/`seq`/`index` 与动作类型；
- 宿主用 Session 事件定位 `deliverables/presented` 文件，再经工作区与文件系统校验出真实 Host 路径后返回；
- 客户端拿到路径后调用 fnOS SDK 的 `openFile`（`reveal` 用 `openFileManager`），失败由调用方显示可重试错误。

解析路由复用 Session 查询、workspace files 与 `fs` 的路径校验，不信任客户端传入的任意路径；`/fnos-plugins/present` 与静态资源前缀一样列在网关内置前缀中，浏览器 bridge 才会为它补上应用前缀。独立浏览器与非 present 请求完全保持原行为。

## 运行边界

| 场景 | 行为 |
| --- | --- |
| fnOS 应用 iframe | 启用主题、标题、授权目录、系统文件打开、设置文件打开、NAS 日志导出，并以 fnOS 文件入口替代官方「打开应用」 |
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
