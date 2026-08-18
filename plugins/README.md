# Agent 插件工作空间

这里维护通用 Agent 生态的第三方插件，包括 DeepSeek Harness 等 Agent 应用的适配插件。每个插件独立为一个 pnpm workspace package。

通用 Agent 插件统一使用 `agent-plugin-<name>` 命名，例如：

```text
plugins/
└── agent-plugin-<name>/
    ├── package.json
    ├── src/
    ├── cordis.patch.yml
    └── ...
```

面向特定 Agent 生态的插件可以保留生态约定的独立名称，例如 DSH 插件
`@tnnevol/dsh-codex-auth`，不强制追加 `agent-plugin-` 前缀。

## 新增插件

在仓库根目录执行：

```bash
mkdir -p plugins/agent-plugin-<name>
cd plugins/agent-plugin-<name>
pnpm init
```

插件包通常需要具备以下内容：

- ESM 模块和可发布的构建产物；
- `dsh.bundle.patch` 声明及对应的 `cordis.patch.yml`；
- 与目标 `@deepseek-ai/dsh` 版本匹配的 peer dependency；
- 构建、测试和打包脚本。

建议发布已经构建完成的 npm 包或 tarball，避免在用户的 NAS 上从 TypeScript 源码构建。面向 DeepSeek Harness 的插件需要在 DSH 的 `profiles/web` 中安装，并加入 `dsh.profile.bundles` 后才会加载。

## 常用命令

```bash
# 查看工作空间中的插件
pnpm -r --filter './plugins/*' list

# 构建指定插件
pnpm --filter <plugin-package-name> run build

# 测试指定插件
pnpm --filter <plugin-package-name> test

# 打包指定插件
pnpm --filter <plugin-package-name> pack
```

插件源码、构建产物和运行时依赖均应保持在本工作空间内；上游项目仅作为参考，不在本仓库中直接修改。
