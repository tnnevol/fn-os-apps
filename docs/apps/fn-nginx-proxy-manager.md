<AppIcon name="fn-nginx-proxy-manager" alt="Nginx Proxy Manager 图标" />

# Nginx Proxy Manager

## 应用简介

Nginx Proxy Manager 用图形界面管理 Nginx 反向代理与 SSL 证书。

## 主要能力

- 图形化配置反向代理与重定向。
- 申请与续期 Let's Encrypt 证书。
- 管理访问控制与自定义 Nginx 配置。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-nginx-proxy-manager` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 **管理界面端口**、**HTTP 端口**与 **HTTPS 端口**，安装完成后从应用中心打开管理界面（默认管理员账号见应用日志）。

**证书需自行申请或导入**：HTTPS 端口只有在配置了证书后才可用；证书可以在此界面内申请（需域名可解析到目标 NAS），或把已有证书导入。

站点数据与证书分别保存在应用数据目录的 `data/data`、`data/ssl` 子目录中。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/NginxProxyManager/nginx-proxy-manager)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-nginx-proxy-manager)
