<AppIcon name="fn-gotify" alt="Gotify 图标" />

# Gotify

## 应用简介

Gotify 是自托管的消息推送服务，提供 Web 界面与 API，用于接收应用和脚本发送的通知。

## 主要能力

- 通过 HTTP API 发送消息到自己的服务器。
- Web 界面与移动客户端接收通知。
- 支持应用级 Token 与用户管理。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-gotify` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，并填写默认管理员账号密码。安装完成后从应用中心打开，登录后创建应用即可获得推送 Token。

## 高级配置

上游共有约 29 个可配置项，本应用只把安装时必需的项放进向导；以下高级项**未提供向导字段**，容器会使用镜像默认值：

- 服务端：`GOTIFY_SERVER_PORT`、`GOTIFY_SERVER_LISTENADDR`、`GOTIFY_SERVER_KEEPALIVEPERIODSECONDS`
- SSL / HTTPS：`GOTIFY_SERVER_SSL_*`（共 9 项，含证书路径与 Let's Encrypt 相关配置）
- 跨域与流式推送：`GOTIFY_SERVER_CORS_*`、`GOTIFY_SERVER_STREAM_*`
- 数据位置：`GOTIFY_DATABASE_DIALECT`、`GOTIFY_DATABASE_CONNECTION`、`GOTIFY_UPLOADEDIMAGESDIR`、`GOTIFY_PLUGINSDIR`（已固定为容器内 `data/` 相对路径，落在应用数据目录内，一般无需修改）
- 其他：`GOTIFY_SERVER_RESPONSEHEADERS`

如需修改这些项，可编辑目标 NAS 上应用数据目录（`${TRIM_PKGVAR}/data`）内的配置文件，或按上游文档补充环境变量后重建容器。默认配置下 Gotify 可直接使用，无需调整。

## 相关链接

- [上游项目](https://github.com/gotify/server)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-gotify)
