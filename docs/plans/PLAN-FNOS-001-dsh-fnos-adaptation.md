---
id: PLAN-FNOS-001
title: PLAN-FNOS-001 DSH 飞牛 NAS 适配
description: DeepSeek Harness 在飞牛 fnOS 中的应用和插件适配实施计划。
status: completed
owner: tnnevol
targetVersion: 5.1.x
lastVerified: 2026-08-24
---

# PLAN-FNOS-001 DSH 飞牛 NAS 适配

| 项目 | 内容 |
| --- | --- |
| 计划编号 | PLAN-FNOS-001 |
| 计划日期 | 2026-08-19 |
| 对应需求 | [DSH 飞牛 NAS 适配](/requirements/FNOS-001-dsh-fnos-adaptation) |
| 计划状态 | <Badge type="tip" text="P0/P1 已完成验证" /> |

## 计划目标

由 `fn-deepseek-harness` 提供 fnOS 应用边界，`@tnnevol/dsh-fnos` 和 `@tnnevol/dsh-codex-auth` 提供插件能力。适配代码不进入 DSH 官方仓库，用户配置、会话和授权数据在安装、升级与回滚时保持不变。

P0 和 P1 已在真实 fnOS NAS 中完成验证。

## 实现范围和边界

| 模块 | 计划入口 | 实现责任 |
| --- | --- | --- |
| FPK 应用 | `apps/fn-deepseek-harness` | 生命周期、iframe、持久化和插件安装 |
| 应用网关 | `apps/fn-deepseek-harness/app/gateway-proxy.mjs` | 转发页面、API、插件请求和 SSE |
| Host 插件 | `plugins/dsh-fnos-plugin/src/index.ts` | fnOS API、路径、权限和错误转换 |
| Client 插件 | `plugins/dsh-fnos-plugin/src/client/` | 主题、设置卡片、目录和文件交互 |
| Codex 插件 | `plugins/dsh-codex-auth-plugin/src/` | OAuth、凭据和模型适配 |
| 应用配置 | `apps/fn-deepseek-harness` | 最小 Scope 和共享目录声明 |
| 文档与测试 | `docs/`、插件测试 | 记录契约并验证安装和宿主行为 |

DSH 官方仓库只作为插件契约参考，不修改源码或提交上游补丁。

## 目标架构和数据流

```text
fnOS 桌面
  └─ iframe
       └─ fn-deepseek-harness 网关
            └─ DSH Web profile
                 ├─ @tnnevol/dsh-fnos Client
                 │    └─ 同源插件路由 → Host → fnOS API
                 └─ @tnnevol/dsh-codex-auth
```

- 浏览器只处理界面和受控请求。
- Token、ACL 和文件写入留在 Host。
- FPK 只安装发布清单中的 npm 插件。
- 主题读取一次初始值，后续监听 `os/theme`，不轮询。

## 分阶段任务

### P0 运行和主题基线

| 任务 ID | 对应功能 | 实现内容 | 状态 |
| --- | --- | --- | --- |
| PLAN-FNOS-001-T01-01 | FNOS-001-01 | FPK 启动 DSH Web，网关处理 iframe、API、插件和 SSE | <Badge type="tip" text="已完成验证" /> |
| PLAN-FNOS-001-T02-01 | FNOS-001-02 | `getPlatformConfig()` 读取主题，`$on('os/theme')` 监听变化；只在 DSH 主题为 `system` 时同步 | <Badge type="tip" text="已完成验证" /> |
| PLAN-FNOS-001-T03-01 | FNOS-001-03 | fnOS 适配保留在 FPK 和插件中，裸 DSH 环境安全降级 | <Badge type="tip" text="已完成验证" /> |

### P1 插件和 NAS 能力

