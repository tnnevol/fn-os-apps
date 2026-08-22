# 参与贡献

## 修改流程

1. 从 `main` 创建分支。
2. 按 [SDD 维护规范](/guide/sdd-workflow) 判断是否需要更新需求和计划。
3. 修改对应应用、插件或文档。
4. 运行与改动相关的校验，包括 `pnpm run check:sdd`。
5. 使用 Conventional Commits 创建提交。
6. 推送分支并提交 Pull Request，填写仓库 PR 检查清单。

## 应用修改检查

- Manifest 字段与应用目录保持一致。
- 生命周期脚本通过 `bash -n` 检查。
- JSON 配置可以被解析。
- 构建产物和 `.DS_Store` 不提交。
- 应用与插件的面向用户文档只更新 `docs/` 下的统一文档页面，不再同步维护 `docs/apps/`、`docs/plugins/`、`apps/<appname>/README.md` 或 `plugins/<pluginname>/README.md`。

## 文档修改检查

```bash
pnpm run check:sdd
pnpm run docs:build
git diff --check
```

应用和插件说明应统一维护在文档站中。配置较多时优先增加现有文档章节，只有在内容确实独立且篇幅较大时才拆分页面。
