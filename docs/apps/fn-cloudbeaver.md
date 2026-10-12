<AppIcon name="fn-cloudbeaver" alt="CloudBeaver 图标" />

# CloudBeaver

## 应用简介

CloudBeaver 是基于浏览器的数据库管理器，可统一连接和管理多种数据库。

## 主要能力

- 通过浏览器管理多种数据库。
- SQL 编辑器、结果集查看与导出。
- 支持连接配置的集中保存与共享。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-cloudbeaver` |
| 目标平台 | x86 |
| 额外依赖 | 无（被管理的数据库由用户自行提供） |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开并完成初始化。本应用自身不包含数据库实例，需在界面中填入要连接的目标数据库信息。连接配置与工作区数据保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/dbeaver/cloudbeaver)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-cloudbeaver)
