<AppIcon name="fn-zabbix-proxy" alt="Zabbix Proxy 图标" />

# Zabbix Proxy

## 应用简介

Zabbix Proxy 是 Zabbix 的代理端，代服务器采集监控数据，适用于跨网段场景。

## 主要能力

- 代 Zabbix 服务器采集监控数据。
- 适合网络隔离或跨网段部署。
- 支持主动与被动两种模式。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-zabbix-proxy` |
| 目标平台 | x86 |
| 外部依赖 | **外部 MySQL / MariaDB 数据库** |

## 安装与使用

安装时设置接收端口与容器时区，填写**代理主机名**、**Zabbix 服务器地址**与数据库连接信息。

数据库需用户自备：安装时分别填写**数据库地址、端口、库名、用户名与密码**。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**连接失败的表现**：代理会持续重试连接服务器，**Zabbix 服务器端看不到该代理上报的数据**；若数据库不可用，代理容器会反复重启。

**存储说明**：本应用不落盘，数据保存在你所提供的数据库中。

## 相关链接

- [上游项目](https://github.com/zabbix/zabbix)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-zabbix-proxy)
