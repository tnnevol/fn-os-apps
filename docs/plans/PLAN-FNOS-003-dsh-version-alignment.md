---
id: PLAN-FNOS-003
title: PLAN-FNOS-003 DSH 版本统一升级
description: 将 DSH 插件、运行时依赖和 fnOS FPK 安装流程统一到 0.1.1-rc.2 的实施计划。
status: implementing
owner: tnnevol
planDate: 2026-08-30
targetVersion: 5.1.x
lastVerified: 2026-08-30
---

# PLAN-FNOS-003 DSH 版本统一升级

| 字段 | 内容 |
| --- | --- |
| 计划编号 | PLAN-FNOS-003 |
| 计划日期 | 2026-08-30 |
| 对应需求 | [FNOS-003 DSH 版本统一升级](/requirements/FNOS-003-dsh-version-alignment) |
| 计划状态 | <Badge type="warning" text="待完成" /> |

## 计划目标

将仓库内实际发布和安装的 DSH 版本统一为 `0.1.1-rc.2`：插件包、`@deepseek-ai/dsh-*` 依赖、compatibility、FPK 安装回调、node-pty native 配置、发布清单和相关文档均使用同一版本约束。

本计划只调整本仓库的版本和安装流程，不修改 DSH 上游源码，不把共享 `@tnnevol/dsh-semi-ui` 加入 DSH 运行时 bundle。

## 实现范围和边界

| 模块 | 计划入口 | 实现责任 |
| --- | --- | --- |
| DSH 插件 | `plugins/*-plugin/package.json`、`compatibility.json` | 统一插件版本、DSH peer/dev 依赖和兼容性声明 |
| 应用/FPK | `apps/fn-deepseek-harness/cmd/install_callback` | 精确检查和安装 DSH，安装已发布 rc 插件，保留用户数据 |
| native 构建 | `.github/scripts/prepare-dsh-native.sh`、`.github/config/`、workflow | 使用固定版本参数生成 node-pty 产物 |
| 发布清单 | `apps/fn-deepseek-harness/app/published-dsh-plugins.json` | 指向已发布插件的 rc 标签 |
| 文档/测试 | `docs/`、插件测试目录 | 同步版本说明、命令和验收条件 |
| 共享 UI | `packages/dsh-semi-ui` | 同步为 `0.1.1-rc.2`，但不加入 DSH 运行时 bundle |

## 目标架构和数据流

```text
版本常量 0.1.1-rc.2
  ├─ 插件 package.json / compatibility.json
  ├─ FPK install_callback 精确检查
  ├─ native config / GitHub Actions
  ├─ published-dsh-plugins.json 的 rc 标签
  └─ 文档、测试和发布命令

FPK 安装
  └─ 检查 DSH 精确版本
       ├─ 已安装目标版本：复用并校验
       └─ 未安装目标版本：从选定 npm 源安装
            └─ 准备 node-pty native 文件
                 └─ 安装已发布 rc 插件并校验 profile bundle
```

## 分阶段任务

### P0：插件和 DSH 依赖版本统一

状态：<Badge type="warning" text="待完成" />

1. 将 `dsh-codex-auth`、`dsh-fnos` 和 `dsh-semi-ui-showcase` 的自身版本改为 `0.1.1-rc.2`。
2. 将三个插件中的 `@deepseek-ai/dsh-*` peer/dev 依赖和 compatibility API 版本改为 `0.1.1-rc.2`。
3. 保持插件使用 rc 标签发布。
4. 更新锁文件并检查不再由插件 manifest 引入旧 DSH 版本。

验收：三个插件的 package contract、typecheck、测试和构建均通过。

### P0：FPK 安装流程固定 DSH 版本

状态：<Badge type="warning" text="待完成" />

1. 安装回调以 `DSH_VERSION=0.1.1-rc.2` 为唯一目标版本。
2. 通过本地全局安装目录检查精确版本；版本不匹配或不可用时，使用安装向导选定的 npm 源安装精确版本。
3. 保持 `DSH_HOME`、profile、用户配置和工作区不被安装流程重建或清空。
4. DSH 安装成功后，读取发布清单并安装 rc 插件，再验证包版本和 profile bundle。
5. 所有失败分支使用现有生命周期日志函数输出具体阶段、命令结果和退出状态。

验收：在干净环境和已有用户配置环境中分别安装/升级，均能启动 Web 且配置保留。

### P1：node-pty native 配置和发布清单同步

状态：<Badge type="warning" text="待完成" />

1. 将 `.github/config/dsh-native-0.1.1-rc.2.env` 作为固定构建参数入口。
2. workflow 直接读取该配置，不在每次构建时查询 DSH 依赖树。
3. 使用固定的 node-pty 版本生成 native 文件；NAS 没有编译器时使用 FPK 内置产物。
4. 发布清单使用 `rc` dist-tag 安装已发布的 DSH 插件。

验收：GitHub Actions 生成的 FPK 包含与目标 DSH 匹配的 node-pty 文件，NAS 安装后不触发错误的 native 编译。

### P1：文档和发布入口同步

状态：<Badge type="warning" text="待完成" />

1. 更新应用 README、应用文档、插件文档和插件总览中的 DSH/插件版本。
2. 新增本需求和计划，并在 VitePress 需求清单、详细计划菜单中登记。
3. 保留共享 UI 包的独立说明，避免将内部包误列为 DSH 运行时插件。

验收：文档构建和内部链接检查通过，安装命令与实际 rc 清单一致。

