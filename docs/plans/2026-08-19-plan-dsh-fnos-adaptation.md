---
title: 2026-08-19-PLAN-DSH 飞牛 NAS 适配
description: DeepSeek Harness 在飞牛 fnOS 中的应用和专用插件适配实施计划。
---

# 2026-08-19-PLAN-DSH 飞牛 NAS 适配

| 项目 | 内容 |
| --- | --- |
| 计划编号 | PLAN-FNOS-001 |
| 计划日期 | 2026-08-19 |
| 对应需求 | [DSH 飞牛 NAS 适配](/requirements/2026-08-19-dsh-fnos-adaptation) |
| 计划状态 | 分阶段实施 |

## 计划目标

在不修改 DeepSeek Harness 官方源码的前提下，为 `fn-deepseek-harness` FPK、`@tnnevol/dsh-fnos` 和 `@tnnevol/dsh-codex-auth` 插件建立稳定的适配层。已完成的主题桥接作为 P0 基线；P1 已完成插件集成、授权目录管理、工作区快捷跳转和内容输入框 NAS 选择的插件侧代码，所有已实现能力还需真实 fnOS NAS 验收。工作区快捷跳转只接入 DSH 原始弹框公开的目录流程，不接管整个工作区选择器。

## 实现范围和边界

| 模块 | 计划入口 | 实现责任 |
| --- | --- | --- |
| FPK 应用 | `apps/fn-deepseek-harness` | 提供 iframe 入口、Node.js 运行时、持久化环境、统一网关和发布清单驱动的 npm 插件安装 |
| fnOS/Codex Host 插件 | `plugins/dsh-fnos-plugin/src/index.ts`、`plugins/dsh-codex-auth-plugin/src/` | 处理 fnOS 目录权限、Codex OAuth、凭据同步和模型适配，不把敏感凭据交给浏览器 |
| fnOS Client 插件 | `plugins/dsh-fnos-plugin/src/client/` | 注册设置卡片、主题桥接、目录选择交互和状态展示 |
| 应用目录 | `apps/fn-deepseek-harness` | 为已确认的 fnOS API 声明最小 Scope，保留现有共享数据配置 |
| 应用网关 | `apps/fn-deepseek-harness/app/gateway-proxy.mjs` | 保持 DSH Web、插件 API、SSE 和 fnOS iframe 请求在统一入口下可用 |
| DSH 工作区与输入交互 | `plugins/dsh-fnos-plugin/src/client/`、DSH workspace/input seam | 提供授权目录快捷跳转、目录搜索、主题图标和 NAS 目录/文件选择入口；不接管完整工作区目录约束 |
| 文档和验证 | `docs/`、测试 | 在统一文档站记录交互、限制、调试方式和发布检查项 |

官方 DSH 仓库只作为插件契约和运行行为参考；本计划不修改该仓库源码，也不要求上游接受补丁。

## 目标架构和数据流

```text
fnOS 桌面
   │ iframe
   ▼
fn-deepseek-harness 应用网关 ──────► DSH Web profile
   │                                      │
   │ 发布清单中的 npm 插件                 │ 已发布插件 Client
   │                                      │
   └──────────────► DSH Host ◄───────────┘
                           │
                           ├─ fnOS SDK 主题事件
                           └─ fnOS Host API / 应用授权目录
```

安装阶段由 npm 提供发布清单中的已发布插件，其包目录位于同一个 Web profile。未发布的 `@tnnevol/dsh-fnos` 不进入 FPK；发布并加入清单后才参与该数据流。

- 浏览器只负责渲染设置卡片和发起受控的 Host 调用。
- 需要 Token、应用权限或后端 API 的操作由 Host 侧执行。
- fnOS 目录选择器返回授权结果后，Client 重新请求真实授权列表，不把授权状态仅保存在 DSH 设置文件中。
- 主题的初始值通过 SDK 获取，后续只监听 `$on('os/theme')`；不增加轮询。

## 分阶段任务

### P0：运行和主题基线（待完成）

1. FPK 通过 iframe 启动 DSH Web，并使用应用网关处理页面、插件、SSE 和 API 请求。
2. Client 通过 `getPlatformConfig()` 读取初始主题，通过 `$on('os/theme')` 监听后续变化。
3. 只有 DSH 主题偏好为 `system` 时应用 fnOS 主题；`light` 和 `dark` 保持 DSH 配置优先级。
4. 在没有 fnOS SDK 的本地 DSH 环境中安全跳过桥接，保证本地调试不被宿主依赖阻塞。

当前结果：主题适配已经在 `@tnnevol/dsh-fnos` 中完成，并通过本地环境验证；但尚未在真实 fnOS NAS 环境完成应用启动、主题事件和访问权限验证，因此 P0 仍待完成。实现未修改官方 DSH 源码，也不使用轮询兜底。

### P1：FPK 集成 DSH 插件（代码完成，待真实 NAS 验收）

