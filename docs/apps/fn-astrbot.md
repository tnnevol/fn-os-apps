<AppIcon name="fn-astrbot" alt="AstrBot 图标" />

# AstrBot

## 应用简介

AstrBot 是多平台聊天机器人框架，支持接入 QQ、微信、企业微信等渠道。

## 主要能力

- 多平台聊天渠道接入。
- 插件化能力扩展。
- Web 管理面板。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-astrbot` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口、各聊天渠道的接入端口与容器时区。

**端口说明**：只有 Web 面板端口会创建桌面入口；**微信公众号、企业微信、QQ（官方/个人）、微信个人号**这 5 个端口是非 HTTP 协议端口，只在向导中体现，需要你在对应渠道平台按这些端口配置回调地址。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/AstrBotDevs/AstrBot)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-astrbot)
