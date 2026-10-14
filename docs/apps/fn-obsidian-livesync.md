<AppIcon name="fn-obsidian-livesync" alt="Obsidian LiveSync 图标" />

# Obsidian LiveSync

## 应用简介

Obsidian LiveSync 基于 CouchDB 提供 Obsidian 笔记的实时同步服务，可自托管。

## 主要能力

- 为 Obsidian 提供自托管同步后端。
- 基于 CouchDB，支持双向实时同步。
- 数据完全由自己掌握。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-obsidian-livesync` |
| 目标平台 | x86 |
| 额外依赖 | 无（客户端需在 Obsidian 中安装 LiveSync 插件） |

## 安装与使用

安装时设置 Web 访问端口，并填写**数据库管理员用户名与密码**（上游默认密码是弱占位符，请自行设置）。这两个账号同时用于 Obsidian 插件侧的连接配置。

数据库数据保存在应用数据目录的 `data` 子目录中。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 高级配置

本应用有一个**单文件挂载** `local.ini`（应用数据目录下的 `data/conf/local.ini`，对应容器内 `/opt/couchdb/etc/local.ini`）。安装时 `cmd/install_callback` 会写入一份**最小可用配置**（`app/seed/`，本项目自行编写）。

**其中 `require_valid_user = true` 是必要的安全设置**：缺少它会让未认证请求也能访问 CouchDB 的公开端点。本应用的种子配置已保留该设置（`[chttpd]` 与 `[chttpd_auth]` 两处）以及同步所需的 CORS 设置，**请勿删除**。管理员账号通过环境变量注入，无需在文件中重复填写。

若需调整其他 CouchDB 参数，请编辑该文件后重启应用。

## 相关链接

- [上游项目](https://github.com/vrtmrz/obsidian-livesync)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-obsidian-livesync)
