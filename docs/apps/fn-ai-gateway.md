<AppIcon name="fn-ai-gateway" alt="1Panel AI 网关卡图标" />

# 1Panel AI 网关

## 应用简介

1Panel AI 网关是面向企业和团队的 AI 统一接入与治理平台，提供模型代理、权限控制与用量分析。

## 主要能力

- 统一接入不同供应商与本地模型，对外提供标准接口。
- 按用户组与 API Key 管理模型权限、并发与配额。
- 智能路由与负载均衡，内容合规审查与用量统计。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-ai-gateway` |
| 目标平台 | x86 |
| 额外依赖 | 无（可选的模型服务由用户自行提供） |

## 安装与使用

安装时设置 Web 访问端口，并填写初始**管理员用户名与密码**（上游默认值是弱占位符，请自行设置）。安装完成后从应用中心打开控制台，配置模型供应商与访问密钥即可。

网关数据（含 SQLite 数据库）保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/1Panel-dev/1Panel-Gateway)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-ai-gateway)
