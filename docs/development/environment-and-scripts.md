# 开发环境与脚本

本页是 `fn-os-apps` 项目开发环境和构建脚本的维护入口。修改工具链或 CI 构建流程时，应同步更新本页，避免本地开发、fnOS 实机和 GitHub Actions 使用不同约定。

## 开发指南导航

- [Package 任务与 Turbo](./package-tasks-and-turbo)：解释根 `package.json`、`fnos-apps` CLI、Turbo 和 workspace package 的任务边界与时序。
- [Manifest 配置](./manifest)：维护应用身份、版本、桌面入口和运行约束。
- [生命周期脚本](./lifecycle)：实现安装、启动、升级、停止和卸载阶段的脚本契约。
- [权限与入口](./permissions)：配置运行用户、资源目录、桌面入口和网关访问边界。
- [用户向导](./wizard)：设计安装、配置、升级和卸载时的用户输入。

## 开发环境

项目根目录是 pnpm workspace，版本约束以根目录配置为准：

| 工具 | 当前要求 | 配置来源 |
| --- | --- | --- |
| Node.js | 24，最低 `>=24.0.0` | `.nvmrc`、`package.json#engines` |
| pnpm | `>=11.16.0`，项目声明 `pnpm@11.16.0` | `package.json#packageManager` |
| [fnpack](https://developer.fnnas.com/docs/cli/fnpack/) | 本地使用 [`1.2.3`](https://developer.fnnas.com/docs/cli/fnpack/)；CI 当前固定为 `1.2.1` | 本机 `PATH`、`.github/workflows/build-*.yml` |
| [D2](https://d2lang.com/tour/install/) | 文档流程图使用 `0.7.1` | 本机 `PATH`、文档相关 Workflow |

调整 Node.js 或 pnpm 版本时，至少检查以下位置是否需要同步：

- `.nvmrc`
- 根目录 `package.json` 的 `engines` 和 `packageManager`
- GitHub Actions 中的 `actions/setup-node`
- DSH 原生依赖准备配置
- 本页和快速开始文档

升级 fnpack 时，应同时更新通用应用和 DeepSeek Harness 的构建 Workflow，避免同一 Tag 产生不同工具版本构建的 FPK。

## FPK 应用开发环境

开发或维护 `apps/*` 下的 FPK 应用前，需要准备以下文档、工具和实机环境：

::: warning 框架搭建规范
新建或重建 FPK 应用框架前，必须先加载 [`$fnnas-docs`](https://github.com/tnnevol/skills/tree/main/skills/fnnas-docs)，并严格遵循 Skill 中的模板结构、Manifest、生命周期、权限、资源和用户向导规范。原生应用使用 `fnpack create <app-name>` 创建；只有明确开发 Docker 应用时才使用 `fnpack create <app-name> --template docker`。创建后不得删除模板自带文件或目录，只能在模板基础上修改和扩展。
:::

| 项目 | 要求 | 用途 |
| --- | --- | --- |
| [`fnnas-docs` Skill](https://github.com/tnnevol/skills/tree/main/skills/fnnas-docs) | AI 协作开发时必须启用 | 查询 fnOS 应用结构、Manifest、生命周期、用户向导、权限、入口、JS SDK 和开放 API 约束 |
| [飞牛应用开放平台](https://developer.fnnas.com/) | 必须作为平台规则的权威来源 | 查看快速开始、开发指南、开放 API、CLI 工具和更新日志 |
| [飞牛 LLM 文档索引](https://developer.fnnas.com/llms.txt) | 推荐提供给 AI 工具 | 快速定位官方文档章节 |
| [飞牛完整 LLM 文档](https://developer.fnnas.com/llms-full.txt) | 需要完整上下文时使用 | 集中查阅官方文档全文 |
| [fnpack 1.2.3](https://developer.fnnas.com/docs/cli/fnpack/) | 本地构建 FPK 必须安装 | 校验应用目录并生成 `.fpk` 安装包 |
| Node.js 24 与 pnpm 11.16 | 本仓库开发必须安装 | 管理文档、共享包、插件和项目检查命令 |
| fnOS 测试设备 | 发布前必须验证 | 验证安装、升级、启动、停止、权限、网关和卸载流程 |
| `appcenter-cli` | 由 fnOS 设备提供 | 在 NAS 上执行本地安装、FPK 安装和应用状态检查 |

使用 AI 修改 FPK 应用时，应在任务中显式引用 [`$fnnas-docs`](https://github.com/tnnevol/skills/tree/main/skills/fnnas-docs)。该 Skill 由 [`tnnevol/skills`](https://github.com/tnnevol/skills) 项目维护，负责把官方文档中的应用模板、生命周期和权限约束带入实现过程；如果 Skill 内容与飞牛应用开放平台的最新文档不一致，以官方文档为准并同步更新 Skill。

本地准备完成后进行基础检查：

```bash
nvm use
pnpm install
fnpack --help
```

FPK 应用构建不要求统一准备 Docker 环境。应用自身所需的 Node.js、Python、中间件或其他运行时，应通过 `manifest` 和应用资源配置声明，并在 fnOS 实机安装流程中验证。

fnOS 框架提供的 `TRIM_*` 目录和安装向导环境变量只在应用生命周期中可靠存在。普通开发机适合执行静态检查和 `fnpack build`，不要把直接运行 `cmd/install_callback` 或 `cmd/main` 的结果当作真实安装验证。

## Harness 插件开发环境

当前仓库在 `plugins/*` 下开发 DeepSeek Harness 插件。使用 AI 开发、排错或升级插件时必须启用 [`$dsh`](https://github.com/tnnevol/skills/tree/main/skills/dsh) Skill，用它查询 Cordis 生命周期、Profile 组合、Web 插槽、设置卡片、模型适配器、附件和插件发布规范。

::: warning 框架搭建规范
新建或重建 Harness 插件框架前，必须先加载 [`$dsh`](https://github.com/tnnevol/skills/tree/main/skills/dsh)，并按 Skill 指向的扩展开发、架构和 CLI 参考确定插件类型、Host/Client 边界、Service、Slot、生命周期、配置 Schema、Bundle 与 Profile 集成方式。不得凭经验自行设计目录、入口、Patch 或类型声明；具体字段和接口以目标 DSH 版本的文档与源码为准。
:::

[`dsh` Skill](https://github.com/tnnevol/skills/tree/main/skills/dsh) 由 [`tnnevol/skills`](https://github.com/tnnevol/skills) 项目维护，可只安装该 Skill：

```bash
pnpx skills add tnnevol/skills --skill dsh
```

需要在所有项目中使用时进行全局安装：

```bash
pnpx skills add tnnevol/skills --skill dsh -g
```

Skill 源码位于 [`skills/dsh`](https://github.com/tnnevol/skills/tree/main/skills/dsh)。安装后，在任务中显式引用 [`$dsh`](https://github.com/tnnevol/skills/tree/main/skills/dsh)，并根据任务读取 Skill 指向的扩展开发、架构或 CLI 参考。

Harness 插件开发还需要准备：

| 项目 | 要求 | 用途 |
| --- | --- | --- |
| Node.js 24 与 pnpm 11.16 | 使用项目根目录约束 | 安装工作空间依赖并构建插件和共享 UI 包 |
| 本地 `dsh` CLI | 版本必须与插件目标兼容版本一致 | 启动 Web Profile、加载插件并验证真实组合配置 |
| [DeepSeek Harness 源码](https://github.com/deepseek-ai/deepseek-harness) | 推荐保留最新的本地只读副本 | 查询当前版本的类型、Slot、Service、Profile 和客户端实现 |
| [Harness 插件开发文档](https://deepseek-harness.github.io/deepseek-harness/develop/basic/) | 开发前必须查阅 | 确认插件结构、配置、工具和发布方式 |
| `@tnnevol/dsh-semi-ui` | Web 插件统一使用 | 复用与 DSH 一致的 Semi Design 组件和主题，不在插件中重复维护 UI 体系 |

基础环境检查：

```bash
dsh --version
pnpm install
pnpm run check -- --packages --plugins
```

本地联调时使用目标版本的 CLI 启动 Web Profile：

```bash
dsh web --no-open
dsh --profile web --dump-config
```

插件的 `package.json`、Peer Dependency、兼容声明和使用的 `@deepseek-ai/*` 依赖必须与目标 DSH 版本一致。实现应保留在本仓库的插件目录中，官方 Harness 源码只用于查阅和调试，不直接修改。新增注册、定时器、网络连接或观察器时必须提供可逆清理，并覆盖卸载、HMR、重复注册和真实 Profile 加载场景。

## 工作空间职责

`pnpm-workspace.yaml` 当前包含以下工作空间：

| 目录 | 职责 | 常用操作 |
| --- | --- | --- |
| `apps/*` | fnOS 应用、生命周期脚本、安装资源和 FPK 内容 | `fnpack build`、NAS 实机安装 |
| `docs` | VitePress 文档站 | `pnpm run start -- --docs`、`pnpm run build -- --docs` |
| `packages/*` | 插件共享包，目前包含 DSH Semi UI | `pnpm run check -- --packages` |
| `plugins/*` | DSH 等 Agent 生态插件 | `pnpm run check -- --plugins` |

`apps/*` 主要由 fnpack 管理，不要求每个应用都提供 `package.json`。Node.js 工作空间命令主要用于文档、共享包和插件。

根 `package.json` 只作为稳定入口：`start`、`build`、`check` 和 `version` 交给 `fnos-apps` CLI；共享包和插件的实际 `build`、`dev`、`typecheck`、`test:unit`、`check` 任务分别写在各自的 `package.json`，依赖顺序和缓存由 `turbo.json` 管理。完整调用时序见 [Package 任务与 Turbo](./package-tasks-and-turbo)。

## 常用开发命令

### 文档

文档站使用 `vitepress-plugin-d2` 渲染 D2 流程图和 Grid Diagram。Markdown 中使用 `d2` 代码块；本地预览或构建包含流程图的文档前，需要确保 `d2 version` 可以正常执行。

```bash
d2 version
pnpm run start -- --docs
pnpm run check -- --sdd
pnpm run build -- --docs
pnpm run docs:preview
```

### 共享包和插件

```bash
pnpm run check -- --packages --plugins
pnpm run check -- --all
```

只验证单个工作空间时使用过滤器：

```bash
pnpm --filter @tnnevol/dsh-semi-ui run check
pnpm --filter @tnnevol/dsh-fnos run check
pnpm --filter @tnnevol/dsh-codex-auth run check
```

插件的 `check` 一般按 `typecheck → build → test` 执行。DSH 插件执行 `build` 前会先构建 `@tnnevol/dsh-semi-ui`，确保共享组件导出与插件客户端 Bundle 一致。

## 实机运行和调试

应用依赖 fnOS 提供的目录、用户、权限和环境变量。推荐在测试 NAS 上使用应用中心流程验证：

```bash
cd /path/to/apps/<appname>
appcenter-cli install-local

appcenter-cli start <appname>
appcenter-cli stop <appname>
appcenter-cli list
```

需要复现正式安装包行为时：

```bash
appcenter-cli install-fpk <appname>.fpk
```

排查时优先查看应用中心日志和应用标准输出。只有确认 fnOS 已创建对应 `TRIM_*` 环境后，才直接调用生命周期脚本；普通开发机直接运行 `cmd/main` 得到的结果不代表真实安装行为。

## FPK 构建

### 标准应用

除 DeepSeek Harness 的原生依赖准备外，通用应用使用统一命令：

```bash
cd apps/<appname>
fnpack build
```

生成的 `.fpk` 位于当前应用目录，不提交到 Git。

### DeepSeek Harness

本地直接使用 `fnpack` 构建：

```bash
cd apps/fn-deepseek-harness
fnpack build
```

`.github/workflows/build-dsh-fn.yml` 会先使用 Node.js 24 执行 `.github/scripts/prepare-dsh-native.sh`，为固定 DSH 版本准备 `node-pty` 原生文件，再执行 `fnpack build`。FPK 安装回调会把固定 DSH 版本传给 `install-node-pty.sh`，安装前校验 `dsh-version` 与 native 文件版本一致。修改 DSH 或 `node-pty` 版本时，应同步维护：

- `.github/config/dsh-native-<dsh-version>.env`
- `.github/scripts/prepare-dsh-native.sh`
- `.github/workflows/build-dsh-fn.yml`
- `apps/fn-deepseek-harness/app/scripts/install-node-pty.sh`
- FPK 安装脚本中固定的 DSH 版本

## 版本与发布脚本

版本任务由根目录 `fnos-apps` CLI 暴露，底层位于 `tooling/fn-os-apps-cli` workspace，使用 `bumpp` 分开维护项目/FPK 版本和插件版本：

```bash
# 项目与 FPK 版本
pnpm run version -- project patch
pnpm run version -- project minor

# 指定插件版本
pnpm run version -- plugin fnos patch
pnpm run version -- plugin codex patch
pnpm run version -- plugin showcase patch
```

项目版本命令更新根 `package.json`、`packages/*/package.json`、与当前版本匹配的应用 Manifest 和 README；插件版本命令只更新指定插件。两类命令均由 `bumpp` 创建对应提交和 Tag，插件 Tag 使用 `plugin/<插件名>-v<版本号>`，默认不自动 push。

需要只修改版本文件时，在命令末尾增加 `--no-commit --no-tag`。根目录自定义 `bump` 脚本已废弃，插件版本不会被项目/FPK 版本命令修改。

推送 `v*` Tag 后：

1. `build-release.yml` 创建草稿 Release。
2. `build-common-fn.yml` 扫描除 DeepSeek Harness 外的应用并并行执行 `fnpack build`。
3. `build-dsh-fn.yml` 单独准备 DSH 原生依赖并构建 FPK。
4. 所有 FPK 上传完成后生成 Release 说明并发布 Release。

```d2
direction: right

tag: 推送 v* Tag
release: 创建草稿 Release
builds: 并行构建 {
  grid-columns: 2
  common: 通用应用
  harness: DeepSeek Harness
}
publish: 上传 FPK 并发布 Release

tag -> release -> builds
builds.common -> publish
builds.harness -> publish
```

## 维护检查清单

### 修改构建方式

- [ ] 本地 `fnpack build` 可以独立完成。
- [ ] 构建不依赖未提交文件、个人绝对路径或本机缓存。
- [ ] 构建脚本具有可执行权限并在失败时返回非零退出码。
- [ ] 通用应用与 DSH 专用 Workflow 的边界保持清晰。
- [ ] `.fpk` 和临时构建产物未进入 Git。

### 提交前验证

```bash
git diff --check
pnpm run check -- --sdd
pnpm run build -- --docs
pnpm run check -- --packages --plugins
```

涉及 FPK、权限、Docker、网关或生命周期的改动，还必须在真实 fnOS 环境完成安装、启动、停止、升级和卸载验证。

## 相关文档

- [Package 任务与 Turbo](./package-tasks-and-turbo)
- [Manifest 配置](./manifest)
- [生命周期脚本](./lifecycle)
- [权限与入口](./permissions)
- [用户向导](./wizard)
- [快速开始](/guide/quick-start)
- [仓库结构](/guide/repository-structure)
- [fnpack 打包](/build/fnpack)
- [版本管理](/build/versioning)
- [CI 构建](/build/ci)
- [发布流程](/build/release)