1. FPK 构建时只打入已发布插件的精确版本清单和通用安装脚本，不编译、复制或打包工作空间中的未发布插件。
2. `cmd/install_callback` 在需要时初始化 `web` profile，按安装向导选择的 npm 源安装发布清单中的插件，并加入 `dsh.profile.bundles`。
3. 应用升级时重新安装清单中的已发布插件；应用启动只校验清单插件的精确版本和 bundle 声明，不执行联网安装。
4. 安装逻辑可重复执行且不覆盖用户 profile 数据；npm 安装失败必须阻断安装/升级并输出明确错误。
5. 在模拟 profile 上验证清单插件目录、bundle 名称和已有用户 bundle 均被正确保留；npm 安装前清理历史未发布 `@tnnevol/dsh-fnos` 的 `link:` 本地依赖，并仅移除其 bundle 配置（不删除插件包或用户数据），同时确认 FPK 不包含 `app/plugins` 本地产物。
6. 在真实 fnOS NAS 上验证全新安装、升级、重复启动和发布清单插件自动加载；fnOS 插件发布并加入清单后再验证对应设置入口。

当前结果：已移除未发布插件的本地集成分支，发布清单驱动的 npm 安装、升级和启动校验流程已完成；真实 fnOS NAS 的安装、升级和清单插件自动加载验收待执行。

### P1：授权目录管理（代码完成，待真实 NAS 验收）

#### 1. 声明最小应用权限

已根据 fnOS 授权目录文档确认 `trim.file.sharedAccess` Scope、前端 `pickSharedFile()` 和后端 API 返回结构，并在 `apps/fn-deepseek-harness/config/resource` 中声明最小必要权限，同时保留现有 `data-share` 配置。真实 FPK 安装仍需在 NAS 上验证权限是否被系统接受。

#### 2. Host 侧服务

在 `@tnnevol/dsh-fnos` Host 侧提供结构化能力：

- `list`：调用 `trim.file.getSharedAccessibleFolders`，查询当前应用已授权目录。
- `delete(path)`：调用 `trim.file.delSharedAccessibleFolder`，取消指定目录的应用 ACL。
- 每次调用从应用运行环境读取 Token，只在 Host 侧使用，不写入 DSH 设置，也不返回给 Client。
- 将 403、权限不足、路径不存在、网络失败和未知错误转换为稳定的用户可见错误。
- 对路径进行规范化和重复项去重，删除时只允许操作当前查询结果中的授权目录。
- 合并 `TRIM_DATA_ACCESSIBLE_PATHS`、`TRIM_DATA_SHARE_PATHS` 环境变量中的目录和 API 返回结果，并按规范化后的真实路径去重；`TRIM_DATA_SHARE_PATHS` 中声明的应用共享目录只展示，不允许删除或取消授权。
- 目录展示调用 `trim.file.convertPath` 获取语义化路径；旧版 fnOS 无法转换时使用存储空间编号的可读回退文本，删除仍使用内部真实路径。
- Host 路由固定为 `/plugins/dsh-fnos/authorized-directories` 和 `/plugins/dsh-fnos/authorized-directories/delete`，通过统一网关随 DSH `/plugins` 请求转发。
- 删除前重新查询服务端列表并做精确匹配，避免把任意路径直接传给 fnOS 删除接口。

#### 3. Client 设置卡片

在「设置 → 插件 → fnOS」注册「授权目录」卡片：

- 首次展开时加载授权目录。
- 展示加载中、空列表、正常列表和失败重试状态。
- 每行展示 fnOS 转换后的语义化路径（过长时省略显示）；`TRIM_DATA_SHARE_PATHS` 目录显示“应用共享目录”状态且不提供删除按钮，其他授权目录提供删除按钮；Host 内部仍保留规范化真实路径用于删除。
- 卡片提供「添加授权目录」和手动刷新入口。
- 用户可以查看列表；新增和删除操作交给 fnOS 权限系统判断。
- 目录选择器关闭、取消或返回空授权结果时静默结束，不展示权限角色类提示；真实的列表、删除和网络错误仍保留重试提示。

#### 4. 添加流程

在 fnOS iframe 宿主内调用 JS SDK 的目录选择器：

```ts
const result = await sdk.pickSharedFile({
  title: '选择授权目录',
  okText: '确认授权',
  sidebarGroup: ['myFiles', 'otherShare', 'external', 'remote', 'favorites'],
})
```

授权成功后重新调用 Host `list`，以 API 返回结果刷新页面。由于授权立即生效，不设计保存、取消、恢复或保持按钮。独立浏览器环境没有 fnOS iframe SDK 时安全降级为不可添加状态，并保留列表刷新入口；不在裸 DSH 页面伪造授权结果。

#### 5. 删除流程

1. 用户点击目录后的删除按钮。
2. 弹出确认提示，说明只取消应用访问权限，不删除目录或文件。
3. 用户确认后调用 Host `delete(path)`。
4. 成功后重新调用 `list` 刷新列表。
5. 删除操作只移除应用 ACL，不清理 DSH 会话、目录内容或 `DSH_HOME` 数据。

