<AppIcon name="fn-cloudreve" alt="Cloudreve 图标" />

# Cloudreve

## 应用简介

Cloudreve 是自托管的网盘系统，支持多种存储策略与离线下载。

## 主要能力

- 多存储策略的网盘服务。
- 支持 WebDAV 与离线下载。
- 用户组与分享管理。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-cloudreve` |
| 目标平台 | x86 |
| 外部依赖 | **外部数据库 + Redis** |

## 安装与使用

安装时设置 Web 访问端口，填写数据库连接信息与 **Redis 地址**（端口固定 6379）。

**数据库需用户自备**：安装时填写数据库连接信息。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**Redis 说明**：本应用把 Redis 拆成「地址」与「密码」两个配置项消费，因此向导提供的是地址而非连接串。该应用依赖 fnOS 提供的 Redis，安装时会自动安装依赖应用（`install_dep_apps`）。**Redis 连接失败时应用仍会启动，但缓存与会话功能异常。**

数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/cloudreve/Cloudreve)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-cloudreve)
