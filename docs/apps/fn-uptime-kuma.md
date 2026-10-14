<AppIcon name="fn-uptime-kuma" alt="Uptime Kuma 图标" />

# Uptime Kuma

## 应用简介

Uptime Kuma 是精美的自托管监控工具，跟踪服务的在线状态与响应时间。

## 主要能力

- 支持 HTTP、TCP、Ping、DNS 等多种监控类型。
- 提供状态页与多种告警通知渠道。
- 记录响应时间趋势与故障历史。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-uptime-kuma` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开并创建管理员账号，再添加要监控的站点。数据保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/louislam/uptime-kuma)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-uptime-kuma)