### P1：工作区快捷跳转授权目录（代码完成，待真实 NAS 验收）

#### 1. 工作区入口与数据

1. 使用 DSH 官方公开的 `conversation.hero.workspace.directoryFlow` 和 `sidebar.workspaces.directoryFlow` 子流程插槽，不修改官方 DSH 源码；保留官方工作区菜单、弹框关闭和选中后的工作区处理。
2. 复用 `@tnnevol/dsh-fnos` Host/Client 已有的有效授权目录查询结果，包含运行时授权目录和仅展示的应用共享目录，并按规范化真实路径去重。
3. 在目录流程中使用彩色 fnOS logo 入口选择其他目录；目录列表和搜索由插件 Client 提供，图标资源随 FPK/插件提供。
4. 为避免 DSH 单一目录流程插槽被官方自动目录选择插件重复占用，在 fnOS 应用 bundle patch 中禁用 `directory-picker`，再注入官方 `@deepseek-ai/dsh-host-directory-picker-browse` Host 后端；这样保留 `ctx.directoryPicker`，使 rc.8 的 `dsh-host-apiproxy` 可以激活，同时不加载官方 browse Client UI，避免与 fnos 的 `directoryFlow` 重复占槽，不修改官方源码。

#### 2. 下拉列表与跳转

1. 原始工作区菜单仍由 DSH 展示；用户点击原始“添加工作区”后，由目录流程插槽显示有效授权目录，界面展示语义路径，列表项内部保留对应真实路径。
2. 目录不超过 10 个时直接展示列表；超过 10 个时增加搜索输入，搜索只过滤当前真实授权目录，不生成虚假结果。
3. 点击目录项后调用 DSH 原始 `onPicked(realPath)`：已有路径由 DSH 复用已有工作区，尚未登记的路径由 DSH 登记为新工作区，然后打开对应工作区；插件不修改 ACL、不复制文件、不清理旧工作区配置。
4. 目录流程底部提供 fnOS logo“选择其他目录”，调用 `pickUserFile({ directory: true, multiple: false })`；选择成功后同样交回 DSH 原始 `onPicked`，取消静默结束。
5. 授权被撤销、目录不存在或真实路径不可访问时保留 DSH 原有工作区选择能力并显示可理解错误；无目录、加载中、加载失败和选择失败均提供不打断主流程的状态。

#### 3. 验收

在本地 mock profile 验证原始工作区菜单能够打开插件目录流程、语义路径/真实路径映射、列表数量阈值、搜索过滤、`onPicked` 回填、工作区复用/登记、选择其他目录、取消静默和错误状态；在真实 fnOS NAS 验证授权目录变更后列表刷新、共享目录只读、原始弹框关闭和真实路径打开行为。

### P1：内容输入框 NAS 目录/文件选择（代码完成，待真实 NAS 验收）

#### 1. 输入框入口

1. 使用 DSH 官方公开的 `conversation.input.right` 列表插槽，不替换官方输入框，也不修改官方 DSH 源码。
2. 增加有颜色的 fnOS 官方 logo 按钮，使用彩色 logo，不复用工作区快捷按钮的黑白/反转黑白资源。
3. 按钮适配输入框聚焦、禁用、发送中、浅色/深色主题和 fnOS iframe 宿主状态；独立浏览器中安全提示不可用，不阻塞普通文本输入。

#### 2. 目录/文件选择与回填

1. 点击按钮调用 `@trimjs/web-app` 的 `pickUserFile({ directory })`；文件返回值支持多选，目录按 fnOS SDK 当前行为逐次选择，避免假设未被 SDK 声明的参数。
2. 选择结果通过 Host 同源路由 `/plugins/dsh-fnos/paths/convert` 调用 `trim.file.convertPath`，浏览器只拿到 `{ path, semanticPath }`，不接触 `TRIM_API_TOKEN`。
3. 通过 DSH `slash/input-insert-reference` 事件插入原生引用占位；在 `conversation.input.dock` 中按引用类型展示文件夹/文件 icon，支持堆叠、悬停展开、横向滚动和逐项移除。
4. 按规范化真实路径去重；注册 `fnos-file` 的 DSH `ReferenceCodec`，在复制/提交时生成 URL 转义后的 `file:///...` 路径，展示文案保留语义路径。
5. 不上传、复制、移动文件，不改变 ACL；选择器取消、关闭或空结果静默结束；转换失败回退到内部路径，不阻断引用插入。

#### 3. 验收

本地已验证插件 typecheck、构建、23 个单元测试、ModuleLoader bundle 和纯函数层的路径规范化/引用 codec。仍需在真实 fnOS NAS 验证目录/文件选择、路径转换、引用提交/复制、权限错误、主题适配和不会产生文件副作用。

#### 4. 当前实现边界

