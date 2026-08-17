# 参与贡献

## 修改流程

1. 从 `main` 创建分支。
2. 修改对应应用或文档。
3. 运行与改动相关的校验。
4. 使用 Conventional Commits 创建提交。
5. 推送分支并提交 Pull Request。

## 应用修改检查

- Manifest 字段与应用目录保持一致。
- 生命周期脚本通过 `bash -n` 检查。
- JSON 配置可以被解析。
- 构建产物和 `.DS_Store` 不提交。
- 需要时同步更新 `apps/<appname>/README.md` 和 `docs/apps/<appname>.md`。

## 文档修改检查

```bash
pnpm run docs:build
git diff --check
```

应用介绍页应保持简洁。配置较多时优先增加章节，只有在内容确实独立且篇幅较大时才拆分页面。
