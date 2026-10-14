<AppIcon name="fn-adguardhome" alt="AdGuard Home 图标" />

# AdGuard Home

## 应用简介

AdGuard Home 是全网 DNS 广告过滤器，为家庭网络提供去广告与隐私保护。

## 主要能力

- 对全家网络生效的 DNS 去广告。
- 支持 DoH / DoT / DNSCrypt 等加密 DNS。
- 查询日志与拦截统计。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-adguardhome` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 Web 管理端口，并按需调整 DNS、DHCP、DoH、DoT、QUIC、DNSCrypt 等端口，以及容器时区。安装完成后从应用中心打开完成初始化向导。

**端口提示**：DNS 默认 53 在多数系统上已被占用，本应用默认映射为 20053；**若客户端要使用本应用的 DNS，需在客户端把 DNS 指向目标 NAS 的对应端口**。DoH/DoT 需要使用证书才会被客户端信任。

工作目录与配置分别保存在应用数据目录的 `data/work`、`data/conf` 子目录中。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/AdguardTeam/AdGuardHome)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-adguardhome)