- 已使用 DSH 官方公开的输入区列表插槽和输入触发器 codec；不修改官方 DSH 源码。
- DSH 草稿内部保存原生引用占位符，不把 URL 直接拼接进用户文本；移除引用时由 DSH 输入状态机同步维护草稿和 occurrence。
- fnOS SDK 不可用时仅禁用选择动作，普通文本输入和 DSH 其他功能继续工作。

### P1：上下文文件访问适配（代码完成，待真实 NAS 验收）

#### 1. DSH 入口与插件边界

1. 不复制或修改 DSH 上下文文件、工具结果和生成文件的 UI；复用 DSH 公开的 `ctx.workspaces.openPath(path)` 服务入口。
2. 在 `@tnnevol/dsh-fnos` Client 注入 `workspaces`，通过生命周期 effect 装饰 `openPath`，插件卸载或 effect 销毁时恢复原始方法。
3. DSH 现有逻辑负责把工作区相对路径解析成 Host 可用的绝对路径；插件不重复解析、重写或持久化路径。

#### 2. fnOS 打开流程

1. fnOS iframe 内首次点击路径时初始化 `@trimjs/web-app`，等待 SDK `ready()` 完成后确认当前页面不是独立浏览器。
2. 先调用 Host 同源路由 `/plugins/dsh-fnos/paths/open/validate`，由 Host 合并 `trim.file.getSharedAccessibleFolders`、`TRIM_DATA_ACCESSIBLE_PATHS` 和 `TRIM_DATA_SHARE_PATHS`，对规范化后的真实路径执行目录边界判断。
3. 路径属于授权根目录时调用 `TrimApp.openFile(path)`，由 fnOS 文件应用打开文件或目录；不再调用 DSH 默认 Linux `xdg-open`。
4. 路径不在授权边界时返回稳定错误码 `fnos-path-not-authorized`，Client 转换为授权目录提示；Host 不返回 Token、Socket 路径或内部堆栈。
5. SDK 初始化失败、授权校验失败、文件应用打开失败时保留 DSH 原生错误/重试交互；独立浏览器直接回退到 DSH 原始 `openPath`，保证本地 CLI 调试不依赖 fnOS。

#### 3. 验收

本地通过路径规范化、授权根目录边界、前端 iframe/独立浏览器分流、未授权错误映射和生命周期恢复测试，并完成插件 typecheck/build；真实 fnOS NAS 仍需验证上下文文件点击、授权目录变更、文件应用打开和异常提示。

#### 4. 当前实现边界

- 不安装 `xdg-utils`，不为 NAS 增加 g++、文件管理器或其他系统依赖。
- 不自动申请目录授权；用户必须先在「设置 → 插件 → fnos → 授权目录」添加目标所在目录。
- 不上传、复制、移动或删除文件，不修改 DSH 会话、工作区和 `DSH_HOME` 数据。
- 不改变独立浏览器中的 DSH 原生行为，只在 fnOS iframe 宿主中启用 SDK 打开路径。

## 详细交互

### P1：上下文文件访问

```text
用户点击 DSH 上下文/工具结果/生成文件中的路径
  └─ DSH 解析工作区相对路径
       └─ 调用 workspaces.openPath(真实路径)
            ├─ 独立浏览器/本地调试
            │    └─ 使用 DSH 原生打开逻辑
            └─ fnOS iframe
                 ├─ Host 校验真实路径是否位于授权目录
                 │    ├─ 未授权：显示“请先授权目录”并保留重试
                 │    └─ 已授权：继续
                 └─ TrimApp.openFile(真实路径)
                      ├─ 文件：交给 fnOS 默认文件应用打开
                      ├─ 目录：交给 fnOS 文件管理器打开
                      └─ 失败：显示可理解错误并保留 DSH 原生错误入口
```

交互约束：

1. 用户操作入口保持 DSH 原有路径链接，不增加第二个“打开”按钮，也不要求用户手动复制 NAS 路径。
2. 未授权提示指向「设置 → 插件 → fnos → 授权目录」；用户取消授权目录选择器时静默结束，不显示“只有 NAS 管理员可以授权目录”等红色提示。
3. 真实路径只用于 Host 校验和 `TrimApp.openFile()`，页面不展示 Unix 内部路径，也不把 Token 或 Socket 信息写入错误提示。
4. 文件/目录打开成功后不修改 DSH 工作区、会话和配置；用户回到 DSH 后继续原有交互。
5. 插件只在 fnOS iframe 内调用 SDK；本地独立浏览器继续使用 DSH 原生路径打开行为，便于插件开发调试。

### P1：工作区快捷跳转授权目录

