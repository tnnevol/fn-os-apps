<AppIcon name="fn-discourse" alt="Discourse 图标" />

# Discourse

## 应用简介

Discourse 是现代论坛平台，支持实时讨论、插件与邮件集成。

## 主要能力

- 现代论坛的讨论与通知体系。
- 插件与主题扩展。
- 邮件集成与摘要。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-discourse` |
| 目标平台 | x86 |
| 外部依赖 | **外部 PostgreSQL + Redis** |

## 安装与使用

安装时设置 Web 访问端口，填写**论坛访问地址**、管理员账号/邮箱/密码、数据库连接信息与 **Redis 地址**。

**数据库需用户自备**：安装时填写数据库连接信息。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**访问地址**填域名或「IP:端口」（**不含协议前缀**）。

**多容器**：本应用包含论坛主服务 `fn-discourse` 与后台任务队列 `fn-discourse-sidekiq`（处理异步作业），两者都需要运行。

**已修正的上游缺陷**：上游把 SMTP 参数写成了测试占位值（`test` / `0`），会让注册验证与通知邮件静默失败，转换为已删除；如需邮件功能请在应用后台按实际 SMTP 参数配置。

数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/discourse/discourse)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-discourse)