| 任务 ID | 对应功能 | 实现内容 | 状态 |
| --- | --- | --- | --- |
| PLAN-FNOS-001-T04-01 | FNOS-001-04 | 合并授权 API、环境变量和共享目录，规范化去重并转换语义路径 | <Badge type="tip" text="已完成验证" /> |
| PLAN-FNOS-001-T09-01 | FNOS-001-09 | 安装回调初始化 Web profile，并安装发布清单中的精确插件版本 | <Badge type="tip" text="已完成验证" /> |
| PLAN-FNOS-001-T10-01 | FNOS-001-10 | 在 DSH `directoryFlow` 中增加授权目录入口，结果交回原始 `onPicked` | <Badge type="tip" text="已完成验证" /> |
| PLAN-FNOS-001-T11-01 | FNOS-001-11 | 使用输入区公开插槽、授权路径路由和 `ReferenceCodec` 插入 NAS 引用 | <Badge type="tip" text="已完成验证" /> |
| PLAN-FNOS-001-T12-01 | FNOS-001-12 | 装饰 `workspaces.openPath()`，fnOS iframe 调用 `TrimApp.openFile()` | <Badge type="tip" text="已完成验证" /> |
| PLAN-FNOS-001-T13-01 | FNOS-001-13 | 监听 `document.title`，通过 `setTitle()` 更新 fnOS 宿主标题 | <Badge type="tip" text="已完成验证" /> |
| PLAN-FNOS-001-T15-01 | FNOS-001-15 | Session log 保留电脑下载，并支持流式写入授权 NAS 目录 | <Badge type="tip" text="已完成验证" /> |

## 详细交互

### P1 授权目录管理

```text
设置 → 插件 → fnOS → 授权目录
  ├─ 展开卡片 → 查询并显示授权目录
  ├─ 添加授权目录 → fnOS 选择器 → 重新查询
  ├─ 刷新 → 重新查询
  └─ 取消授权 → 确认只移除访问权限 → Host 删除 ACL → 重新查询
```

- 共享目录和应用默认目录只展示，不提供删除按钮。
- 取消选择或空结果静默结束。
- 加载、空列表、权限不足和请求失败分别显示对应状态，失败时保留刷新入口。

### P1 工作区和输入框 NAS 路径

```text
DSH 工作区弹框
  └─ 黑白 fnOS 图标 → 选择授权目录 → 写回原始路径 → DSH onPicked

DSH 内容输入框
  └─ 彩色 fnOS 图标 → TreeSelect 多选文件或目录
       └─ 转换语义路径 → 插入原生引用 → 提交真实路径
```

- 工作区继续使用 DSH 原始弹框、路径输入和登记逻辑，插件不申请 ACL。
- 授权目录超过 10 项时提供搜索，长路径通过 Tooltip 查看。
- 输入引用支持多选、移除和真实路径去重，不上传或复制文件。
- 取消面板不修改工作区和输入文本，Host 路由失败不影响普通文本输入。

### P1 文件、标题和 Session log

```text
点击 DSH 文件路径
  ├─ fnOS iframe → TrimApp.openFile(真实路径)
  └─ 独立浏览器 → DSH 原生 openPath

DSH 标题变化 → setTitle(document.title)

Session log
  ├─ 导出到电脑 → DSH 原生下载
  └─ 导出到 NAS → 选择授权目录 → Host 流式写入 ZIP
```

- 文件打开由 fnOS 文件应用和当前用户权限决定，插件不依赖 `xdg-open`。
- SDK 初始化失败只显示可理解的错误，不阻塞 DSH 工作台。
- NAS 导出确认前再次检查授权、ACL、目录和写权限；取消时不生成文件。

## 数据、权限和错误处理

- `HOME`、`DSH_HOME` 和 `@appshare` 继续使用现有数据布局。
- Host 合并 `TRIM_DATA_ACCESSIBLE_PATHS`、`TRIM_DATA_SHARE_PATHS`、应用默认目录和授权 API 结果后去重。
- 共享目录只读。取消授权只删除应用 ACL，不删除目录、文件、会话或工作区。
- Client 不接收 `TRIM_API_TOKEN`、Unix Socket、内部服务对象和错误堆栈。
- 路径选择限制在授权根目录内；文件打开交给 fnOS 文件应用做最终权限判断。
- 页面区分无数据、未授权、路径失效、权限不足和网络错误，并保留重试入口。

## 依赖、风险和决策

