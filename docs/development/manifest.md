# Manifest 配置

`apps/<appname>/manifest` 是 fnOS 应用的基础清单，使用对齐的 INI 风格键值格式。它描述应用身份、版本、平台、桌面入口和运行约束；应用目录、`app/ui/config`、`config/`、`wizard/` 和生命周期脚本必须与 Manifest 保持一致。

> 新建或重建应用前，先查阅 [`fnnas-docs` Skill](https://github.com/tnnevol/skills/tree/main/skills/fnnas-docs) 和飞牛应用开放平台文档。本文是本仓库的维护约定，不替代平台对字段的最新定义。

## 文件位置和格式

```text
apps/<appname>/
├── manifest
├── app/
├── cmd/
├── config/
└── wizard/
```

示例（字段之间使用空格对齐，不要改成 JSON）：

```ini
appname               = fn-memos
version               = 5.2.1
display_name          = Memos
desc                  = Memos 是一款轻量级、自托管的笔记工具。
platform              = x86
source                = thirdparty
maintainer            = Memos Team
maintainer_url        = https://usememos.com
distributor            = tnnevol
distributor_url        = https://github.com/tnnevol/fn-os-apps
os_min_version        = 1.1.8
desktop_uidir          = ui
desktop_applaunchname = fn-memos.main
service_port          = 5230
```

## 常用字段

| 字段 | 作用 | 维护要求 |
| --- | --- | --- |
| `appname` | 应用唯一标识 | 与应用目录名及相关入口 ID 保持一致 |
| `version` | 应用版本号 | 使用根 `fn-apps-cli version` 项目/FPK 流程维护 |
| `display_name` | 应用中心显示名称 | 面向用户，避免包含内部构建信息 |
| `desc` | 应用描述 | 说明用途和核心能力，不写无法验证的承诺 |
| `platform` | 目标架构 | 按实际 FPK 产物填写，例如 `x86`、`arm` 或 `all` |
| `source` | 应用来源 | 第三方应用通常使用 `thirdparty` |
| `maintainer` / `maintainer_url` | 原始项目维护者和地址 | 指向真实上游项目 |
| `distributor` / `distributor_url` | 当前分发者和仓库地址 | 与发布主体保持一致 |
| `os_min_version` | 最低 fnOS 版本 | 使用已验证的系统版本，不凭构建机版本推断 |
| `desktop_uidir` | 桌面入口资源目录 | 必须对应 `app/ui/` 下实际目录 |
| `desktop_applaunchname` | 桌面启动项 ID | 必须能在 `app/ui/config` 中找到对应键 |
| `service_port` | 服务监听端口 | 与应用启动脚本、向导字段和入口配置一致 |
| `install_dep_apps` | 安装前置依赖 | 只填写应用中心可提供且确实需要的依赖 |
| `micro_app` | 是否作为微应用运行 | 与入口类型和网关方案一起验证 |

其他字段（例如 `checkport`、`disable_authorization_path`、`changelog`）应只在应用确实需要时增加，并以平台文档和同类已验证应用为准。

## 与其他配置的对应关系

| Manifest | 对应文件 | 需要保持一致的内容 |
| --- | --- | --- |
| `desktop_uidir` | `app/ui/` | UI 目录存在且包含入口资源 |
| `desktop_applaunchname` | `app/ui/config` | `.url` 下存在同名入口 |
| `service_port` | `cmd/main`、`wizard/*` | 服务监听端口和用户配置来源一致 |
| `install_dep_apps` | `config/`、安装回调 | 依赖确实由 fnOS 管理或已声明 |
| `os_min_version` | 测试记录 | 在最低版本设备上完成基础验证 |
| `version` | 发布 Tag、FPK | FPK、升级说明和仓库版本保持一致 |

## 版本管理

项目/FPK 版本和插件版本分开维护。Manifest 属于项目/FPK 版本范围时使用：

```bash
pnpm run version -- project patch
pnpm run version -- project minor
```

只维护某个 Harness 插件时，不要让插件版本流程隐式修改应用 Manifest：

```bash
pnpm run version -- plugin fnos patch
```

需要只修改文件、不创建提交和 Tag 时追加 `--no-commit --no-tag`。版本变更前后都要检查对应的升级兼容和回滚说明。

## 修改后的验证

```bash
# 检查 Manifest 与目录、入口和资源
pnpm run check -- --all

# 构建单个应用
cd apps/<appname>
fnpack build
```

提交前至少确认：

- `appname`、应用目录名、桌面入口 ID 没有拼写漂移。
- `version` 是合法版本号，并符合项目或 FPK 的版本策略。
- `platform` 与实际构建架构一致。
- `desktop_uidir`、`desktop_applaunchname` 和入口文件真实存在。
- 端口、网关前缀、授权路径和健康检查配置能串联工作。
- 不把密钥、个人路径、临时构建信息或未经验证的版本写入 Manifest。

最终应在测试 NAS 上通过应用中心完成安装、启动、停止、升级和卸载验证；本地 `fnpack build` 只证明清单和包结构可以构建。

相关页面：

- [开发环境与脚本](./environment-and-scripts)
- [生命周期脚本](./lifecycle)
- [权限与入口](./permissions)
- [用户向导](./wizard)
- [Package 任务与 Turbo](./package-tasks-and-turbo)
