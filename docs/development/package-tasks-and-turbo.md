# Package 任务与 Turbo

本页说明仓库中“入口 `package.json`、`fnos-apps` CLI、Turbo 和 workspace package 任务”的分工与调用顺序。修改根脚本、`turbo.json` 或包内任务时，先确认是否破坏了这条链路。

## 四层职责

| 层级 | 位置 | 职责 |
| --- | --- | --- |
| 用户入口 | 根 `package.json` | 提供稳定、简短的 `start`、`build`、`check`、`version` 等命令；不重复实现包任务 |
| 任务路由 | `tooling/fn-os-apps-cli/` | 处理交互提示、参数解析、文档构建、版本维护和 Turbo 调用 |
| 任务编排 | `turbo.json` | 声明 `build`、`dev`、`typecheck`、`test:unit`、`check` 的依赖、缓存和输出 |
| 实际任务 | 各 workspace 的 `package.json` | 执行 `tsdown`、`tsc`、`vitest` 等包自己的任务 |

根脚本是入口，不是实现层。例如：

```json
{
  "scripts": {
    "build": "pnpm exec fnos-apps build",
    "check": "pnpm exec fnos-apps check",
    "start": "pnpm exec fnos-apps start"
  }
}
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
cli: fnos-apps CLI
checker: SDD checker
vitepress: VitePress
turbo: Turbo
semi: dsh-semi-ui
packages: 共享包
plugins: DSH 插件

shape: sequence_diagram
developer -> root: pnpm run check -- --all
root -> cli: pnpm exec fnos-apps check --all
cli -> checker: 校验需求、计划和链接
cli -> vitepress: 构建 docs
cli -> turbo: pnpm exec turbo run check --filter=./packages/* --filter=./plugins/*
turbo -> semi: 先执行 package.json 的 build
turbo -> packages: 执行 package.json 的 check
turbo -> plugins: 执行 package.json 的 check
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
cli: fnos-apps CLI
turbo: Turbo
semi: dsh-semi-ui
plugin: dsh-fnos

shape: sequence_diagram
developer -> root: pnpm run build -- --plugin fnos
root -> cli: pnpm exec fnos-apps build --plugin fnos
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

插件启动使用 `turbo watch dev`，插件和 `@tnnevol/dsh-semi-ui` 的 `dev` 任务均为 `tsdown --watch`。文档开发服务由 VitePress 单独启动；两者可以在交互提示中同时选择。

```d2
developer: 开发者
root: 根 package.json
cli: fnos-apps CLI
turbo: Turbo
semi: dsh-semi-ui
plugin: dsh-fnos

shape: sequence_diagram
developer -> root: pnpm run start -- --plugin fnos
root -> cli: pnpm exec fnos-apps start --plugin fnos
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
