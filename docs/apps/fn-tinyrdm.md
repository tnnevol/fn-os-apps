<AppIcon name="fn-tinyrdm" alt="Tiny RDM 图标" />

# Tiny RDM

## 应用简介

Tiny RDM 是现代轻量的 Redis 客户端，通过网页管理键值与多种数据结构。

## 主要能力

- 浏览与管理 Redis 键值。
- 支持多种数据结构与命令执行。
- 提供 Web 界面，无需安装客户端。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-tinyrdm` |
| 目标平台 | x86 |
| 额外依赖 | 无（被连接的 Redis 由用户自行提供） |

## 安装与使用

安装时设置 Web 访问端口，并填写**管理员用户名与密码**（上游默认值是弱占位符，请自行设置）。安装完成后从应用中心打开，添加要连接的 Redis 实例。连接配置与数据保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

容器以本应用的包用户身份运行（通过 `TRIM_UID`/`TRIM_GID` 传入），不以上游默认的 root 身份运行。

## 相关链接

- [上游项目](https://github.com/tiny-craft/tiny-rdm)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-tinyrdm)
