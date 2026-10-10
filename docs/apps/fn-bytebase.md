<AppIcon name="fn-bytebase" alt="Bytebase 图标" />

# Bytebase

## 应用简介

Bytebase 是开源数据库 DevOps 解决方案，面向团队提供数据库变更管理与权限控制。

## 主要能力

- 数据库 Schema 变更与版本管理。
- SQL 审核、回滚与审计日志。
- 基于角色的访问控制，支持多种数据库。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-bytebase` |
| 目标平台 | x86 |
| 额外依赖 | 无（被管理的数据库由用户自行提供） |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开并完成初始化。本应用自身不包含数据库实例，需在界面中填入要管理的目标数据库连接信息。元数据与变更记录保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/bytebase/bytebase)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-bytebase)
