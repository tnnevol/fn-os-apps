# CI 构建

GitHub Actions 配置位于 `.github/workflows/build-release.yml`，由版本 Tag 触发。

## 构建流程

1. 扫描 `apps/`，发现包含 `manifest` 的应用。
2. 下载并验证 `fnpack`。
3. 通过根 `build` 任务的 FPK 模式为每个应用并行执行编译：`pnpm exec fnos-apps build --fpk --app <appname>`。
4. 将产物重命名为 `<appname>-<tag>.fpk`。
5. 上传构建产物并由根 `release:notes` 任务调用 `changelogithub` 生成 GitHub Release。

## 触发方式

```bash
pnpm run version -- project patch
git push origin main
git push origin v<版本号>
```

推送 `v*` Tag 后，Actions 会自动开始构建。构建失败时，优先查看对应矩阵应用的 `Build FPK` 步骤和 fnpack 输出。

## 新增应用检查

新增应用需要确保：

- `apps/<appname>/manifest` 存在且字段完整。
- 应用目录不依赖本地未提交文件。
- 生命周期脚本具有正确的执行权限。
- 所有构建依赖都能在 GitHub Actions 环境中获取。
