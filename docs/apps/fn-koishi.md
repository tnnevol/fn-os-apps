<AppIcon name="fn-koishi" alt="Koishi 图标" />

# Koishi

## 应用简介

Koishi 是跨平台聊天机器人框架，支持多平台适配与插件生态。

## 主要能力

- 跨平台聊天机器人开发框架。
- 丰富的插件生态。
- Web 控制台管理。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-koishi` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口与容器时区，安装完成后从应用中心打开控制台。

**关于数据库字段**：上游向导声明了数据库相关字段，但**其容器编排从未引用这些变量**（属上游冗余配置）。本应用已确认数据只需落盘（挂载到 `data` 目录），**因此不提供数据库字段**。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/koishijs/koishi)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-koishi)
