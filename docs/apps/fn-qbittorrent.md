<AppIcon name="fn-qbittorrent" alt="qBittorrent 图标" />

# qBittorrent

## 应用简介

qBittorrent 是功能完整的 BT 下载客户端，支持 Web 管理界面。

## 主要能力

- 功能完整的 BT/磁力下载。
- 内置 Web 管理界面。
- 支持 RSS 订阅与分类管理。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-qbittorrent` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口、**BT 监听端口**与容器时区。安装完成后从应用中心打开 Web 界面；**首次登录的临时密码会在容器日志中输出**，请及时查看并修改。

**BT 端口说明**：该端口为 TCP + UDP（非 HTTP，不建桌面入口）。**需在路由器上做端口映射**才能获得较好的连接性。

**权限说明**：上游以硬编码的 `PUID`/`PGID=1000` 运行。fnOS 上包用户的 UID 是动态分配的，固定 1000 会指向登录用户而非本应用包用户，故改为由 `TRIM_UID`/`TRIM_GID` 注入。

两个子目录：`data/config`（配置）与 `data/downloads`（下载内容）。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 高级配置

### 下载目录

`data/downloads` 对应容器内 `/downloads`。如需让下载内容落到目标 NAS 的其它位置，可在应用后台把默认保存路径改到该子目录下的位置。

## 相关链接

- [上游项目](https://github.com/linuxserver/docker-qbittorrent)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-qbittorrent)
