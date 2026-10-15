<AppIcon name="fn-stalwart-mail" alt="Stalwart Mail Server 图标" />

# Stalwart Mail Server

## 应用简介

Stalwart 是现代化的一体化邮件服务器，支持 SMTP、IMAP、POP3 与 JMAP。

## 主要能力

- 一体化 SMTP / IMAP / POP3 邮件服务。
- 内置 JMAP 与 ManageSieve 支持。
- Web 管理界面。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-stalwart-mail` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口、HTTPS 端口，以及 SMTP、提交、IMAP、POP3、ManageSieve 各端口。安装完成后从应用中心打开 Web 界面完成初始化配置。

**端口分工**：只有 **8080（HTTP 管理界面）** 与 **443（HTTPS）** 会创建桌面入口；其余 8 个（SMTP 25/587/465、IMAP 143/993、POP3 110/995、ManageSieve 4190）是邮件协议端口，**只提供端口配置、不建桌面入口**。

**25 端口常被运营商封禁**，对外收信请先确认放行；**HTTPS 端口需要证书**（在应用内申请或导入）。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/stalwartlabs/stalwart)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-stalwart-mail)
