<AppIcon name="fn-laya-server" alt="Laya Server 图标" />

# Laya Server

## 应用简介

Laya Server 是自托管的决策引擎，提供 API 与控制台，用于集中管理业务规则。

## 主要能力

- 以 API 方式对外提供决策能力。
- 提供控制台管理规则与配置。
- 便于把业务规则从代码中剥离。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-laya-server` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，并填写控制台的**管理员用户名与密码**（上游默认值是弱占位符，请自行设置）。安装完成后从应用中心打开控制台。数据保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/1Panel-dev/laya-server)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-laya-server)
