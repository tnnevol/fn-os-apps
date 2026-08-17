# 发布流程

## 发布新版本

在工作区干净且应用改动已完成后，执行版本升级：

```bash
pnpm run bump:patch
```

需要发布功能版本或大版本时，分别使用 `pnpm run bump:minor` 或 `pnpm run bump:major`。

脚本会创建类似下面的提交和 Tag：

```text
chore: bump version to v5.0.7
v5.0.7
```

## 推送并触发构建

```bash
git push origin main
git push origin v<版本号>
```

构建完成后，在 GitHub Release 页面检查：

- 每个应用是否都有对应 `.fpk`。
- 文件名中的版本是否与 Tag 一致。
- Release 是否包含正确的提交记录。

## 手动发布前检查

- 本地 `git diff --check` 通过。
- 目标应用可以通过 `fnpack build` 构建。
- Manifest 版本与根 `package.json` 一致。
- 应用 README、安装向导和文档没有遗留旧版本或旧路径。