```text
打开工作区选择弹框
  └─ 点击 DSH 原始“添加工作区”
       └─ fnOS directoryFlow 目录流程
            ├─ 展示有效授权目录（展示语义路径，内部保留真实路径）
            ├─ 超过 10 个目录时显示搜索框
            ├─ 选择授权目录
            │    └─ 调用 DSH 原始 onPicked
            │         ├─ 已有路径：复用已有工作区
            │         └─ 新路径：由 DSH 登记工作区后打开
            ├─ 点击“选择其他目录”
            │    └─ fnOS pickUserFile(directory=true) 后交回 onPicked
            ├─ 授权失效/目录不存在/选择失败
            │    └─ 显示对应错误并保留原始工作区能力
            └─ 取消/关闭
                 └─ 静默结束
```

交互约束：

1. DSH 原始工作区菜单、目录流程打开/关闭和工作区选中由官方组件负责；插件只提供公开 `directoryFlow` 子流程。
2. 目录流程与授权目录卡片共用数据源和刷新结果；应用共享目录显示为只读入口；语义路径仅用于展示和搜索，真实路径仅用于交给 DSH `onPicked`。
3. 搜索只在目录数超过 10 个时出现，搜索过程中不修改授权状态。
4. 点击目录或“选择其他目录”后交回 DSH 原生工作区流程；取消选择、关闭弹框或取消搜索不产生权限错误提示。

### P1：内容输入框 NAS 目录/文件选择

```text
聚焦 DSH 内容输入框
  └─ 点击右下角彩色 fnOS logo
       ├─ 选择 NAS 目录或文件
       ├─ 通过 Host 转换可读路径
       ├─ 在输入框文案上方展示文件夹/文件 icon 引用
       ├─ 堆叠展示，悬停展开并横向滚动
       ├─ 支持移除并按真实路径去重
       ├─ 取消/关闭：保持输入框原内容
       └─ 成功：插入 DSH 原生文件引用，提交/复制时 URL 转义真实路径
```

交互约束：

1. 彩色 fnOS logo 按钮固定在输入框右下操作区，不遮挡发送、附件或其他已有操作，并提供可访问名称、悬浮提示和键盘触发。
2. 选择结果在输入框文案上方展示，目录使用文件夹 icon、文件使用文件 icon；选项较多时堆叠，悬停展开到最大可用宽度并支持横向滚动。
3. 选择结果插入后保留用户已有文本；展示使用语义路径，真实路径由 DSH 引用 codec 在提交/复制时按输入契约 URL 转义。
4. 每个引用支持移除，按规范化真实路径去重，不允许同一文件重复选择。
5. 选择器不可用时按钮安全降级，不禁用普通文本输入。

### P1：授权目录管理用户交互流程

#### 查看和添加授权目录

```text
打开 DSH 设置
  └─ 插件 → fnOS → 授权目录
       ├─ 加载已授权目录
       ├─ 点击“添加授权目录”
       ├─ fnOS 目录选择器完成授权
       └─ 重新查询并立即展示授权结果
```

交互约束：

1. 卡片默认折叠，首次展开才请求授权目录列表。
2. “添加授权目录”和“刷新”在请求期间禁用，避免重复提交。
3. 目录行显示完整实际路径；过长路径使用省略显示，悬停可查看完整值。
4. 无目录、加载失败、权限不足和 fnOS API 不可用分别显示对应状态；失败状态保留刷新入口。

#### 删除授权目录

```text
点击目录删除
  └─ 确认“只取消访问权限，不删除文件”
       ├─ 取消：保持原列表
       └─ 确认：Host 删除 ACL → 重新查询列表
```

## 数据、权限和错误处理

- 应用数据仍由现有 `HOME`、`DSH_HOME` 和 `@appshare` 约定持久化；授权目录功能不重写数据目录。
- 目录授权是 fnOS 应用 ACL，不等同于 DSH 工作区配置，也不触发文件复制或迁移。
- `TRIM_DATA_ACCESSIBLE_PATHS` 是应用运行时可读取的冒号分隔授权路径；插件与 `trim.file.getSharedAccessibleFolders` 的结果合并后去重。`TRIM_DATA_SHARE_PATHS` 是应用资源声明的共享路径，会合并到授权目录列表中展示，但不允许从页面删除或取消授权。
- Host 只返回目录展示所需的结构化字段，禁止返回 `TRIM_API_TOKEN`、Unix Socket 路径和内部堆栈。
- 工作区快捷跳转只消费已授权目录列表，不因跳转自动申请 ACL，不传递 Token，不复制或移动目录内容；选中结果交由 DSH 原生 `onPicked` 复用或登记工作区。
- 工作区列表展示语义路径，跳转使用与其对应的真实路径；授权被撤销、目录不存在或真实路径不可访问时返回可区分的错误状态。
- 上下文文件访问只允许打开当前 fnOS 授权根目录内的真实路径；Host 使用路径边界比较防止 `/vol4/share-archive` 被误判为 `/vol4/share` 的子路径，路径校验失败不调用系统打开器。
- 内容输入框只接收 fnOS 选择器返回的真实目录/文件路径，展示时转换为语义路径；通过 DSH 原生引用 codec 在提交/复制时按输入契约进行 URL 转义，不把文件内容、Token 或临时本地路径写入 DSH 配置。
- 内容输入框多选结果按规范化真实路径去重，引用可单独移除；文件选择使用 SDK 的 `multiple` 参数，目录选择按 fnOS 单目录接口连续选择并合并；多选不等同于上传或会话附件持久化。
- 页面区分未授权、无目录、加载失败、操作失败和权限不足，错误提示提供重试或重新授权入口。
- 添加、删除和刷新请求需要防止重复提交；操作完成后以服务端查询结果为准。

