# 版本管理

版本命令由根目录 `fn-apps-cli` CLI 暴露，实现在 `tooling/fn-os-apps-cli` workspace，通过根目录的 `fn-apps-cli` CLI 调用 [`bumpp`](https://github.com/antfu-collective/bumpp) 管理版本文件。项目/FPK 版本与插件版本是相互独立的两套发布流程，插件不会被项目版本命令隐式修改。

## 项目与 FPK 版本

项目版本命令更新根 `package.json`、`packages/*/package.json`、与当前项目版本匹配的 `apps/*/manifest` 和 README 版本引用，并创建项目 Tag：

```bash
pnpm run version -- project patch
pnpm run version -- project minor
pnpm run version -- project 5.3.0
```

默认生成 `chore: release v<版本号>` 提交和 `v<版本号>` Tag。应用 Manifest 中已有独立版本的文件会由 `bumpp` 跳过，不会被强行覆盖。

仅修改文件时使用：

```bash
pnpm run version -- project patch --no-commit --no-tag
```

## 插件版本

插件版本必须指定一个目标插件，脚本只更新该插件的 `package.json`，并使用插件专属提交和 Tag：

```bash
pnpm run version -- plugin codex patch
pnpm run version -- plugin fnos patch
pnpm run version -- plugin showcase patch
```

支持的插件别名为 `codex`、`fnos` 和 `showcase`，也可使用对应的 DSH 插件名。插件 Tag 格式为 `plugin/<插件名>-v<版本号>`。

插件版本命令不会修改根项目、共享包、FPK Manifest 或其他插件。使用 `--no-commit`、`--no-tag` 可只执行文件更新；脚本默认不会自动 push，推送由发布者确认后执行。

## 发布检查

1. 确认工作区没有需要保留的未提交改动。
2. 根据发布目标选择 `version -- project` 或 `version -- plugin <name>`。
3. 检查版本文件、提交和 Tag。
4. 推送提交和 Tag，触发对应的 CI/发布流程。
5. 插件发布前运行对应插件的 `check`，再使用 `pnpm run publish` 发布当前 `rc` dist-tag。
