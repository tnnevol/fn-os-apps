# Package 任务与 Turbo

本页说明仓库中“入口 `package.json`、`fn-apps-cli` CLI、Turbo 和 workspace package 任务”的分工与调用顺序。修改根脚本、`turbo.json` 或包内任务时，先确认是否破坏了这条链路。

## 四层职责

| 层级 | 位置 | 职责 |
| --- | --- | --- |
| 用户入口 | 根 `package.json` | 提供稳定、简短的 `start`、`build`、`check`、`version` 等命令；不重复实现包任务 |
| 任务路由 | `tooling/fn-os-apps-cli/` | `program.ts` 暴露 Commander 实例，各 `commands/*.ts` 注册命令并实现 action，处理交互提示、参数解析、文档构建、版本维护和 Turbo 调用 |
| 任务编排 | `turbo.json` | 声明 `build`、`start`（内部调度 `dev`）、`typecheck`、`test:unit`、`check` 的依赖、缓存和输出 |
| 实际任务 | 各 workspace 的 `package.json` | 执行 `tsdown`、`tsc`、`vitest` 等包自己的任务 |

根脚本是入口，不是实现层。例如：

```json
{
  "scripts": {
    "build": "pnpm exec fn-apps-cli build",
    "check": "pnpm exec fn-apps-cli check",
    "publish": "pnpm exec fn-apps-cli publish",
    "start": "pnpm exec fn-apps-cli start"
  }
}
```

## Turbo 任务调度步骤

每次 CLI 调用 Turbo 后，Turbo 不会简单地按目录顺序执行脚本，而是先解析过滤范围和 workspace 依赖，再按任务图调度。以 `check` 为例，`build`、`typecheck` 和 `test:unit` 会按照 `turbo.json` 中的依赖关系执行；没有依赖关系的就绪任务可以并行运行。

下方流程图使用 D2 的 `direction: down` 自动布局：主流程从上到下，分支从分叉节点向两侧平铺，不手工固定行列。菱形节点表示状态选择，边上的“是/否”“命中/未命中”表示不同分支。这样既保留了具体命令、依赖和状态，又让布局随任务图自动调整。

```d2
direction: down

invoke: "CLI: turbo run <task>"
filter: "1. 解析 task 与 --filter"
graph: "2. 展开 workspace 依赖图"
hash: "3. 计算任务哈希"
cache: "4. 查询缓存"
cacheStatus: {
  label: "缓存命中？"
  shape: diamond
}
restore: "命中：恢复 outputs"
deps: "未命中：调度依赖任务"
ready: "依赖完成：目标任务就绪"
run: "执行 package.json 脚本"
summary: "汇总状态与 outputs"

invoke -> filter -> graph -> hash -> cache -> cacheStatus
cacheStatus -> restore: 命中
cacheStatus -> deps: 未命中
deps -> ready -> run -> summary
restore -> summary
```

对应本仓库的 `turbo.json`：

- `build` 通过 `^build` 先调度 workspace 依赖的构建。
- `typecheck` 通过 `^typecheck` 先调度依赖包的类型检查。
- `test:unit` 依赖当前包的 `build`，避免测试使用过期产物。
- `check` 汇总当前包的 `typecheck`、`build` 和 `test:unit`；多个独立包之间由 Turbo 自动并行调度。
- 全局 `ui` 设置为 `tui`；多任务并行时使用终端任务面板分别查看日志，避免不同任务的输出混合在同一条流中。
- 交互命令会先完成所有主选项和子选项询问，再统一启动已选任务，避免任务执行期间继续等待输入。

## 各 Turbo 任务步骤

### `build`

交互模式先选择构建目标，插件、FPK 和文档可以多选；参数模式则直接进入对应分支：

```bash
pnpm run build
pnpm run build -- --plugin fnos
pnpm run build -- --fpk --app fn-deepseek-harness
pnpm run build -- --docs
```

