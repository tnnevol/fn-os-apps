# 版本管理

版本命令由根目录 `fn-apps-cli` CLI 暴露，实现在 `tooling/fn-os-apps-cli` workspace。项目/FPK 版本通过 [`bumpp`](https://github.com/antfu-collective/bumpp) 管理；插件版本由 CLI 直接更新并提交。项目/FPK 版本与插件版本是相互独立的两套发布流程，插件不会被项目版本命令隐式修改。

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

插件版本可选择单个插件，或在交互提示中复选多个插件；脚本把所选插件的 `package.json` 更新到同一目标版本，并检查 `apps/fn-deepseek-harness/app/published-dsh-plugins.json`，将其中同名插件的 `version` 一并同步。插件版本更新不调用 `bumpp`，多选时直接创建一条合并提交，不创建插件 Git Tag：

```bash
# 直接指定单个插件
pnpm run version -- plugin codex patch
pnpm run version -- plugin fnos patch
pnpm run version -- plugin showcase patch

# 交互选择（插件列表为复选框，可多选，再选择版本类型）
pnpm run version -- plugin
```

插件列表由 CLI 动态扫描 `plugins/` 目录发现，新增插件无需改动 CLI。每个插件的别名为包名去掉 `dsh-` 前缀后的部分（如 `@tnnevol/dsh-fnos` → `fnos`、`@tnnevol/dsh-codebuddy` → `codebuddy`），也可直接使用完整包名。历史简称 `codex`、`showcase` 仍保留兼容。

插件版本命令不会修改根项目、共享包、FPK Manifest 或未选中的插件；默认只创建版本提交，不创建 Git Tag。使用 `--no-commit` 可只执行文件更新；`--no-tag` 对插件版本命令保持兼容但无额外作用。脚本默认不会自动 push，推送由发布者确认后执行。

## 发布检查

1. 确认工作区没有需要保留的未提交改动。
2. 根据发布目标选择 `version -- project` 或 `version -- plugin`（插件可复选）。
3. 检查版本文件和提交。
4. 推送提交，触发对应的 CI/发布流程。
5. 插件发布前运行对应插件的 `check`，再使用 `pnpm run publish` 发布当前 `rc` dist-tag。
