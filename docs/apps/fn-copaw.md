<AppIcon name="fn-copaw" alt="CoPaw 图标" />

# CoPaw

## 应用简介

CoPaw 是面向大模型的智能体协作平台，提供 Web 管理界面与多智能体编排能力。

## 主要能力

- Web 界面管理与编排智能体。
- 支持接入大模型服务。
- 工作目录、密钥与备份分别持久化。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-copaw` |
| 目标平台 | x86 |
| 额外依赖 | 无（所需模型服务由用户自行提供） |

## 安装与使用

安装时设置 Web 访问端口，并填写**管理员用户名与密码**（上游默认密码是弱占位符，请自行设置）。安装完成后从应用中心打开登录。

工作目录、密钥与备份分别保存在应用数据目录的 `data`、`secret`、`backups` 子目录中。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/agentscope-ai/CoPaw)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-copaw)
