<AppIcon name="fn-wallos" alt="Wallos 图标" />

# Wallos

## 应用简介

Wallos 是开源的个人订阅跟踪器，管理周期性支出并在续费前提醒。

## 主要能力

- 记录订阅与周期性支出。
- 统计每月与每年支出概览。
- 续费前发送提醒通知。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-wallos` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口与容器时区，安装完成后从应用中心打开并创建账号。数据库与自定义图标分别保存在目标 NAS 应用数据目录下的 `db`、`logos` 子目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/ellite/Wallos)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-wallos)
