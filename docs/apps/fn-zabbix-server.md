<AppIcon name="fn-zabbix-server" alt="Zabbix Server 图标" />

# Zabbix Server

## 应用简介

Zabbix Server 是监控系统服务端，负责采集、计算与告警，内置 Java 网关与 Web 界面。

## 主要能力

- 采集并计算监控指标，触发告警。
- 内置 Java 网关与 Web 管理界面。
- 支持分布式代理架构。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-zabbix-server` |
| 目标平台 | x86 |
| 外部依赖 | **外部 MySQL 数据库** |

## 安装与使用

安装时设置 Web 界面端口、接收端口与容器时区，填写**数据库 root 密码**与数据库连接信息。

数据库需用户自备：安装时分别填写**数据库地址、端口、库名、用户名与密码**。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**为什么需要 root 密码**：Zabbix 首次启动需用 root 凭据初始化数据库（建库建表），因此单独提供该字段。按转换规约，root 凭据只在应用确实需要时保留。

**本应用包含 3 个容器**（服务端、Java 网关、Web 界面），应用中心显示的运行状态覆盖全部容器。**存储说明**：本应用不落盘，数据保存在你所提供的数据库中。

## 高级配置

### 镜像标签

上游把 `zabbix-java-gateway` 与 `zabbix-web-nginx-mysql` 两个镜像写成 **`alpine-latest`（可变标签）**。按转换规约「可变镜像标签不转换」，已统一钉到与主镜像同一版本线的 **`alpine-7.4.5`**：

```yaml
zabbix/zabbix-java-gateway:alpine-7.4.5
zabbix/zabbix-web-nginx-mysql:alpine-7.4.5
```

后续如需升级，请三个镜像**一起**升级到同一版本线。

## 相关链接

- [上游项目](https://github.com/zabbix/zabbix)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-zabbix-server)
