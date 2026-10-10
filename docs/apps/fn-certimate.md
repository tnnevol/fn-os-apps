<AppIcon name="fn-certimate" alt="Certimate 图标" />

# Certimate

## 应用简介

Certimate 是安全、简便的 SSL 证书管理方案，支持自动申请与续期证书。

## 主要能力

- 自动申请与续期 SSL 证书。
- 支持多种 DNS 服务商与证书颁发机构。
- 证书部署到多个目标平台。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-certimate` |
| 目标平台 | x86 |
| 额外依赖 | 无（证书颁发机构由用户自行配置） |

## 安装与使用

安装时设置 Web 访问端口与容器时区，必要时填写 HTTP/HTTPS 代理（申请证书时的出站请求会走该代理，留空表示不使用）。安装完成后从应用中心打开，添加证书与部署目标即可。证书与配置数据保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/usual2970/certimate)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-certimate)
