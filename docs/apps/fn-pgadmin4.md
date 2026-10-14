<AppIcon name="fn-pgadmin4" alt="pgAdmin 4 图标" />

# pgAdmin 4

## 应用简介

pgAdmin 是 PostgreSQL 的图形化管理工具，通过浏览器管理数据库对象与执行 SQL。

## 主要能力

- 图形化浏览表、视图与函数。
- SQL 查询编辑器与结果导出。
- 支持连接多台 PostgreSQL 实例。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-pgadmin4` |
| 目标平台 | x86 |
| 额外依赖 | 无（被管理的数据库由用户自行提供） |

## 安装与使用

安装时设置 Web 访问端口，并填写**登录邮箱与密码**（上游默认密码由平台随机生成，请自行设置并妥善保管）。安装完成后从应用中心打开，添加要管理的 PostgreSQL 连接。连接配置与设置保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/pgadmin-org/pgadmin4)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-pgadmin4)
