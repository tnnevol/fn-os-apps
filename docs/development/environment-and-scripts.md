# 开发环境与脚本

本页只记录当前有效的开发入口。工具版本、根脚本和 CI 发生变化时，以仓库配置为准，并同步更新本页。

## 先记住三件事

1. **根命令优先**：日常开发从 `pnpm run ...` 进入，不要在根目录手写 `cd` 和任务编排。
2. **应用用 fnpack**：`apps/*` 没有统一的 Node.js workspace 任务，FPK 构建由 `fnpack` 完成。
3. **文档用 VitePress**：文档站的开发和构建由 `fn-apps-cli` 调 Turbo 与 VitePress 完成。

## 当前命令地图

根目录 `package.json` 是稳定入口，`tooling/fn-os-apps-cli` 中的 Commander 负责注册和分发 CLI 命令。

| 命令 | 当前用途 | 是否交互 |
| --- | --- | --- |
| `pnpm run start` | 启动文档开发服务 | 可选 |
| `pnpm run build` | 构建 FPK 应用和文档 | 可选 |
| `pnpm run check` | 检查 SDD 文档并构建文档站 | 可选 |
| `pnpm run version` | 维护项目/FPK 版本 | 可选 |
| `pnpm run release:notes` | 使用 `changelogithub` 生成 Release | 否 |
| `pnpm run typecheck` | 通过 Turbo 执行所有包的类型检查 | 否 |
| `pnpm run test` | 通过 Turbo 执行单元测试 | 否 |
| `pnpm run docs:preview` | 预览已经构建好的 VitePress 站点 | 否 |

任务边界、依赖图和状态分支见 [Package 任务与 Turbo](./package-tasks-and-turbo)。

## 已废弃入口

:::danger 不要继续使用

- 根目录的 `pnpm run dev`：根脚本不再提供该入口，请使用 `pnpm run start`。
- 根目录自定义 `bump` 脚本：已经废弃，请使用 `pnpm run version`。
- 历史的一键签到、插件发布等入口：随插件体系一并移除。

:::

需要注意：workspace 包中的 `dev` 任务**没有废弃**，它是 `turbo watch` 使用的内部任务；开发者通过 `start` 间接调用它，不应把它当作根目录命令。

## 开发环境

项目根目录是 pnpm workspace，版本约束以配置文件为准：

| 工具 | 当前要求 | 配置来源 |
| --- | --- | --- |
| Node.js | 24，最低 `>=24.0.0` | `.nvmrc`、根 `package.json#engines` |
| pnpm | `>=11.16.0`，项目固定 `11.16.0` | 根 `package.json#packageManager`、CI |
| [fnpack](https://developer.fnnas.com/docs/cli/fnpack/) | 本地 `1.2.3`；CI 构建 Workflow 当前使用 `1.2.1` | 本机 `PATH`、`.github/workflows/build-*.yml` |

初始化环境：

```bash
nvm use
pnpm install
node --version
pnpm --version
```

调整 Node.js、pnpm 或 fnpack 版本时，同时检查 `.nvmrc`、根 `package.json`、相关 Workflow 和本页。CI 的 fnpack 版本目前与本地版本不同，不要在未同步 Workflow 的情况下自行假定两者一致。

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

交互式构建时执行 `pnpm run build`，选择 **FPK** 后可以多选应用，随后对每个应用执行 `fnpack build`。

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

## 文档开发

文档由 VitePress 构建，流程图由 `vitepress-mermaid-plugin` 在浏览器端渲染，不依赖任何系统可执行文件：

```bash
# 启动文档开发服务
pnpm run start -- --docs

# 构建文档
pnpm run build -- --docs

# 预览已经构建好的站点
pnpm run docs:preview
```

`start` 是开发服务的唯一根入口；CLI 通过 Turbo 的 `dev` 任务启动 `docs` workspace 的 VitePress 服务，文档开发端口固定为 `9876`。有 TTY 时它进入 `turbo watch`（保留 TUI 与快捷键），没有 TTY 时直接启动 `vitepress dev`，避免 interactive 任务报错。修改 `docs/` 下的 Markdown 后，VitePress 会自动更新页面。流程图用 ` ```mermaid ` 代码块编写，由插件转成客户端组件渲染，深色模式会自动切换主题。

## 根脚本与 Turbo

根脚本只负责把用户意图交给 CLI 或 Turbo：

```json
{
  "scripts": {
    "start": "pnpm exec fn-apps-cli start",
    "build": "pnpm exec fn-apps-cli build",
    "version": "pnpm exec fn-apps-cli version",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "check": "pnpm exec fn-apps-cli check",
    "release:notes": "pnpm exec fn-apps-cli release:notes"
  }
}
```

### 任务关系

| 任务 | 调度方式 | 关键行为 |
| --- | --- | --- |
| `build` | `fn-apps-cli` | FPK 应用走 `fnpack`，文档走 VitePress |
| `start` | `fn-apps-cli` → `turbo watch dev` | 有 TTY 时保留 TUI，无 TTY 时直接启动 VitePress |
| `typecheck` | 根脚本 → `turbo run typecheck` | `^typecheck` 先检查依赖 |
| `test` | 根脚本 → `turbo run test` | 先完成当前包 `build` |
| `check` | `fn-apps-cli` | SDD 校验与文档构建 |

完整调度图和每个任务的分支见 [Package 任务与 Turbo](./package-tasks-and-turbo)。

## 版本与发布

项目/FPK 版本入口统一使用 `fn-apps-cli`：

```bash
# 交互选择发布版本
pnpm run version

# 直接指定
pnpm run version -- patch
pnpm run version -- minor

# 只修改文件，不提交
pnpm run version -- patch --no-commit --no-tag
```

项目版本更新根 `package.json`、`docs/package.json`、应用 `manifest` 和文档里的版本示例；文档站点从 `docs/package.json` 读取自身版本。默认创建提交和 `v<版本号>` Tag，不会自动 push。

推送项目 Tag 后，GitHub Actions 会构建 FPK 并发布 Release。具体 Workflow 见 [CI 构建](../build/ci)。

## 提交前检查

按改动范围选择检查；提交前建议执行完整检查：

```bash
# 文档或规格改动
git diff --check
pnpm run check -- --sdd
pnpm run build -- --docs

# 文档或规格改动
pnpm run check -- --sdd --docs

# 完整门禁
pnpm run check -- --all
```

涉及 FPK、权限、Docker、网关或生命周期的改动，还必须在真实 fnOS 设备上完成安装、启动、停止、升级和卸载验证。

## 相关文档

- [Package 任务与 Turbo](./package-tasks-and-turbo)
- [快速开始](./quick-start)
- [fnpack 打包](../build/fnpack)
- [版本管理](../build/versioning)
- [CI 构建](../build/ci)
- [Manifest 配置](./manifest)
- [生命周期脚本](./lifecycle)
- [权限与入口](./permissions)
- [用户向导](./wizard)
