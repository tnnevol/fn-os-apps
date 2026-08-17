# 仓库结构

```text
.
├── apps/                  # fnOS 应用源码与打包配置
├── docs/                  # VitePress 文档源文件
├── .github/workflows/     # GitHub Actions 构建与发布流程
├── bump                   # 版本升级、提交和 Tag 脚本
├── package.json           # 项目版本、Node/pnpm 约束和 npm scripts
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
| `README.md` | 应用实现细节或维护说明 |
| `ICON.PNG` | 应用图标 |

具体文件以应用类型和功能为准。新增文件时应保留 fnpack 模板要求的基础结构。

## 文档目录

应用文档统一放在 `docs/apps/`，每个应用使用一个 Markdown 文件。应用配置较多时，优先增加文内章节，而不是立即拆分侧边栏菜单。
