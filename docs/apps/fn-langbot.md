<AppIcon name="fn-langbot" alt="LangBot 图标" />

# LangBot

## 应用简介

LangBot 是面向大模型的即时通讯机器人平台，支持多平台接入与插件。

## 主要能力

- 大模型驱动的聊天机器人平台。
- 多平台消息接入。
- 插件运行时与扩展。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-langbot` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口、插件运行端口范围与容器时区。

**端口范围**填写形如 `2280-2290` 的区间，该区间会整段映射到宿主。**区间过大或与其它服务冲突会导致启动失败**，请确保该范围未被占用。

**多容器**：本应用包含主服务 `fn-langbot` 与插件运行时 `fn-langbot-plugin-runtime`，两者都需要运行。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/langbot-app/LangBot)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-langbot)