## 依赖、风险和决策

| 项目 | 影响 | 处理方式 |
| --- | --- | --- |
| fnOS Scope/API 已按文档锁定但尚未在 NAS 验证 | 可能导致 FPK 安装后权限或返回结构与本地预期不同 | 已使用官方 Scope/API 契约实现；真实 NAS 安装后验证，失败时卡片降级为稳定错误 |
| 授权目录变化没有 SDK 事件 | 别的入口修改授权后页面可能暂时不更新 | 首次打开、操作成功、重连时刷新，并提供手动刷新，不做轮询 |
| fnOS 权限环境变量/API 在不同版本的返回不一致 | 授权列表可能存在重复或短暂不同步 | 规范化并去重 API/环境变量来源；API 失败时使用环境变量回退，真实 NAS 以实际返回验收 |
| 非 iframe 或独立浏览器调试 | 缺少 fnOS SDK 宿主 | 提供安全降级和授权跳转回退，不影响 DSH 本地调试 |
| 取消授权影响用户已有目录配置 | 用户可能误以为文件被删除 | 二次确认明确说明只移除 ACL，不自动删除数据 |
| DSH 工作区目录流程是单一插槽 | 官方自动目录选择插件与 fnOS 目录流程可能重复占用；直接禁用后又会让 `dsh-host-apiproxy` 缺少 `directoryPicker` | 禁用官方 `directory-picker` 的双面自适应入口，仅注入官方 `@deepseek-ai/dsh-host-directory-picker-browse` Host 后端；fnos 插件独占公开 `conversation.hero.workspace.directoryFlow` / `sidebar.workspaces.directoryFlow`，不修改官方源码 |
| fnOS 目录/文件选择 API 在 NAS 版本间存在差异 | 输入框入口可能无法统一返回目录和文件 | 使用 `pickUserFile({ directory })` 的稳定参数；缺失能力时安全禁用入口并保留文本输入，转换失败回退到内部路径 |
| NAS 环境缺少 `xdg-open` | DSH 默认 Host 打开路径会出现 `spawn xdg-open ENOENT` | fnOS iframe 内改由 Host 授权校验后调用 `TrimApp.openFile()`；独立浏览器保留 DSH 原生逻辑，不安装系统依赖 |
| 上下文路径未授权或包含相似前缀 | 可能绕过授权边界或误报权限 | Host 对规范化路径执行 `root === target` 或 `target.startsWith(root + '/')` 的边界比较，并返回稳定错误码 |
| 目录数量较多或路径过长 | 下拉框难以浏览，可能误选目录 | 超过 10 项才显示搜索；展示可读路径并保留真实路径作为内部值 |
| 授权目录被撤销或真实路径失效 | 快捷入口可能持有过期目录 | 跳转前后校验真实路径，按权限失效、目录不存在和访问失败分别提示，不修改工作区配置 |
| 多选结果过多或路径包含特殊字符 | 输入框空间不足，引用可能解析失败 | 采用堆叠/悬停展开/最大宽度横向滚动；以规范化真实路径去重，并在回填前统一 URL 转义 |

## 测试、打包和发布

### 插件测试

- `pnpm --filter @tnnevol/dsh-fnos run typecheck`
- `pnpm --filter @tnnevol/dsh-fnos run test`
- `pnpm --filter @tnnevol/dsh-fnos run build`
- `pnpm --filter @tnnevol/dsh-codex-auth run typecheck`
- `pnpm --filter @tnnevol/dsh-codex-auth run test`
- `pnpm --filter @tnnevol/dsh-codex-auth run build`
- 覆盖主题初始值、`os/theme` 事件、手动主题优先级和无 SDK 降级。
- 已补充路径规范化、重复路径去重、共享目录只读标记、语义路径回退、授权目录选择取消静默、客户端 bundle 和应用 Scope 契约测试；真实 API 的权限码和 NAS 返回仍需目标环境验收。
- 为 FNOS-001-10 增加目录流程 slot 注册、语义路径展示、真实路径映射、10 项搜索阈值、原始 `onPicked` 委托、选择其他目录、取消静默、错误状态和官方自动目录选择 bundle patch 契约验证。
- 为 FNOS-001-11 增加输入框入口位置、彩色 logo、目录/文件选择、文件夹/文件 icon、堆叠与悬停展开、横向滚动、移除、真实路径去重、URL 转义 codec、取消静默和无 SDK 降级测试。
- 为 FNOS-001-12 增加 `workspaces.openPath` 装饰、Host 授权边界路由、`TrimApp.openFile` iframe 分流、独立浏览器回退、未授权错误映射和生命周期恢复测试。

