<AppIcon name="fn-adminer" alt="Adminer 图标" />

# Adminer

## 应用简介

Adminer 是轻量级数据库管理工具，用单个 Web 界面管理多种数据库，无需在客户端安装额外软件。

## 主要能力

- 同时支持 MySQL、PostgreSQL、SQLite、MS SQL 等多种数据库。
- 执行 SQL 查询，浏览和编辑表结构与数据。
- 导入导出数据与数据库备份。
- 管理数据库用户和权限。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-adminer` |
| 目标平台 | x86 |
| 额外依赖 | 无（数据库由用户在登录页填写连接信息） |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开登录页，填写目标数据库的地址、账号和密码即可连接。应用自身不保存数据，请自行做好数据库的备份与访问控制。

## 相关链接

- [上游官网](https://www.adminer.org)
- [上游项目](https://github.com/vrana/adminer)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-adminer)
