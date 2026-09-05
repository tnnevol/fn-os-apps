# 开发环境与脚本

本页只记录当前有效的开发入口。工具版本、根脚本和 CI 发生变化时，以仓库配置为准，并同步更新本页。

## 先记住三件事

1. **根命令优先**：日常开发从 `pnpm run ...` 进入，不要在根目录手写 `cd` 和任务编排。
2. **应用用 fnpack**：`apps/*` 没有统一的 Node.js workspace 任务，FPK 构建由 `fnpack` 完成。
3. **插件用 fn-apps-cli**：harness 插件的构建、检查和 watch 由 `fn-apps-cli` 调度，Turbo 负责依赖顺序和缓存。

## 当前命令地图

根目录 `package.json` 是稳定入口，`tooling/fn-os-apps-cli` 中的 Commander 负责注册和分发 CLI 命令。

| 命令 | 当前用途 | 是否交互 |
| --- | --- | --- |
| `pnpm run start` | 启动 harness 插件 watch 和/或文档服务 | 可选 |
| `pnpm run build` | 构建 harness 插件、FPK 应用和文档 | 可选 |
| `pnpm run check` | 检查 SDD、文档、共享包和 harness 插件 | 可选 |
| `pnpm run version` | 维护项目/FPK 或单个 harness 插件版本 | 可选 |
| `pnpm run release:notes` | 使用 `changelogithub` 生成 Release | 否 |
| `pnpm run typecheck` | 通过 Turbo 执行所有包的类型检查 | 否 |
| `pnpm run test:unit` | 通过 Turbo 执行单元测试 | 否 |
| `pnpm run test` | `test:unit` 的兼容别名 | 否 |
| `pnpm run docs:preview` | 预览已经构建好的 VitePress 站点 | 否 |
| `pnpm run lint:shell` | 检查 Shell 脚本格式 | 否 |

CLI 也提供一个仅用于 CI 或网关构建的入口：

```bash
pnpm exec fn-apps-cli build:gateway
```

任务边界、依赖图和状态分支见 [Package 任务与 Turbo](./package-tasks-and-turbo)。

## 已废弃入口

:::danger 不要继续使用

- 根目录的 `pnpm run dev`：根脚本不再提供该入口，请使用 `pnpm run start`。
- 根目录自定义 `bump` 脚本：已经废弃，请使用 `pnpm run version`。
- 历史的 `fnos-gateway build:fpk`：已经移除，请使用 `pnpm exec fn-apps-cli build:gateway` 构建 Gateway，再使用 FPK 模式构建应用。

:::

需要注意：workspace 包中的 `dev` 任务**没有废弃**，它是 `turbo watch` 使用的内部任务；开发者通过 `start` 间接调用它，不应把它当作根目录命令。

## 开发环境

项目根目录是 pnpm workspace，版本约束以配置文件为准：

