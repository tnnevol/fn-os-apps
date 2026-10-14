<AppIcon name="fn-focalboard" alt="Focalboard 图标" />

# Focalboard

## 应用简介

Focalboard 是开源的项目与任务管理看板工具，支持看板、表格与日历视图。

## 主要能力

- 看板、表格、日历等多种视图。
- 任务卡片支持属性、评论与附件。
- 可多用户协作或本地单人使用。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-focalboard` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开即可创建看板。

数据保存在应用数据目录的 `data` 子目录中。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 高级配置

本应用有一个**单文件挂载** `config.json`（应用数据目录下的 `data/data/config.json`，对应容器内 `/opt/focalboard/config.json`）。安装时 `cmd/install_callback` 会写入一份**最小可用配置**（`app/seed/`，本项目自行编写），内容为合法的 SQLite 后端配置，**无需改动即可使用**。

若需自定义服务端参数（端口、数据库、遥测开关等），请编辑该文件后重启应用。注意 `dbconfig` 与 `filespath` 使用的是**相对路径**，其解析基准由镜像决定（参见「遗留风险」说明，未在真机验证）。

## 相关链接

- [上游项目](https://github.com/mattermost/focalboard)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-focalboard)