```d2
direction: down

command: "pnpm run build"
cli: "fn-apps-cli build"
select: {
  label: "构建目标？"
  shape: diamond
}
plugins: "harness 插件：多选目标"
fpk: "FPK：多选应用"
docs: "文档：VitePress"
pluginFilter: "turbo run build --filter=harness 插件..."
pluginDeps: "^build：共享 UI 依赖"
pluginRun: "执行 harness 插件 package.json build"
fpkStatus: {
  label: "包含 DSH FPK？"
  shape: diamond
}
gateway: "是：先执行 Gateway build:app"
fpkSkip: "否：跳过 Gateway"
fpkRun: "每个应用执行 fnpack build"
docsRun: "执行 vitepress build docs"
summary: "汇总构建结果"
status: {
  label: "构建成功？"
  shape: diamond
}
result: "是：返回成功"
fail: "否：返回非零状态"

command -> cli -> select
select -> plugins: harness 插件
select -> fpk: FPK
select -> docs: 文档
plugins -> pluginFilter -> pluginDeps -> pluginRun -> summary
fpk -> fpkStatus
fpkStatus -> gateway: 是
fpkStatus -> fpkSkip: 否
gateway -> fpkRun
fpkSkip -> fpkRun
fpkRun -> summary
docs -> docsRun -> summary
summary -> status
status -> result: 是
status -> fail: 否
```

### `start`

`start` 是用户可见的开发启动入口；CLI 先让用户选择插件和/或文档，再把对应的 filters 一次性交给同一个 `turbo watch dev` 进程。文档和插件任务因此都显示在同一个 TUI 中。

```d2
direction: down

command: "pnpm run start"
cli: "fn-apps-cli start"
select: {
  label: "启动目标？（可多选）"
  shape: diamond
}
plugins: "harness 插件：选择目标"
docs: "文档：VitePress"
turbo: "turbo watch dev（同一 TUI）"
filters: "组合 filters：./docs + harness 插件..."
pluginWatch: "harness 插件 + dsh-semi-ui：tsdown --watch（含初始构建）"
docsWatch: "docs package：vitepress dev"
changeStatus: {
  label: "有源文件变化？"
  shape: diamond
}
rebuild: "是：重新生成 lib/**"
keep: "否：保持监听"
services: "开发服务持续运行"

command -> cli -> select
select -> plugins: harness 插件
select -> docs: 文档
plugins -> turbo
docs -> turbo
turbo -> filters
filters -> pluginWatch -> changeStatus
filters -> docsWatch -> services
changeStatus -> rebuild: 是
changeStatus -> keep: 否
rebuild -> changeStatus
keep -> changeStatus
pluginWatch -> services
```

### `typecheck`

`typecheck` 由根脚本直接调用 Turbo，不经过 `fn-apps-cli` 交互层。

```d2
direction: down

command: "pnpm run typecheck"
turbo: "turbo run typecheck --filter=目标..."
graph: "解析 workspace 依赖"
deps: "^typecheck：先检查依赖包"
target: "执行目标包 tsc -p tsconfig.json"
status: {
  label: "检查通过？"
  shape: diamond
}
result: "是：返回成功"
fail: "否：返回非零状态"

command -> turbo -> graph -> deps -> target -> status
status -> result: 是
status -> fail: 否
```

### `test:unit`

`test:unit` 由根脚本直接调用 Turbo，先满足当前包的 `build` 依赖，再启动 Vitest。

```d2
direction: down

command: "pnpm run test:unit"
turbo: "turbo run test:unit --filter=目标..."
graph: "读取 test:unit 任务图"
build: "dependsOn：先完成当前包 build"
run: "vitest run --config vitest.config.ts"
status: {
  label: "测试通过？"
  shape: diamond
}
result: "是：返回成功"
fail: "否：返回非零状态"

command -> turbo -> graph -> build -> run -> status
status -> result: 是
status -> fail: 否
```

### `test`

`test` 同样由根脚本直接调用 Turbo，并先等待 `test:unit` 完成。

```d2
direction: down

command: "pnpm run test"
turbo: "turbo run test --filter=目标..."
graph: "读取 test 任务图"
unit: "dependsOn：先完成 test:unit"
run: "执行 package.json 的 test"
status: {
  label: "测试通过？"
  shape: diamond
}
result: "是：返回成功"
fail: "否：返回非零状态"

command -> turbo -> graph -> unit -> run -> status
status -> result: 是
status -> fail: 否
```

### `check`

`check` 与 `build` 一样由 `fn-apps-cli` 先处理多选目标，再并行执行直接检查和 Turbo 检查。

