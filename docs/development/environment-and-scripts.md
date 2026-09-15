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
| `pnpm run start` | 启动 harness 插件 watch、文档服务和/或本地 DSH Web | 可选 |
| `pnpm run build` | 构建 harness 插件、FPK 应用和文档 | 可选 |
| `pnpm run check` | 检查 SDD、文档、共享包和 harness 插件 | 可选 |
| `pnpm run version` | 维护项目/FPK 或单个 harness 插件版本 | 可选 |
| `pnpm run publish` | 交互选择并发布 DSH 插件 npm 包（当前 `rc`） | 可选 |
| `pnpm run release:notes` | 使用 `changelogithub` 生成 Release | 否 |
| `pnpm run typecheck` | 通过 Turbo 执行所有包的类型检查 | 否 |
| `pnpm run test` | 通过 Turbo 执行单元测试 | 否 |
| `pnpm run docs:preview` | 预览已经构建好的 VitePress 站点 | 否 |

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
| [dsh](https://github.com/deepseek-ai/deepseek-harness) | 与插件兼容声明和锁定版本一致（当前 `0.1.5-rc.2`） | 根 `package.json`、`pnpm-lock.yaml` |

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
# 仓库内 CLI，版本与 FPK 运行时基线一致
pnpm exec dsh --version
pnpm run check -- --packages --plugins
```

需要查看组合配置时（下列命令使用全局 `dsh`；要检查仓库内 profile，请先按下一节设置 `DSH_HOME`）：

```bash
dsh --profile web --dump-config
dsh --profile web --dump-config | grep -n -C 3 'dsh-fnos'
```

### 本地 DSH Web

仓库根 `package.json` 声明了与 FPK 运行时基线相同的 `@deepseek-ai/dsh`；`pnpm install` 之后即可用仓库内的 CLI，不必依赖全局安装。`start` 的「DSH Web」目标会以仓库根 `.dsh` 作为 `DSH_HOME` 启动本地实例，profile、凭据和会话都留在检出目录，与开发者的 `$HOME/.dsh` 互不影响：

```bash
# 交互多选：Harness 插件 / 项目文档 / DSH Web
pnpm run start

# 直接启动本地 DSH Web（固定 3150 端口）
pnpm run start -- --web

# 需要手工检查仓库内 profile 时，自行指定同一个 DSH_HOME
DSH_HOME="$PWD/.dsh" pnpm exec dsh --profile web --dump-config
```

本地 DSH Web 固定使用 `3150`，与 FPK 网关占用的 `127.0.0.1:3080` 区分，两者可在同一台开发机同时运行。三类目标可以任意组合：`start` 把「Harness 插件」「项目文档」和 DSH Web 一起交给**同一个 `turbo watch`**，各自作为一行任务显示在同一个 TUI 里。DSH Web 因此是 Turbo 的根任务 `//#dev:web`，而不是 Turbo 之外另起的第二个前台进程——后者会把终端从 TUI 手里抢走。`.dsh/` 属于本地运行状态，已在 `.gitignore` 中排除。

文档服务的 `dev` 任务标记为 `interactive`，这样它的快捷键仍然可用：在 TUI 中按 `i` 把键盘交给该任务，按 `Ctrl+z` 交还给 Turbo；VitePress 自己的 `h`（帮助）和 `r`（重启）因此照常工作。Turbo 不允许在没有终端界面的情况下运行 interactive 任务，所以 `start` 按是否有 TTY 决定文档服务的运行位置：有 TTY 时它进入 `turbo watch`（保留 TUI 与快捷键），没有 TTY 时（CI、管道、后台任务）直接启动 `vitepress dev`，而不是让整条命令报 `Cannot run interactive task` 失败。

插件与文档共用 `dev` 任务名，因此文档只作为 `dev` 的 `--filter` 出现，不写成显式的 `包#任务`：显式任务名会把该包重新拉进范围，裸 `dev` 随即再匹配一次，VitePress 会被启动两遍。

启动前，CLI 会把本仓库的插件链接进这个本地 profile，因此新克隆的检出目录第一次 `pnpm run start -- --web` 也能直接进入带插件的 DSH Web：

1. 先用 Turbo 构建待链接的插件。profile 通过包 `exports` 解析入口，而入口指向 git 忽略的 `lib/`；没有产物时 `dsh plugin add` 会链到一个无法加载的包。
2. 再用 `dsh plugin --profile web add <插件目录>` 逐个链接。由 DSH CLI 写入（而不是直接改 profile 清单）才会把插件同步进 `dsh.profile.bundles`，插件因此真正成为一层 patch layer。
3. 已链接且已在 bundle 列表中的插件会被跳过，重复启动不重复安装；链接后的插件产物变更由 `start` 的插件 watch 或重新构建生效。

内置范围是仓库里可在任意 DSH 客户端使用的插件。**`@tnnevol/dsh-fnos` 不在其中**：它注册 fnOS 设置命名空间、fnOS JS SDK 桥和网关前缀路由，脱离 fnOS 宿主没有可提供的能力，只会给本地 profile 增加加载失败的行。

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

插件的 `build`、`typecheck`、`test` 和 `check` 写在各自的 `package.json`。Turbo 会根据 workspace 依赖先处理 `@tnnevol/dsh-semi-ui`，不要在根脚本中手工复制依赖步骤。

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

`start` 是开发服务的唯一根入口；交互选择完成后，CLI 通过 Turbo 的 `dev` 任务统一启动插件和 `docs` workspace 的 VitePress 服务，文档开发端口固定为 `9876`。修改 `docs/` 下的 Markdown 后，VitePress 会自动更新页面。D2 图需要系统可执行文件 `d2`；如果它不在 `PATH`，可通过 `D2_BIN=/path/to/d2` 指定。D2 暂不可用时，文档服务会保留原始 D2 代码块而不会启动失败。

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
    "publish": "pnpm exec fn-apps-cli publish",
    "release:notes": "pnpm exec fn-apps-cli release:notes"
  }
}
```

### 任务关系

| 任务 | 调度方式 | 关键行为 |
| --- | --- | --- |
| `build` | `fn-apps-cli` → `turbo run build` | `^build` 先构建 workspace 依赖 |
| `start` | `fn-apps-cli` → `turbo watch dev` | 统一传入 docs/插件 filters，TUI 分别显示持续任务；watch 任务自行完成初始构建 |
| `typecheck` | 根脚本 → `turbo run typecheck` | `^typecheck` 先检查依赖 |
| `test` | 根脚本 → `turbo run test` | 先完成当前包 `build` |
| `check` | `fn-apps-cli` → 直接检查 + `turbo run check` | 汇总 `typecheck`、`build`、`test` |

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

# 只修改文件，不提交
pnpm run version -- project patch --no-commit --no-tag
```

项目版本更新根 `package.json`、`docs/package.json`、`packages/**/package.json`、应用 `manifest` 和 README；文档站点从 `docs/package.json` 读取自身版本；harness 插件版本只更新指定插件的 `package.json`。项目版本默认创建提交和 Tag，插件版本默认只创建提交；两者都不会自动 push：

- 项目 / FPK：`v<版本号>`

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
