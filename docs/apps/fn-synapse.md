<AppIcon name="fn-synapse" alt="Synapse 图标" />

# Synapse

## 应用简介

Synapse 是 Matrix 协议的参考实现，用于搭建自有的即时通讯服务器。

## 主要能力

- 搭建自有 Matrix 即时通讯服务。
- 支持端到端加密房间与联邦。
- 提供标准 Matrix 客户端 API。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-synapse` |
| 目标平台 | x86 |
| 额外依赖 | 无（客户端需自行选择 Matrix 客户端） |

## 安装与使用

安装时设置 Web 访问端口与容器时区。**首次启动前需生成配置文件**：进入容器执行 `python -m synapse.app.homeserver --server-name <域名> --config-path /data/homeserver.yaml --generate-config --report-stats=no`，完成后重启应用。房间数据库与配置保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

容器以本应用的包用户身份运行（通过 `TRIM_UID`/`TRIM_GID` 传入）。上游使用的 Docker 命名卷已改为绑定挂载到应用数据目录。

## 相关链接

- [上游项目](https://github.com/element-hq/synapse)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-synapse)
