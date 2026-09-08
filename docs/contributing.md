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