### 应用和文档验证

- 构建 FPK，检查 `apps/fn-deepseek-harness` 中的最小 Scope、发布清单和通用插件安装脚本，并确认包内不存在历史 `app/plugins` 本地产物。
- 检查安装回调只从 npm 安装发布清单中的精确版本，在模拟 profile 上验证 npm 安装前清理旧版未发布 `@tnnevol/dsh-fnos` 的 `link:` 依赖，清单插件写入 `node_modules`、更新 `dsh.profile.bundles` 并保留已有用户 bundle；旧版 fnos 只从依赖和 bundle 配置移除，不删除其包目录和用户数据。
- 在 NAS 上验证 iframe 页面、应用网关、SSE、授权目录选择器和错误提示。
- 在 NAS 上验证从原始工作区弹框进入 fnOS 目录流程、授权目录语义路径展示、真实路径通过 DSH `onPicked` 复用/登记工作区、超过 10 项搜索、选择其他目录、权限撤销/目录不存在提示，以及输入框多选目录/文件、悬浮引用展示、移除、去重和 URL 转义回填行为。
- 在 NAS 上验证点击上下文、工具结果和生成文件路径时，已授权路径由 fnOS 文件应用打开；未授权路径提示添加授权目录；不再出现 `spawn xdg-open ENOENT`。
- 验证取消授权不会删除目录、文件、工作区记录或 DSH 数据。
- 运行 `pnpm run docs:build`，检查需求、计划以及 `docs/` 中应用和插件文档的链接。

### 升级和回滚

- 插件和 FPK 版本分别遵循各自的 DSH 兼容版本，不覆盖用户的 DSH 配置和授权数据。
- 新权限未被 NAS 接受时，保留主题和已有 DSH 功能，授权目录卡片降级为可理解的错误状态。
- 回滚插件只移除新增 UI/Host 能力，不删除授权目录、工作区、会话和应用数据。

## 参考资料

### fnOS JS SDK 与授权目录

P1 授权目录管理依赖 fnOS 前端 JS SDK 和应用共享授权 API。实现时使用官方 SDK 包和对应 API 文档，不自行模拟授权结果：

