<AppIcon name="fn-new-api" alt="New API 图标" />

# New API

## 应用简介

New API 是 AI API 管理与分发平台，用于统一接入模型、管理令牌并控制调用配额。

## 主要能力

- 接入和管理多个 AI 模型渠道。
- 管理访问令牌与用户配额。
- 提供 API 分发和用量控制能力。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-new-api` |
| 目标平台 | x86 |
| 额外依赖 | Redis |

## 安装与使用

安装前先确保 fnOS 中 Redis 依赖可用。安装后完成数据库或缓存连接、模型渠道和管理员账号配置，再向客户端提供 API 地址。

## 相关链接

- [上游项目](https://github.com/QuantumNous/new-api)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-new-api)
