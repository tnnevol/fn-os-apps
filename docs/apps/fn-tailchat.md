<AppIcon name="fn-tailchat" alt="Tailchat 图标" />

# Tailchat

## 应用简介

Tailchat 是插件化的即时通讯平台，支持多群组、机器人与应用扩展。

## 主要能力

- 群组、频道与私信。
- 插件与机器人扩展。
- 独立的管理面板。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-tailchat` |
| 目标平台 | x86 |
| 外部依赖 | **外部 Redis + MongoDB + MinIO** |

## 安装与使用

安装时设置 Web 访问端口与管理面板端口，并填写三个外部服务的连接信息：

- **Redis**：地址与密码。安装时会自动安装飞牛应用中心的 Redis 依赖。
- **MongoDB**：地址、端口、数据库名与管理员凭据。**需你自行准备。**
- **MinIO**：地址、API 端口（9000）、控制台端口（9001）与访问密钥。**需你自行准备。**

**已修正的上游缺陷**：上游把「数据库主机」变量当作 Redis 地址使用，而向导里根本没有 Redis 地址字段——即**你选的是数据库主机、实际却连了 Redis**。已拆分为独立的 Redis 地址字段。

**连接失败的表现**：Redis 不可用时消息与在线状态异常；MongoDB 不可用时无法登录；MinIO 不可用时无法上传文件。

**多容器**：本应用包含主服务 `fn-tailchat` 与管理面板 `fn-tailchat-admin`，两者都需要运行。

## 相关链接

- [上游项目](https://github.com/msgbyte/tailchat)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-tailchat)
