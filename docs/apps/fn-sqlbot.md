<AppIcon name="fn-sqlbot" alt="SQLBot 图标" />

# SQLBot

## 应用简介

SQLBot 是基于大模型的数据库问答工具，用自然语言查询数据库。

## 主要能力

- 自然语言生成并执行 SQL。
- 对话式探索数据。
- 提供 MCP 接口供 AI 客户端接入。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-sqlbot` |
| 目标平台 | x86 |
| 外部依赖 | 无（**数据库为容器内置**） |

## 安装与使用

安装时设置 Web 访问端口与 MCP 服务端口，并填写**管理员密码**（上游默认值是弱占位符，请自行填写）。安装完成后从应用中心打开。

**存储说明**：本应用使用**容器内置的 PostgreSQL**（上游注释为 all-in-one），数据库文件与上传/日志分别落在应用数据目录的 `postgresql` 与 `data/sqlbot` 子目录中，**因此不需要外部数据库**。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/dataease/SQLBot)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-sqlbot)