| 工具 | 当前要求 | 配置来源 |
| --- | --- | --- |
| Node.js | 24，最低 `>=24.0.0` | `.nvmrc`、根 `package.json#engines` |
| pnpm | `>=11.16.0`，项目固定 `11.16.0` | 根 `package.json#packageManager`、CI |
| [fnpack](https://developer.fnnas.com/docs/cli/fnpack/) | 本地 `1.2.3`；CI 构建 Workflow 当前使用 `1.2.1` | 本机 `PATH`、`.github/workflows/build-*.yml` |
| [D2](https://d2lang.com/tour/install/) | `0.7.1`，仅文档流程图需要 | 本机 `PATH`、文档 Workflow |
| [dsh](https://github.com/deepseek-ai/deepseek-harness) | 与插件兼容声明和锁定版本一致 | 本机 CLI、插件 `package.json` |

初始化环境：

```bash
nvm use
pnpm install
node --version
pnpm --version
```

调整 Node.js、pnpm、fnpack 或 D2 版本时，同时检查 `.nvmrc`、根 `package.json`、相关 Workflow 和本页。CI 的 fnpack 版本目前与本地版本不同，不要在未同步 Workflow 的情况下自行假定两者一致。

## FPK 应用开发

`apps/*` 目录由 fnOS 的 `manifest` 和生命周期脚本定义，普通开发机负责构建，真实行为必须在 fnOS 设备上验证。

:::warning 创建或重建应用前

先查阅 [`$fnnas-docs`](https://github.com/tnnevol/skills/tree/main/skills/fnnas-docs)，再使用官方模板创建应用：

```bash
cd apps
fnpack create <app-name>
# 仅 Docker 应用使用：
fnpack create <app-name> --template docker
```

不得删除模板文件或目录；在模板基础上修改 `manifest`、`app/`、`cmd/`、`config/` 和 `wizard/`。

:::

准备工具和设备：

| 项目 | 用途 |
| --- | --- |
| [`fnnas-docs` Skill](https://github.com/tnnevol/skills/tree/main/skills/fnnas-docs) | 查询 Manifest、生命周期、权限、资源和向导约束 |
| [fnOS 应用开放平台](https://developer.fnnas.com/) | 平台规则、开放 API 和 fnpack 参考 |
| `fnpack 1.2.3` | 本地校验应用目录并生成 `.fpk` |
| fnOS 测试设备 | 验证安装、升级、启动、停止、权限和卸载 |
| `appcenter-cli` | 在 fnOS 设备上安装和检查应用 |

确认 fnpack 可用：

```bash
fnpack --help
```

### 构建应用

直接构建单个应用：

```bash
cd apps/<app-name>
fnpack build
```

也可以从根目录通过 CLI 选择 FPK 应用：

```bash
pnpm run build -- --fpk --app <app-name>
```

交互式构建时执行 `pnpm run build`，选择 **FPK** 后可以多选应用。选择 `fn-deepseek-harness` 时，CLI 会先通过 `build:gateway` 构建 Gateway，再执行该应用的 `fnpack build`。

FPK 产物生成在应用目录中，不要提交 `.fpk` 或临时构建目录。应用依赖的 Node.js、Python、镜像和中间件必须通过 Manifest、资源配置或 fnOS 安装流程声明，不能依赖开发机环境。

### 在 fnOS 上验证

```bash
cd /path/to/apps/<app-name>
appcenter-cli install-local
appcenter-cli start <app-name>
appcenter-cli stop <app-name>
appcenter-cli list

# 验证正式 FPK
appcenter-cli install-fpk <app-name>.fpk
```

`TRIM_*` 目录和安装向导环境变量只在 fnOS 生命周期中可靠存在。直接在开发机执行 `cmd/main` 或 `cmd/install_callback`，不能替代真实安装验证。

## Harness 插件开发

`plugins/*` 中维护 DeepSeek Harness 的 harness 插件。插件开发前加载 [`$dsh`](https://github.com/tnnevol/skills/tree/main/skills/dsh)，确认目标 DSH 版本、Profile、Host/Client 边界、Slot、Service 和 Bundle 约束。

:::warning 插件实现边界

官方 Harness 源码只用于查阅和调试，不直接修改。插件的 `package.json`、Peer Dependency、兼容声明和 `@deepseek-ai/*` 依赖必须与目标 DSH 版本一致。新增注册、定时器、网络连接或观察器时，必须提供可逆清理并验证 HMR、重复注册和真实 Profile 加载。

:::

安装或更新 Skill：

```bash
pnpx skills add tnnevol/skills --skill dsh -g
```

插件基础检查：

```bash
dsh --version
pnpm run check -- --packages --plugins
```

使用目标版本启动 Web Profile：

```bash
dsh web --no-open
```

需要查看组合配置时：

```bash
dsh --profile web --dump-config
dsh --profile web --dump-config | grep -n -C 3 'dsh-fnos'
```

### 插件构建、启动和检查

```bash
# 交互选择 harness 插件、FPK 或文档
pnpm run build

# 构建指定 harness 插件
pnpm run build -- --plugin fnos

# 启动指定 harness 插件的 watch
pnpm run start -- --plugin fnos

# 检查所有 harness 插件和共享包
pnpm run check -- --packages --plugins
```

插件的 `build`、`typecheck`、`test:unit` 和 `check` 写在各自的 `package.json`。Turbo 会根据 workspace 依赖先处理 `@tnnevol/dsh-semi-ui`，不要在根脚本中手工复制依赖步骤。

## 文档开发

文档由 VitePress 构建，流程图由 `vitepress-plugin-d2` 处理。构建包含 D2 代码块的文档前，确保 `d2 version` 可执行：

```bash
d2 version

# 启动文档开发服务
pnpm run start -- --docs

# 构建文档
pnpm run build -- --docs

# 预览已经构建好的站点
pnpm run docs:preview
```

`start` 是文档开发服务的唯一根入口；没有根 `dev` 命令。修改 `docs/` 下的 Markdown 后，VitePress 会自动更新页面。

## 根脚本与 Turbo

根脚本只负责把用户意图交给 CLI 或 Turbo：

```json
{
  "scripts": {
    "start": "pnpm exec fn-apps-cli start",
    "build": "pnpm exec fn-apps-cli build",
    "version": "pnpm exec fn-apps-cli version",
    "typecheck": "turbo run typecheck",
    "test:unit": "turbo run test:unit",
    "test": "turbo run test:unit",
    "check": "pnpm exec fn-apps-cli check",
    "release:notes": "pnpm exec fn-apps-cli release:notes"
  }
}
```

### 任务关系

| 任务 | 调度方式 | 关键行为 |
| --- | --- | --- |
| `build` | `fn-apps-cli` → `turbo run build` | `^build` 先构建 workspace 依赖 |
| `start` | `fn-apps-cli` → `turbo watch dev` | `dev` 持续监听，依赖先完成 `^build` |
| `typecheck` | 根脚本 → `turbo run typecheck` | `^typecheck` 先检查依赖 |
| `test:unit` | 根脚本 → `turbo run test:unit` | 先完成当前包 `build` |
| `test` | 根脚本 → `turbo run test:unit` | 当前仓库的兼容别名 |
| `check` | `fn-apps-cli` → 直接检查 + `turbo run check` | 汇总 `typecheck`、`build`、`test:unit` |

完整调度图和每个任务的分支见 [Package 任务与 Turbo](./package-tasks-and-turbo)。

## 版本与发布

项目/FPK 版本和 harness 插件版本分开维护，入口统一使用 `fn-apps-cli`：

```bash
# 交互选择维护区域
pnpm run version

# 项目 / FPK
pnpm run version -- project patch
pnpm run version -- project minor

# 指定 harness 插件
pnpm run version -- plugin fnos patch
pnpm run version -- plugin codex patch
pnpm run version -- plugin showcase patch

# 只修改文件，不提交或创建 Tag
pnpm run version -- project patch --no-commit --no-tag
```

项目版本更新根 `package.json`、`packages/**/package.json`、应用 `manifest` 和 README；harness 插件版本只更新指定插件的 `package.json`。默认创建提交和 Tag，但不会自动 push：

- 项目 / FPK：`v<版本号>`
- harness 插件：`plugin/<插件名>-v<版本号>`

推送项目 Tag 后，GitHub Actions 会分别执行通用 FPK、DeepSeek Harness FPK 和 Release 发布流程。具体 Workflow 见 [CI 构建](../build/ci)。

## 提交前检查

按改动范围选择检查；提交前建议执行完整检查：

```bash
# 文档或规格改动
git diff --check
pnpm run check -- --sdd
pnpm run build -- --docs

# 共享包或 harness 插件改动
pnpm run check -- --packages --plugins

# 完整门禁
pnpm run check -- --all
```

涉及 FPK、权限、Docker、网关或生命周期的改动，还必须在真实 fnOS 设备上完成安装、启动、停止、升级和卸载验证。

## 相关文档

- [Package 任务与 Turbo](./package-tasks-and-turbo)
- [快速开始](../guide/quick-start)
- [fnpack 打包](../build/fnpack)
- [版本管理](../build/versioning)
- [CI 构建](../build/ci)
- [Manifest 配置](./manifest)
- [生命周期脚本](./lifecycle)
- [权限与入口](./permissions)
- [用户向导](./wizard)
