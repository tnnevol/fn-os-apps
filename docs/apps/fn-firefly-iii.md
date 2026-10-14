<AppIcon name="fn-firefly-iii" alt="Firefly III 图标" />

# Firefly III

## 应用简介

Firefly III 是自托管的个人财务管理工具，记录收支并生成报表。

## 主要能力

- 记账、预算与报表分析。
- 支持多账户与多币种。
- 提供 API 与导入工具。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-firefly-iii` |
| 目标平台 | x86 |
| 外部依赖 | **外部 MySQL / PostgreSQL 数据库** |

## 安装与使用

安装时设置 Web 访问端口，填写数据库连接信息（地址、端口、库名、用户名、密码分开填写）、**应用密钥**与可选的站点访问地址。

**数据库需用户自备**：安装时填写数据库连接信息。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**应用密钥**：32 位随机字符串，**安装后不要更改**，否则已保存的数据将无法解密。

数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/firefly-iii/firefly-iii)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-firefly-iii)
