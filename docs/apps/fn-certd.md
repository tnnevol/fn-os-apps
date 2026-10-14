<AppIcon name="fn-certd" alt="Certd 图标" />

# Certd

## 应用简介

Certd 是自动化证书管理平台，为域名自动申请与续期 SSL 证书。

## 主要能力

- 自动申请与续期 SSL 证书。
- 支持多家 DNS 服务商与 ACME 渠道。
- 证书到期通知与自动部署。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-certd` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口与 HTTPS 端口。安装完成后从应用中心打开并配置证书申请任务。

**HTTPS 端口需要证书才能使用**：证书由你在应用内申请或导入。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/certd/certd)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-certd)