```d2
direction: down

command: "pnpm run check"
cli: "fn-apps-cli check"
select: {
  label: "检查目标？（可多选）"
  shape: diamond
}
sdd: "SDD：需求、计划和链接"
docs: "文档：VitePress"
packages: "共享包"
plugins: "harness 插件"
directSdd: "执行 SDD checker"
directDocs: "执行 vitepress build docs"
turbo: "turbo run check --filter=packages/plugins"
turboGraph: "展开 check 依赖图"
build: "dependsOn：build"
typecheck: "dependsOn：typecheck"
unit: "build 完成后：test:unit"
checkRun: "执行各包 package.json 的 check"
summary: "汇总所有检查结果"
status: {
  label: "检查通过？"
  shape: diamond
}
result: "是：返回成功"
fail: "否：返回非零状态"

command -> cli -> select
select -> sdd: SDD
select -> docs: 文档
select -> packages: 包
select -> plugins: harness 插件
sdd -> directSdd -> summary
docs -> directDocs -> summary
packages -> turbo
plugins -> turbo
turbo -> turboGraph
turboGraph -> build
turboGraph -> typecheck
build -> unit
build -> checkRun
typecheck -> checkRun
unit -> checkRun
checkRun -> summary
summary -> status
status -> result: 是
status -> fail: 否
```

## 其他 CLI 命令步骤

非 Turbo 任务也沿用相同的表达方式：根命令进入 `fn-apps-cli`，命令模块负责交互和参数分支，最后执行实际工具并汇总状态。

### `version`

```d2
direction: down

command: "pnpm run version"
cli: "fn-apps-cli version"
area: {
  label: "维护区域？"
  shape: diamond
}
project: "项目 / FPK"
plugin: "harness 插件"
pluginSelect: "选择具体 harness 插件"
release: "选择版本号与发布选项"
files: "更新项目版本文件"
pluginFile: "更新 harness 插件 package.json"
bumpp: "bumpp：提交与创建 Tag"
status: {
  label: "版本维护成功？"
  shape: diamond
}
result: "是：返回成功"
fail: "否：返回非零状态"

command -> cli -> area
area -> project: 项目
area -> plugin: harness 插件
project -> release -> files -> bumpp
plugin -> pluginSelect -> release -> pluginFile -> bumpp
bumpp -> status
status -> result: 是
status -> fail: 否
```

### `release:notes`

```d2
direction: down

command: "pnpm run release:notes"
cli: "fn-apps-cli release:notes"
tag: "读取 GITHUB_REF_NAME"
prerelease: {
  label: "预发布 Tag？"
  shape: diamond
}
flag: "补充 --prerelease"
changelog: "执行 changelogithub"
github: "创建或更新 GitHub Release"
status: {
  label: "Release 成功？"
  shape: diamond
}
result: "是：返回成功"
fail: "否：返回非零状态"

command -> cli -> tag -> prerelease
prerelease -> flag: 是
prerelease -> changelog: 否
flag -> changelog -> github -> status
status -> result: 是
status -> fail: 否
```

### `build:gateway`

```d2
direction: down

command: "fn-apps-cli build:gateway"
cli: "命令模块 action"
turbo: "turbo run build:app --filter=@tnnevol/fnos-gateway"
gateway: "执行 Gateway package.json 的 build:app"
status: {
  label: "Gateway 构建成功？"
  shape: diamond
}
result: "是：返回成功"
fail: "否：返回非零状态"

command -> cli -> turbo -> gateway -> status
status -> result: 是
status -> fail: 否
```

## 检查任务交互

执行 `pnpm run check` 会进入多选提示；Agent、CI 或提交脚本应使用参数避免交互：

```bash
pnpm run check -- --sdd
pnpm run check -- --docs
pnpm run check -- --packages --plugins
pnpm run check -- --all
```

下图展示一次 `--all` 检查的主要交互。SDD 和文档检查由 CLI 直接处理，包检查统一交给一次 Turbo 调度；Turbo 根据依赖图先构建共享包，再执行各包的 `check`。

