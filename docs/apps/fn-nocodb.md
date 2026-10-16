<AppIcon name="fn-nocodb" alt="NocoDB 图标" />

# NocoDB

## 应用简介

NocoDB 把关系型数据库转换为智能表格，提供类 Airtable 的协作界面。

## 主要能力

- 把数据库表转为智能表格。
- 多人协作与视图管理。
- 表单、看板与画廊视图。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-nocodb` |
| 目标平台 | x86 |
| 外部依赖 | **外部 PostgreSQL** |

## 安装与使用

安装时设置 Web 访问端口，填写数据库连接信息。

**数据库需用户自备**：安装时填写数据库连接信息。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**注意**：本应用使用 **PostgreSQL**，且数据库连接需按「地址:端口/库名」格式填写（应用会把整段拼进连接串）。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/nocodb/nocodb)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-nocodb)
