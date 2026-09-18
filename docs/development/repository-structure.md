# 仓库结构

```text
.
├── apps/                  # fnOS 应用源码与打包配置
├── docs/                  # VitePress 文档源文件与文档 workspace 包
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

## 文档目录

面向用户的文档统一维护在 `docs/`，不再在 `apps/*/README.md` 重复维护说明。

新增或修改文档时，应根据内容放入统一文档站的应用说明、需求、计划或开发指南页面，并同步检查 VitePress 链接和构建结果。
