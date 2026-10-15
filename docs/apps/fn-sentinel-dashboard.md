<AppIcon name="fn-sentinel-dashboard" alt="Sentinel Dashboard 图标" />

# Sentinel Dashboard

## 应用简介

Sentinel Dashboard 是流量控制与熔断降级的实时监控控制台。

## 主要能力

- 实时监控流量与并发。
- 配置流控与熔断降级规则。
- 查看机器列表与集群状态。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-sentinel-dashboard` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口与**通信端口**。

**通信端口为非 HTTP**（不建桌面入口），是客户端与 Dashboard 通信使用的端口，**需要在被监控应用的客户端配置中指向该端口**。

**本应用无状态**：不保存数据，卸载时无需保留数据。

**默认凭据**：本应用默认无认证。**如需对外网开放，请务必通过反向代理加认证**——控制台可修改流控规则，暴露在公网有被滥用的风险。

## 相关链接

- [上游项目](https://github.com/alibaba/Sentinel)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-sentinel-dashboard)