| 计划功能 | SDK/API | 参考资料 |
| --- | --- | --- |
| 读取 NAS 初始主题 | `getPlatformConfig()` | [平台配置](https://developer.fnnas.com/api/platform-config) |
| 监听 NAS 主题变化 | `$on('os/theme')` | [调用方式：前端 JS SDK](https://developer.fnnas.com/api/calling) |
| 添加授权目录 | `pickSharedFile()` | [应用共享授权路径](https://developer.fnnas.com/api/authorization/shared-access) |
| 选择 NAS 文件/目录 | `pickUserFile({ directory })` | [前端 JS SDK 包](https://www.npmjs.com/package/@trimjs/web-app)；[文件授权说明](https://developer.fnnas.com/api/authorization/overview) |
| 打开已授权文件/目录 | `openFile(path)` | [前端 JS SDK 包](https://www.npmjs.com/package/@trimjs/web-app) |
| 查询已授权目录 | `trim.file.getSharedAccessibleFolders` | [应用共享授权路径](https://developer.fnnas.com/api/authorization/shared-access) |
| 删除授权目录 | `trim.file.delSharedAccessibleFolder` | [应用共享授权路径](https://developer.fnnas.com/api/authorization/shared-access) |
| 转换可读路径 | `trim.file.convertPath` | [调用方式：后端 API](https://developer.fnnas.com/api/calling) |

- [fnOS 前端 JS SDK 包 `@trimjs/web-app`](https://www.npmjs.com/package/@trimjs/web-app)：插件构建时使用的 SDK 包；构建产物会随插件客户端 bundle 内置，包的安装、导出和版本信息以该页面为准。
- [授权与文件概览](https://developer.fnnas.com/api/authorization/overview)：确认应用 ACL、授权路径和用户文件权限之间的边界。
- [调用方式](https://developer.fnnas.com/api/calling)：确认 API Scope、前端 JS SDK、后端 Unix Socket API 的调用边界。

### DSH 官方参考

- [DeepSeek Harness 官方仓库](https://github.com/deepseek-ai/deepseek-harness)：用于确认 DSH profile、插件和工作区契约；本计划不修改该仓库源码。
- [DSH 工作区公开插槽契约](https://github.com/deepseek-ai/deepseek-harness/tree/main/packages/client/ui-workspace/src/client/contract)：确认 `conversation.hero.workspace.directoryFlow` / `sidebar.workspaces.directoryFlow` 的 `DirectoryFlowOwnerProps` 边界。
- [DSH 原始工作区选择弹框](https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/client/ui-workspace/src/client/WorkspacePicker.tsx)：确认官方菜单、目录流程、`onPicked` 以及工作区复用/登记行为。
- [DSH 客户端输入区插槽源码](https://github.com/deepseek-ai/deepseek-harness/tree/main/packages/client/ui-conversation/src/client/contract)：确认 `conversation.input.right` / `conversation.input.dock` 的公开扩展边界。
- [DSH 输入引用契约源码](https://github.com/deepseek-ai/deepseek-harness/tree/main/packages/client/ui-input-trigger/src)：确认 `ReferenceInsert`、`ReferenceCodec` 和 `slash/input-insert-reference` 的引用生命周期。
- [DSH 内容文件打开入口](https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/client/ui-conversation/src/client/apply.ts)：确认上下文文件由 DSH 统一调用 `workspaces.openPath()`。
- [DSH 工作区路径打开服务](https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/client/runtime/src/client/workspaces/service.ts)：确认官方默认 Host 路径打开行为及插件装饰边界。

## 完成状态

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| P0 运行和主题桥接 | 待完成 | 代码和本地验证已完成，待真实 fnOS NAS 环境验收 |
| P1 FPK 集成 DSH 插件 | 代码完成，待真实 NAS 验收 | 已移除未发布插件本地集成，只保留发布清单驱动的 npm 安装、升级和启动校验 |
| P1 授权目录管理 | 代码完成，待真实 NAS 验收 | Host/Client、Scope、环境变量合并、语义路径、添加/删除交互和本地验证已完成 |
| P1 工作区快捷跳转 | 代码完成，待真实 NAS 验收 | 已接入 DSH 原始 `directoryFlow` 插槽，完成授权目录、搜索、选择其他目录和 `onPicked` 委托；待真实 NAS 验证原始弹框及工作区复用/登记 |
| P1 内容输入框 NAS 选择 | 代码完成，待真实 NAS 验收 | 已接入 DSH 输入区公开 slot、fnOS `pickUserFile`、Host 路径转换和原生引用 codec；待 NAS 验证选择器及提交/复制链路 |
| P1 上下文文件访问 | 代码完成，待真实 NAS 验收 | 已接入 `workspaces.openPath`、Host 授权边界校验和 fnOS `openFile`；待 NAS 验证文件/目录打开和未授权提示 |

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-08-19 | 建立 2026-08-19-PLAN-DSH 飞牛 NAS 适配，拆分运行/主题和授权目录阶段；完整工作区目录接管暂不纳入计划。 |
| 2026-08-19 | 将 P0 调整为待真实 NAS 验收，移除未进入计划阶段的后续能力，并补充详细交互和参考资料章节。 |
| 2026-08-19 | 开始执行 P1 授权目录计划，完成 fnOS Scope、Host 路由、Client 设置卡片和本地测试，保留真实 NAS 验收状态。 |
| 2026-08-19 | 完成 P1 授权目录代码：加入环境变量补齐去重、语义路径转换、取消静默和共享目录只读展示；完整工作区目录选择器接管暂不纳入当前计划。 |
| 2026-08-19 | 追加 FNOS-001-10：工作区选择弹框提供已授权 fnOS 目录快捷跳转、下拉展示、超过 10 项搜索和主题适配 logo，调整为 P1 待排期。 |
| 2026-08-19 | 追加 FNOS-001-11：DSH 内容输入框右下增加彩色 fnOS logo 入口，用于选择 NAS 目录和文件并回填引用，调整为 P1 待排期。 |
| 2026-08-19 | 明确 FNOS-001-10 的语义路径展示、真实路径跳转、关闭弹框定位和权限/目录失效提示。 |
| 2026-08-19 | 明确 FNOS-001-11 的多选引用展示、文件夹/文件 icon、堆叠与悬停展开、移除、去重、URL 转义、无障碍和安全降级验收。 |
| 2026-08-19 | 完成 FNOS-001-11 插件侧计划：接入 DSH 输入区公开 slot、fnOS 文件/目录选择、Host 可读路径转换和原生引用 codec；保留真实 NAS 验收状态。 |
| 2026-08-20 | 完成 FNOS-001-10 计划实施：使用 DSH 原始工作区 `directoryFlow` 插槽接入授权目录、超过 10 项搜索和 fnOS“选择其他目录”，选择结果交回原生 `onPicked`；应用 bundle patch 禁用官方自动目录选择器的 Client 侧并注入官方 browse Host 后端，避免单一插槽冲突且满足 `dsh-host-apiproxy` 的 `directoryPicker` 依赖，待真实 NAS 验收。 |
| 2026-08-20 | 移除 FPK 对未发布插件的本地构建、暂存和复制流程；插件集成统一改为发布清单驱动的 npm 安装，启动阶段仅离线校验清单插件。 |
| 2026-08-20 | 完成 FNOS-001-12 计划实施：为 DSH 上下文文件访问增加授权路径校验和 fnOS `openFile` 适配，避免 NAS 缺少 `xdg-open`；保留独立浏览器原生回退，待真实 NAS 验收。 |
