# 仓库结构

```text
.
├── apps/                  # fnOS 应用源码与打包配置
├── plugins/               # Agent 插件 workspace
├── docs/                  # VitePress 文档源文件
├── .github/workflows/     # GitHub Actions 构建与发布流程
├── tooling/
│   └── fn-os-apps-cli/    # fn-apps-cli CLI：版本、构建和 Release 工具
├── turbo.json             # Turbo 任务依赖与缓存配置
├── package.json           # 统一任务入口、项目版本和 Node/pnpm 约束
├── README.md              # 项目简介
└── AGENTS.md              # 维护与开发约定
```

## 应用目录

每个 `apps/<appname>/` 目录通常包含：

| 路径 | 用途 |
| --- | --- |
| `manifest` | 应用名称、版本、平台和依赖 |
| `app/` | 应用运行文件、UI 和 Docker 配置 |
| `cmd/` | 安装、启动、停止、升级和卸载脚本 |
| `config/` | 权限、资源等 fnOS 配置 |
| `wizard/` | 安装、升级、配置和卸载向导 |
| `README.md` | 应用实现细节或历史维护说明，不作为面向用户文档的更新入口 |
| `ICON.PNG` | 应用图标 |

具体文件以应用类型和功能为准。新增文件时应保留 fnpack 模板要求的基础结构。

## Agent 插件目录

`plugins/*` 是 Agent 插件的 pnpm workspace。通用插件默认使用 `agent-plugin-<name>` 命名；面向特定生态的插件可以保留生态名称，例如 `@tnnevol/dsh-codex-auth`。每个子目录可以维护插件源码、构建配置、测试和 Cordis bundle patch。面向用户的插件说明统一维护在 `docs/`，不再以 `plugins/*/README.md` 作为更新入口。

### DSH 插槽注册注意事项

开发 DSH Client 插件时，必须先检查目标 Slot 的现有条目和优先级。列表插槽使用相同 `id` 时，不能再次使用相同 `priority`，否则会导致整个插件加载失败。特别注意：`conversation.composer.dock` 的内置会话步骤统计条目使用 `id: 'stats'`、`priority: 0`；如果插件要置换它，必须使用不同优先级（例如 `priority: -1`，较低优先级会生效），不能省略 `priority`。如果只是新增内容，应使用自有 `id`，不要占用 `stats`。

## 文档目录

应用与插件的面向用户文档统一维护在 `docs/`。后续不再维护 `docs/apps/`、`docs/plugins/`、`apps/*/README.md` 或 `plugins/*/README.md` 中的重复说明；这些现有文件保留作为历史或兼容参考。

新增或修改文档时，应根据内容放入统一文档站的应用说明、插件说明、需求、计划或开发指南页面，并同步检查 VitePress 链接和构建结果。
