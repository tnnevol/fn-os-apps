<AppIcon name="fn-octop" alt="Octop 图标" />

# Octop

## 应用简介

腾讯云 Octop 是面向企业的运维自动化与作业编排平台，提供资产、任务与执行管理。

## 主要能力

- 集中管理主机资产与凭据。
- 编排并下发批量运维作业。
- 记录执行历史与操作审计。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-octop` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，并填写**管理员用户名与密码**（上游默认值是弱占位符，请自行设置）以及日志级别。安装完成后从应用中心打开控制台。平台数据保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/tencentcloud/octop)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-octop)
