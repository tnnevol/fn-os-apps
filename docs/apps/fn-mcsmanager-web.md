<AppIcon name="fn-mcsmanager-web" alt="MCSManager 图标" />

# MCSManager

## 应用简介

MCSManager 是 Minecraft 等游戏服务器的管理面板，支持多实例与权限分配。

## 主要能力

- 多实例游戏服务器管理。
- 启停、控制台与文件管理。
- 用户与权限分配。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-mcsmanager-web` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开并按提示创建管理员账号。

**本应用只是管理面板（Web 端）**，游戏服务端实例需在面板中自行创建。

**已修正的上游缺陷**：上游挂载了宿主机的 `/etc/localtime` 时区文件（只读），在 fnOS 上该宿主路径不可依赖，已删除该行。

**运行身份**：本应用以目标 NAS 的包用户（非 root）运行。

数据与日志分别在应用数据目录的 `data/web/data` 与 `data/web/logs`。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/MCSManager/MCSManager)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-mcsmanager-web)
