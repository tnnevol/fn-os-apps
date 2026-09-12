# 参与贡献

## 修改流程

1. 从 `main` 创建分支。
2. 按 [SDD 维护规范](/guide/sdd-workflow) 判断是否需要更新需求和计划。
3. 修改对应应用、插件或文档。
4. 运行与改动相关的校验，包括 `pnpm run check -- --all`。
5. 使用 Conventional Commits 创建提交。
6. 推送分支并提交 Pull Request，填写仓库 PR 检查清单。

## Commit 规范

本仓库使用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 规范，提交信息由提交钩子自动校验：

```text
<type>(<scope>): <description>
```

### type

| 类型 | 用途 |
| --- | --- |
| `feat` | 新增功能或能力 |
| `fix` | 修复问题 |
| `docs` | 仅文档变更 |
| `refactor` | 重构，不改变外部行为 |
| `test` | 测试变更 |
| `build` | 构建、依赖或打包变更 |
| `ci` | CI/CD 配置变更 |
| `chore` | 其他维护性变更 |
| `perf` | 性能优化 |
| `revert` | 回滚提交 |

`scope` 建议使用受影响的应用名、插件名或模块名，例如 `fn-memos`、`fn-deepseek-harness`、`hooks`。描述使用祈使句，简明说明结果，不要以句号结尾。

```text
feat(fn-memos): add configurable storage settings
fix(fn-deepseek-harness): restrict unsupported listen address
docs(contributing): document commit conventions
chore(hooks): update lint-staged rules
```

复杂变更可以在标题后增加正文，说明背景、实现和影响；涉及不兼容变更时，在正文或页脚注明：

```text
BREAKING CHANGE: change the application configuration field name
```

### 提交前检查

项目通过 Lefthook 自动执行以下检查：

- `commit-msg`：使用 Commitlint 校验提交格式。
- `pre-commit`：使用 lint-staged 校验暂存的 JSON 和 Shell 文件。
- `pre-push`：执行 `pnpm run check -- --all`。

依赖安装后会自动安装 Git hooks。需要手动重新安装时执行：

```bash
pnpm exec lefthook install
```

## 应用修改检查

- Manifest 字段与应用目录保持一致。
- 生命周期脚本通过 `bash -n` 检查。
- JSON 配置可以被解析。
- 构建产物和 `.DS_Store` 不提交。
- 应用与插件的面向用户文档只更新 `docs/` 下的统一文档页面，不再同步维护 `docs/apps/`、`docs/plugins/`、`apps/<appname>/README.md` 或 `plugins/<pluginname>/README.md`。

## 文档修改检查

```bash
pnpm run check -- --sdd --docs
git diff --check
```

应用和插件说明应统一维护在文档站中。配置较多时优先增加现有文档章节，只有在内容确实独立且篇幅较大时才拆分页面。

## Workspace 目录与测试布局

仓库中的六个可发布 TypeScript workspace（`plugins/*` 四个插件、`packages/*` 两个包）采用一致的约定：源码放在 workspace 自己的 `src/`，单元测试集中放在同级 `tests/`，并通过 `test:unit` 调用该 workspace 的 `vitest.config.ts`。新增测试应优先放入对应 workspace 的 `tests/`，按被测模块组织文件；不要把跨 workspace 的测试复制到根目录，也不要把测试混入 `apps/` 下的 fnOS 应用目录。

`tooling/fn-os-apps-cli` 也遵循同一 `tests/` + Vitest 布局，但它是仓库工具 workspace，不计入上述六个可发布包。`docs` 是 VitePress 文档 workspace，不承担 TypeScript 单元测试；应用目录是 fnOS 打包输入，主要通过 `pnpm run check -- --all`、脚本语法检查、JSON 校验和设备上的 `install-local` 验证，而不是强行引入 Vitest。

各 workspace 保留 `test` 作为 `test:unit` 的兼容别名，根目录通过 Turbo 执行 `pnpm test`/`pnpm test:unit`。只有确实需要构建前置产物的 workspace（例如 `packages/fnos-gateway`）才在 `pretest:unit` 中生成测试所需 bridge；新增前置步骤应说明原因并保持可重复执行。

## 类型定义集中策略

类型依赖采用 pnpm catalog 统一版本（根 `package.json` 的 `catalog`），而非在每个 workspace 随意锁定版本。各 workspace 的 `tsconfig.json` 只声明运行时确实需要的全局类型：Node workspace 使用 `node`，含 React/Client 代码的插件和包使用 `node`、`react`。新增类型包时先确认是否已在 catalog 中；优先复用根目录版本，并在对应 workspace 的 `tsconfig.json` 最小化 `compilerOptions.types`。共享业务类型应放在实际拥有它的 package 并通过公开入口导出，避免复制声明或依赖另一个 workspace 的内部路径。类型策略变更（新增全局类型、改变共享类型归属或 catalog 版本）须在 PR 描述中说明影响，并至少运行受影响 workspace 的 `typecheck` 和 `test:unit`。
