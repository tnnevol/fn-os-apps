<AppIcon name="fn-maddy-mail" alt="Maddy Mail Server 图标" />

# Maddy Mail Server

## 应用简介

Maddy 是一体化邮件服务器，内置 SMTP 与 IMAP，无需额外组件。

## 主要能力

- 一体化 SMTP + IMAP 邮件服务。
- 无需额外组件即可收发信。
- 支持隐式 TLS 与提交端口。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-maddy-mail` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时填写**服务器主机名**（FQDN，如 `mail.example.com`，需与 DNS 的 MX/A 记录一致）、**邮件域名**，以及 SMTP / IMAP 各端口。

**本应用没有 Web 界面**（只提供 SMTP 与 IMAP 协议服务），因此**应用中心不提供桌面入口**，需用邮件客户端连接使用：

| 用途 | 端口 |
| --- | --- |
| SMTP（接收外部来信） | 25 |
| SMTPS（隐式 TLS） | 465 |
| 提交（客户端发信） | 587 |
| IMAP / IMAPS | 143 / 993 |

**25 端口常被运营商封禁**，如需对外收信请先确认已放行。

**存储说明**：上游使用 `external: true` 的外部命名卷，外部卷在 fnOS 上不会被自动创建，故改为绑定挂载到应用数据目录。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/foxcpp/maddy)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-maddy-mail)
