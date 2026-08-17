# 版本管理

根目录 `package.json` 维护项目当前版本，`bump` 脚本将版本同步到所有 `apps/*/manifest`，并更新 README 中的版本示例。

## 常用命令

```bash
# 任选一种
pnpm run bump:major
pnpm run bump:minor
pnpm run bump:patch

```

脚本默认会：

1. 计算目标版本。
2. 更新根 `package.json`。
3. 更新所有应用 Manifest。
4. 更新 README 中的 Release 和 Tag 示例。
5. 创建版本提交和 Git Tag。

## 仅修改文件

需要手动检查变更时，可以跳过自动提交和 Tag：

```bash
./bump patch --no-commit
```

只创建提交、不创建 Tag：

```bash
./bump patch --no-tag
```

执行 bump 前应确认工作区中没有需要保留但未提交的改动，因为脚本会自动提交版本文件。
