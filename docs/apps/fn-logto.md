<AppIcon name="fn-logto" alt="Logto 图标" />

# Logto

## 应用简介

Logto 是面向开发者的身份认证服务，提供 OIDC 登录、用户管理与多租户。

## 主要能力

- OIDC 登录与用户管理。
- 多租户与组织支持。
- 管理控制台与 API。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-logto` |
| 目标平台 | x86 |
| 外部依赖 | **外部 PostgreSQL 数据库** |

## 安装与使用

安装时设置 Web 访问端口与控制台端口，填写**认证端点地址**、**控制台端点地址**以及数据库连接信息。

**端点地址很关键**：填错会导致登录回调失败。例如 `https://logto.example.com` 与 `https://admin.example.com`（或对应的 IP 地址形式）。

**数据库需用户自备**：安装时填写数据库连接信息。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**注意**：本应用使用 **PostgreSQL**。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/logto-io/logto)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-logto)
