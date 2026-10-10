<AppIcon name="fn-cloudflared" alt="cloudflared 图标" />

# cloudflared

## 应用简介

cloudflared 是 Cloudflare Tunnel 客户端，把内网服务通过隧道发布到公网，无需在路由器上开放入站端口。

## 主要能力

- 建立到 Cloudflare 的出站隧道。
- 把内网服务安全映射到公网域名。
- 无需开放入站端口或配置端口转发。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-cloudflared` |
| 目标平台 | x86 |
| 额外依赖 | 无（需要在 Cloudflare Zero Trust 中已创建的隧道） |

## 安装与使用

安装时填写 Cloudflare Zero Trust 控制台中该隧道的连接 Token。本应用没有 Web 管理界面，也不监听本地端口；安装后请到 Cloudflare 控制台确认隧道已连接。Token 属敏感信息，请勿泄露。

## 相关链接

- [上游官网](https://www.cloudflare.com/products/tunnel/)
- [上游项目](https://github.com/cloudflare/cloudflared)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-cloudflared)
