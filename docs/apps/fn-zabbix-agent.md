<AppIcon name="fn-zabbix-agent" alt="Zabbix Agent 图标" />

# Zabbix Agent

## 应用简介

Zabbix Agent 部署在被监控主机上，采集本机指标并上报给 Zabbix Server。

## 主要能力

- 采集 CPU、内存、磁盘与网络等主机指标。
- 支持主动与被动两种检查模式。
- 主机名与 Server 地址在安装时配置。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-zabbix-agent` |
| 目标平台 | x86 |
| 额外依赖 | 无（需要已有的 Zabbix Server） |

## 安装与使用

安装时填写主机名、Zabbix Server 地址与端口。本应用没有 Web 管理界面，安装后在 Zabbix Server 侧添加对应主机即可开始监控。

## 相关链接

- [上游官网](https://www.zabbix.com)
- [上游项目](https://github.com/zabbix/zabbix)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-zabbix-agent)