## 详细交互

### P0：FPK 安装/升级流程

1. 用户启动 fnOS FPK 安装或升级流程，安装回调显示当前目标 DSH 版本 `0.1.1-rc.2`。
2. 回调检查应用全局目录中是否存在且仅存在可用的 `@deepseek-ai/dsh@0.1.1-rc.2`。
3. 如果检查通过，日志显示复用目标版本；如果未通过，日志显示将从向导选择的 npm 源安装目标版本。
4. DSH 安装后，回调准备 node-pty native 文件，并显示使用编译结果或 FPK 内置结果的来源。
5. 回调按发布清单安装 `@tnnevol/dsh-codex-auth@rc`、`@tnnevol/dsh-fnos@rc` 等已发布插件，完成后校验插件版本和 profile bundle。
6. 全部校验通过后启动 DSH Web；失败时停止后续启动并在 `/var/log/apps/fn-deepseek-harness.log` 中给出失败阶段。
7. 升级完成后，用户原有 DSH_HOME 数据仍可使用，不需要重新创建 profile 或重新配置账号。

### P1：开发和发布流程

1. 开发者修改插件或应用版本后执行对应的 typecheck、测试和 build。
2. 发布插件使用 rc 标签；应用发布清单只引用已经发布且可解析的包。
3. GitHub Actions 读取固定 native 配置构建 FPK，不进行在线版本探测。
4. 发布前检查插件版本、DSH 依赖、兼容性声明、清单和文档是否完全一致。

## 数据、权限和错误处理

- 版本检查只读取本地安装目录和包元数据，不读取或覆盖用户配置内容。
- npm 源沿用安装向导选择结果；不因版本检查失败自动切换到其他源。
- DSH 版本不匹配、插件解析失败、native 产物缺失和 profile bundle 校验失败分别记录明确错误。
- 安装失败不得删除旧的 `DSH_HOME`、profile、登录凭据或工作区；回滚只允许恢复应用代码和安装产物。
- 真实 NAS 验收必须检查安装日志、DSH Web 启动状态、插件加载状态和用户数据保留情况。

## 依赖、风险和决策

| 项目 | 结论 |
| --- | --- |
| DSH 版本 | 固定 `0.1.1-rc.2`，不在安装或 workflow 中动态选择版本 |
| 插件发布标签 | 使用 npm `rc` dist-tag；发布清单只安装已发布包 |
| node-pty | 使用固定 DSH 版本对应的构建参数和预置 native 文件 |
| 共享 UI 包 | 版本同步为 `0.1.1-rc.2`，继续由 workspace 依赖管理，不纳入 DSH 运行时 bundle |
| npm 发布状态 | 目标 `0.1.1-rc.2` 已在公共 npm registry 发布，插件发布和 FPK 验收使用 rc 标签 |
| 旧版用户数据 | 只做版本升级，不重建或清理 `DSH_HOME` |
| 真实环境风险 | 本地构建通过不等于 NAS 验收完成，需单独安装 FPK 验证 |

## 测试、打包和发布

### 插件级

```bash
pnpm --filter @tnnevol/dsh-codex-auth run check
pnpm --filter @tnnevol/dsh-fnos run check
pnpm --filter @tnnevol/dsh-semi-ui-showcase run check
```

检查三者的 package version、DSH 依赖和 compatibility 版本均为 `0.1.1-rc.2`。

### 应用级

```bash
pnpm run build:fpk
```

检查 FPK 中的 DSH、插件清单和 node-pty 文件版本；安装后检查 DSH Web、profile bundle 和日志。

### 文档级

```bash
pnpm run check:docs
```

检查 VitePress 构建、需求/计划导航和内部链接。

### 发布和回滚

- 插件发布到 npm 的 `rc` 标签后，再更新或验证应用发布清单。
- 应用发布前保留旧 FPK 和用户数据备份，确认升级不会清理 `DSH_HOME`。
- 回滚应用代码或 FPK 产物时，不删除用户 profile、配置、凭据和工作区。

## 参考资料

- [DSH 官方仓库](https://github.com/deepseek-ai/deepseek-harness)：参考 DSH profile、插件和发布契约，不修改上游代码。
- [DSH `0.1.1-rc.2` 发布页](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.1-rc.2)：确认目标 DSH 版本和发布信息。
- [npm `@deepseek-ai/dsh`](https://www.npmjs.com/package/@deepseek-ai/dsh)：确认 npm 包版本和安装入口。
- [fn-os-apps GitHub Actions](https://github.com/tnnevol/fn-os-apps/actions)：查看 FPK 构建和 native 产物生成结果。
- [DSH 开发技能](https://github.com/tnnevol/skills/tree/main/skills/dsh)：本地开发、插件契约和版本要求参考。

## 完成状态

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| P0：插件和依赖版本 | <Badge type="tip" text="已修改" /> | 需要完成插件级检查 |
| P0：FPK 安装流程 | <Badge type="tip" text="已修改" /> | 需要完成 FPK 安装验证 |
| P1：native 和发布清单 | <Badge type="tip" text="已修改" /> | 需要完成构建产物验证 |
| P1：文档同步 | <Badge type="tip" text="已同步" /> | 需要完成文档构建 |
| 目标 NAS 验收 | <Badge type="warning" text="待完成" /> | 未完成前不标记需求完成 |

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-08-30 | 新增实施计划，覆盖插件版本、DSH 依赖、FPK 安装、node-pty、发布清单和文档同步。 |
