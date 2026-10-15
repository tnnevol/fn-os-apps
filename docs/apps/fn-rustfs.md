<AppIcon name="fn-rustfs" alt="RustFS 图标" />

# RustFS

## 应用简介

RustFS 是分布式对象存储系统，兼容 S3 协议并提供管理控制台。

## 主要能力

- S3 兼容的对象存储。
- Web 管理控制台。
- 分布式部署能力。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-rustfs` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置控制台端口、**S3 API 端口**、**访问密钥 ID**、**访问密钥**，并选择是否启用控制台。

**S3 API 端口为非 HTTP 协议**（不建桌面入口），供客户端以 S3 协议访问。

**凭据说明**：上游为访问密钥 ID 与密钥都提供了弱占位默认值（且两者相同），转换后已改为**留空并必填**，请自行设置强凭据。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/rustfs/rustfs)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-rustfs)
