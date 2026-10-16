<AppIcon name="fn-teamspeak" alt="TeamSpeak Server 图标" />

# TeamSpeak Server

## 应用简介

TeamSpeak 是低延迟语音通讯服务器，广泛用于游戏与团队协作。

## 主要能力

- 低延迟语音通讯。
- 多频道与权限体系。
- 文件传输与图标管理。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-teamspeak` |
| 目标平台 | x86 |
| 外部依赖 | **外部 MariaDB/MySQL 或 PostgreSQL** |

## 安装与使用

安装时填写数据库连接信息（类型、地址、端口、库名、用户名、密码分开填写），以及语音、Server Query 与文件传输端口。

**数据库类型**：`MariaDB / MySQL` 与 `PostgreSQL` 两项（MariaDB 与 MySQL 共用同一驱动插件）。**连接失败时服务无法启动。**

**本应用没有 Web 界面**，因此**应用中心不提供桌面入口**，需用 TeamSpeak 客户端连接：

| 端口 | 用途 |
| --- | --- |
| 9987/UDP | 语音通讯（**客户端必需**） |
| 10011 | Server Query 远程管理 |
| 30033 | 文件传输 |

**安全提示**：Server Query 端口（10011）可用于管理服务器，**不需要时请用防火墙限制来源**。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/TeamSpeak-Systems/teamspeak-linux-docker-images)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-teamspeak)
