<AppIcon name="fn-manticoresearch" alt="Manticore Search 图标" />

# Manticore Search

## 应用简介

Manticore Search 是高性能全文搜索引擎，兼容 Sphinx 并支持 SQL 查询。

## 主要能力

- 高性能全文检索。
- 支持 SQL 与 HTTP 两种查询接口。
- 兼容 Sphinx 的配置与 API。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-manticoresearch` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 **HTTP 接口端口**（用于 HTTP 查询与管理界面）与 **SQL 接口端口**（MySQL 兼容协议，非 HTTP，不建桌面入口）。

**配置说明**：本应用有一个**单文件挂载** `data/manticore.conf`（对应容器内 `/etc/manticoresearch/manticore.conf`），安装时 `cmd/install_callback` 会写入一份**最小可用配置**（`app/seed/`，本项目自行编写）。如需调整监听地址、日志路径等，编辑该文件后重启应用。

索引数据保存在应用数据目录的 `data/data` 子目录中。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/manticoresoftware/manticoresearch)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-manticoresearch)
