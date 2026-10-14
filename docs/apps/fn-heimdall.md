<AppIcon name="fn-heimdall" alt="Heimdall 图标" />

# Heimdall

## 应用简介

Heimdall 是应用仪表盘，把常用服务入口集中整理到一个页面。

## 主要能力

- 集中整理常用服务入口。
- 按分类组织应用卡片。
- 支持自定义图标与链接。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-heimdall` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口、HTTPS 端口与容器时区。

**HTTPS 端口需要证书才能使用**（证书自备）。

**权限说明**：上游以硬编码的 `PUID`/`PGID=1000` 运行。fnOS 上包用户的 UID 是动态分配的，固定 1000 会指向登录用户而非本应用包用户，故改为由 `TRIM_UID`/`TRIM_GID` 注入。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/linuxserver/Heimdall)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-heimdall)
