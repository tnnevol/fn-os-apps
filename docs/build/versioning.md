# 版本管理

版本命令由根目录 `fn-apps-cli` CLI 暴露，实现在 `tooling/fn-os-apps-cli` workspace，通过 [`bumpp`](https://github.com/antfu-collective/bumpp) 管理项目/FPK 版本。

## 项目与 FPK 版本

项目版本命令更新根 `package.json`、文档包 `docs/package.json`、应用 `manifest` 和文档里的版本示例，并创建项目 Tag。文档站点的版本徽标从文档包自身的 `package.json` 读取：

```bash
pnpm run version -- patch
pnpm run version -- minor
pnpm run version -- 5.3.0
```

默认生成 `chore: release v<版本号>` 提交和 `v<版本号>` Tag。文档 Manifest 示例和文档包版本会先与根项目对齐，再由版本流程统一更新。

仅修改文件时使用：

```bash
pnpm run version -- patch --no-commit --no-tag
```

## 发布检查

1. 确认工作区没有需要保留的未提交改动。
2. 执行版本命令，指定发布类型或版本号。
3. 检查版本文件和提交。
4. 推送提交，触发对应的 CI/发布流程。