```d2
developer: 开发者
root: 根 package.json
cli: fn-apps-cli CLI
checker: SDD checker
vitepress: VitePress
turbo: Turbo
semi: dsh-semi-ui
packages: 共享包
plugins: harness 插件

shape: sequence_diagram
developer -> root: pnpm run check -- --all
root -> cli: pnpm exec fn-apps-cli check --all
cli -> checker: 校验需求、计划和链接
cli -> vitepress: 构建 docs
cli -> turbo: pnpm exec turbo run check --filter=./packages/* --filter=./plugins/*
turbo -> semi: 先执行 package.json 的 build
turbo -> packages: 执行 package.json 的 check
turbo -> plugins: 执行 harness 插件 package.json 的 check
packages -> turbo: 返回检查结果
plugins -> turbo: 返回检查结果
turbo -> cli: 汇总任务结果
checker -> cli: 返回静态检查结果
vitepress -> cli: 返回文档构建结果
cli -> developer: 返回成功或非零退出码
```

## 构建任务交互

插件构建使用依赖过滤器，例如：

```bash
pnpm run build -- --plugin fnos
```

CLI 将目标插件转换为 Turbo filter。由于插件在自己的 `package.json` 中声明了 `@tnnevol/dsh-semi-ui` workspace 依赖，`turbo.json` 的 `build.dependsOn: ["^build"]` 会自动先构建共享 UI，不需要在根脚本中手工编排。

```d2
developer: 开发者
root: 根 package.json
cli: fn-apps-cli CLI
turbo: Turbo
semi: dsh-semi-ui
plugin: dsh-fnos

shape: sequence_diagram
developer -> root: pnpm run build -- --plugin fnos
root -> cli: pnpm exec fn-apps-cli build --plugin fnos
cli -> turbo: turbo run build --filter=dsh-fnos...
turbo -> semi: package.json build
turbo -> plugin: package.json build
turbo -> cli: 返回构建结果
cli -> developer: 输出构建状态
```

`...` 表示把目标包的依赖纳入过滤范围；实际是否执行依赖任务，仍由 workspace 依赖声明和 Turbo 任务图决定。

## 开发启动任务

```bash
# 交互选择插件和/或文档
pnpm run start

# Agent 或脚本直接指定
pnpm run start -- --plugin fnos
pnpm run start -- --docs
```

插件和文档均通过同一个 `turbo watch dev` 进程启动：插件和 `@tnnevol/dsh-semi-ui` 的 `dev` 任务为 `tsdown --watch`，`docs` workspace 的 `dev` 任务为 `vitepress dev`。两者在 TUI 中分别显示。

```d2
developer: 开发者
root: 根 package.json
cli: fn-apps-cli CLI
turbo: Turbo
semi: dsh-semi-ui
plugin: dsh-fnos

shape: sequence_diagram
developer -> root: pnpm run start -- --plugin fnos
root -> cli: pnpm exec fn-apps-cli start --plugin fnos
cli -> turbo: turbo watch dev --filter=dsh-fnos...
turbo -> semi: 监听并执行 tsdown --watch
turbo -> plugin: 监听并执行 tsdown --watch
semi -> turbo: 修改后重新生成 lib
plugin -> turbo: 修改后重新生成插件 Bundle
turbo -> cli: 持续运行直到终止
```

## 编写和修改规则

1. 根 `package.json` 只增加稳定入口，不把 `cd`、重复构建依赖或包内实现写入根脚本。
2. 包的实际任务放在对应 workspace 的 `package.json`；任务名称要能被 Turbo 统一调用。
3. 新增任务后同步在 `turbo.json` 声明 `dependsOn`、`outputs`、`cache` 或 `persistent`。
4. workspace 依赖必须真实写入包的 `dependencies` 或 `devDependencies`，否则 `^build` 无法推导依赖顺序。
5. `package.json` 和 Workflow 中使用 `turbo run`；持续开发使用 `turbo watch`。
6. 同一类检查尽量通过一次 Turbo 调度传入多个 filter，避免共享依赖被多个 Turbo 进程重复执行。

## 常用验证

```bash
pnpm run check -- --sdd --docs
pnpm run check -- --packages --plugins
pnpm run check -- --all
pnpm run build -- --docs
```

相关页面：

- [开发环境与脚本](./environment-and-scripts)
- [Manifest 配置](./manifest)
- [生命周期脚本](./lifecycle)
- [权限与入口](./permissions)
- [用户向导](./wizard)
- [仓库结构](/guide/repository-structure)
