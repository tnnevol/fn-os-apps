# 发布流程

## 发布新版本

在工作区干净且应用改动已完成后，使用根目录的 `fn-apps-cli` CLI 执行项目版本升级：

```bash
pnpm run version -- project patch
```

需要发布功能版本或大版本时，分别使用 `pnpm run version -- project minor` 或 `pnpm run version -- project major`。插件发布必须单独指定插件：

```bash
pnpm run version -- plugin fnos patch
```

脚本会创建类似下面的提交和 Tag：

```text
chore: release v5.0.7
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
- 项目/FPK 版本命令涉及的 Manifest 与目标项目版本一致；独立维护版本的应用和插件不要求与根 `package.json` 相同。
- 应用 README、安装向导和文档没有遗留旧版本或旧路径。
