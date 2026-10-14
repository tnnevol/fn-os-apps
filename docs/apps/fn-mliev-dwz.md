<AppIcon name="fn-mliev-dwz" alt="DWZ 图标" />

# DWZ

## 应用简介

DWZ 是短链接服务，支持自定义短码与访问统计。

## 主要能力

- 短链接生成与自定义短码。
- 访问统计。
- 多域名支持。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-mliev-dwz` |
| 目标平台 | x86 |
| 外部依赖 | **外部 PostgreSQL / MySQL / MariaDB + Redis** |

## 安装与使用

安装时设置 Web 访问端口与容器时区，填写数据库连接信息、**Redis 地址**与 **Redis 逻辑库编号**。

**数据库需用户自备**：安装时填写数据库连接信息。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**Redis 说明**：本应用把 Redis 拆成「地址」「密码」「逻辑库编号」分别消费，因此向导提供的是这些独立字段而非连接串。**逻辑库编号**取 0—15，多个应用共用同一 Redis 时用不同编号可避免键冲突。应用依赖 fnOS 提供的 Redis，安装时会自动安装依赖应用。

数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/mliev/dwz)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-mliev-dwz)
