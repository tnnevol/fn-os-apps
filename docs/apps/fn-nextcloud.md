<AppIcon name="fn-nextcloud" alt="Nextcloud 图标" />

# Nextcloud

## 应用简介

Nextcloud 是自托管的网盘与协作平台，提供文件同步、共享、日历与在线协作。

## 主要能力

- 文件同步与共享，支持多端客户端。
- 日历、联系人与任务。
- 可安装应用扩展功能。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-nextcloud` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置访问端口与容器时区，安装完成后从应用中心打开并创建管理员账号。

配置与用户数据分别保存在应用数据目录的 `config`、`data` 子目录中。**用户数据会持续增长，请预留足够存储空间。** 数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 高级配置

### 关于访问协议

上游使用 `PANEL_APP_PORT_HTTPS` 映射到容器的 443 端口，因此本应用的桌面入口协议为 **`https`**。**证书需用户自备**（例如通过反向代理或自行配置 TLS）；若直接用 `https://` 访问且未配置证书，浏览器会提示证书不受信任，此时可临时改用其他方式访问或在反向代理上终结 TLS。

### 用户与权限

上游以 `PUID`/`PGID` 控制文件属主。fnOS 上本应用改为以**本应用的包用户**运行（通过 `TRIM_UID`/`TRIM_GID` 传入），用户数据目录归属该包用户。

## 相关链接

- [上游项目](https://github.com/nextcloud/server)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-nextcloud)
