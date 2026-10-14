<AppIcon name="fn-miniflux" alt="Miniflux 图标" />

# Miniflux

## 应用简介

Miniflux 是极简的 RSS 阅读器，专注阅读体验与低资源占用。

## 主要能力

- 极简的 RSS/Atom 阅读体验。
- 低资源占用。
- 支持 Fever 与 Google Reader API。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-miniflux` |
| 目标平台 | x86 |
| 外部依赖 | **外部 PostgreSQL 数据库** |

## 安装与使用

安装时设置 Web 访问端口，填写**管理员用户名/密码**与数据库连接信息。

**数据库需用户自备**：安装时填写数据库连接信息。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**管理员账号**在首次启动时创建（仅在数据库为空时生效）。上游为管理员密码与数据库密码都提供了弱占位默认值，转换后已改为**留空并必填**，请自行设置强口令。

**本应用无状态挂载**：应用数据全部保存在你所提供的数据库中，容器不保存文件。

## 相关链接

- [上游项目](https://github.com/miniflux/v2)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-miniflux)