| 风险 | 处理方式 |
| --- | --- |
| fnOS SDK 在独立浏览器不可用 | 只在 fnOS iframe 初始化 SDK，其余环境保留 DSH 原生行为 |
| 授权目录没有变更事件 | 展开卡片、操作成功和手动刷新时重新查询，不增加轮询 |
| 环境变量与 API 返回重复 | 规范化真实路径后去重，语义路径只用于展示 |
| DSH 工作区流程使用单一插槽 | 只接入公开 `directoryFlow`，不禁用官方目录选择器 |
| NAS 缺少 `xdg-open` | fnOS iframe 使用 `TrimApp.openFile()` |
| 安装或升级覆盖用户 profile | 安装器只维护发布清单插件和 bundle，不重建用户配置 |

## 测试、打包和发布

### 插件检查

```sh
pnpm --filter @tnnevol/dsh-fnos run typecheck
pnpm --filter @tnnevol/dsh-fnos run test
pnpm --filter @tnnevol/dsh-fnos run build
pnpm --filter @tnnevol/dsh-codex-auth run typecheck
pnpm --filter @tnnevol/dsh-codex-auth run test
pnpm --filter @tnnevol/dsh-codex-auth run build
```

测试覆盖主题事件、无 SDK 降级、路径规范化、授权取消、工作区委托、NAS 引用、文件打开和插件生命周期恢复。

### FPK 和 NAS 验证

- 构建 FPK，确认 Scope、发布清单和安装脚本正确，包内没有未发布插件源码。
- 验证全新安装、升级、重复启动和插件自动加载，不覆盖用户 profile。
- 在真实 NAS 验证 iframe、网关、SSE、主题、授权目录、工作区、输入引用、文件打开、标题和 Session log 导出。
- 运行 `pnpm run check -- --sdd` 和 `pnpm run build -- --docs`。

### 升级和回滚

- 插件和 FPK 按 DSH 兼容版本发布。
- 回滚只移除新增 UI 和 Host 能力，不删除配置、授权目录、工作区、会话和文件。
- 新 Scope 不可用时保留 DSH 基础功能，并在对应卡片显示错误。

## 参考资料

| 能力 | API 或契约 | 参考资料 |
| --- | --- | --- |
| 主题 | `getPlatformConfig()`、`$on('os/theme')` | [平台配置](https://developer.fnnas.com/api/platform-config)、[JS SDK 调用](https://developer.fnnas.com/api/calling) |
| 授权目录 | `pickSharedFile()`、共享授权 API | [应用共享授权路径](https://developer.fnnas.com/api/authorization/shared-access) |
| 用户权限 | `trim.file.checkUserACL` | [文件权限检查](https://developer.fnnas.com/api/authorization/file-acl) |
| 路径转换 | `trim.file.convertPath` | [后端 API 调用](https://developer.fnnas.com/api/calling) |
| 文件打开 | `TrimApp.openFile()` | [`@trimjs/web-app`](https://www.npmjs.com/package/@trimjs/web-app) |
| 宿主标题 | `setTitle()` | [页面交互](https://developer.fnnas.com/api/page/ui#设置页面标题) |
| 工作区 | `directoryFlow`、`onPicked` | [DSH 工作区契约](https://github.com/deepseek-ai/deepseek-harness/tree/main/packages/client/ui-workspace/src/client/contract) |
| 输入引用 | `ReferenceInsert`、`ReferenceCodec` | [DSH 输入引用契约](https://github.com/deepseek-ai/deepseek-harness/tree/main/packages/client/ui-input-trigger/src) |
| 文件路径 | `workspaces.openPath()` | [DSH 工作区服务](https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/client/runtime/src/client/workspaces/service.ts) |

## 完成状态

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| P0 运行和主题 | <Badge type="tip" text="已完成验证" /> | iframe、网关、权限和主题已通过真实 NAS 验收 |
| P1 插件和 NAS 能力 | <Badge type="tip" text="已完成验证" /> | 插件安装、目录、文件、标题和导出已通过真实 NAS 验收 |

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-08-19 | 建立计划，实施运行、主题和授权目录。 |
| 2026-08-19 | 加入插件安装、工作区快捷入口和输入框 NAS 引用。 |
| 2026-08-20 | 输入与工作区改用插件授权路径面板，新增 fnOS 文件打开。 |
| 2026-08-20 | 移除未发布插件的 FPK 本地集成和官方目录选择器补丁。 |
| 2026-08-24 | P0/P1 完成真实 fnOS NAS 验证。 |
| 2026-08-27 | 精简重复任务、交互和验收说明，保留实施与验证依据。 |
