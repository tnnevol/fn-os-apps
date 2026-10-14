<AppIcon name="fn-cordys-crm" alt="Cordys CRM 图标" />

# Cordys CRM

## 应用简介

Cordys CRM 是开源的客户关系管理系统，提供线索、商机与客户管理。

## 主要能力

- 线索、商机与客户全流程管理。
- 销售漏斗与业绩统计。
- 提供 MCP 接口供 AI 客户端接入。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-cordys-crm` |
| 目标平台 | x86 |
| 外部依赖 | **外部 MySQL 数据库** |

## 安装与使用

安装时设置 Web 访问端口与 MCP 服务端口，并填写数据库连接信息。

数据库需用户自备：安装时填写**数据库连接**（格式「地址:端口/数据库名」）、数据库名、用户名与密码。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**转换说明（重要）**：上游编排把数据库地址写成**指向容器自身**（`jdbc:mysql://${CONTAINER_NAME}:3306/...`），但其 compose **不包含任何 MySQL 服务**——在 1Panel 下这是依赖平台另行提供的数据库。转换到 fnOS 后该依赖不再被自动满足，**因此本应用改为由你显式填写外部 MySQL 的地址**。**若未提供可用的 MySQL，应用会启动失败或持续报错。**

数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/1Panel-dev/CordysCRM)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-cordys-crm)
