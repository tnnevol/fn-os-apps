<AppIcon name="fn-screego" alt="screego 图标" />

# screego

## 应用简介

screego 是面向开发者的屏幕共享工具，基于 WebRTC 提供低延迟画面。

## 主要能力

- 低延迟的屏幕共享。
- 多人同时观看与协作。
- 基于 WebRTC，无需安装客户端。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-screego` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口、**对外 IP 地址**、TURN 端口与 **TURN 端口范围**。

**对外 IP 很关键**：这是 TURN 服务对外通告的地址，**填错会导致 WebRTC 连接建立失败、画面无法显示**。请填目标 NAS 的可访问 IP，例如 192.168.1.10。

**TURN 端口范围为 UDP**，格式为「起始-结束」（如 50000-50200）。**该范围需在防火墙放行，范围过小会限制并发共享。**

**本应用无状态**：不保存数据。

## 相关链接

- [上游项目](https://github.com/screego/server)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-screego)
