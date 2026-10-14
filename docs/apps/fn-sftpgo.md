<AppIcon name="fn-sftpgo" alt="SFTPGo 图标" />

# SFTPGo

## 应用简介

SFTPGo 是功能完整的文件传输服务，支持 SFTP、FTP、WebDAV 与网页管理。

## 主要能力

- 同时提供 SFTP、FTP、WebDAV 服务。
- 网页界面管理用户与权限。
- 支持多种存储后端。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-sftpgo` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，并按需调整 **SFTP / FTP / WebDAV 端口**与 **FTP 被动模式端口范围**（需在目标 NAS 上放行该区间）。若目标 NAS 位于 NAT 之后，再填写 **FTP 对外 IP**。安装完成后从应用中心打开管理界面。

**注意**：被动模式端口区间会在 compose 中以端口范围方式映射，**区间过大或与其它服务冲突都会导致启动失败**，请按实际需要设置。

数据与配置分别保存在应用数据目录的 `data/data`、`data/config` 子目录中。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/drakkan/sftpgo)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-sftpgo)
