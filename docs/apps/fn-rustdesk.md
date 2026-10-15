<AppIcon name="fn-rustdesk" alt="RustDesk Server 图标" />

# RustDesk Server

## 应用简介

RustDesk 是开源自托管远程桌面服务，包含 ID/中继与 WebSocket 服务。

## 主要能力

- 自托管的远程桌面 ID 与中继服务。
- NAT 穿透与流量中转。
- 为 Web 客户端提供 WebSocket 接入。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-rustdesk` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时填写**对外 IP 地址**，以及 NAT 检测、ID/信令、中继、WebSocket 各端口。

**对外 IP 很关键**：这是中继服务对外通告的地址，客户端会据此连接。**上游默认值 `172.17.0.1` 是 Docker 内部网桥地址，在 fnOS 上不可用，必须改为目标 NAS 的实际 IP。** 填错会导致客户端**能连上 ID 服务器但无法建立远程连接**。

**本应用没有 Web 管理界面**（只提供协议服务），因此**应用中心不提供桌面入口**。客户端需在 RustDesk 客户端中把 ID 服务器与中继服务器指向目标 NAS 的对应端口。

**端口说明**：

| 端口 | 用途 |
| --- | --- |
| 21115 | NAT 类型检测 |
| 21116 | ID 注册与信令（TCP + UDP，**必需**） |
| 21117 | 中继（relay） |
| 21118 / 21119 | WebSocket（供 Web 客户端） |

**安全提示**：WebSocket 端口（21118/21119）建议**只通过反向代理暴露并设置转发头，同时用防火墙限制来源**——否则可能被他人用于中转流量。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/rustdesk/rustdesk-server)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-rustdesk)
