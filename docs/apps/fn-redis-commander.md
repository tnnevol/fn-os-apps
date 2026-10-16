<AppIcon name="fn-redis-commander" alt="Redis Commander 图标" />

# Redis Commander

## 应用简介

Redis Commander 是基于 Web 的 Redis 管理界面，用于浏览键值与执行命令。

## 主要能力

- 浏览 Redis 键值与类型。
- 执行命令与查看服务器信息。
- 管理多个 Redis 连接的界面。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-redis-commander` |
| 目标平台 | x86 |
| 外部依赖 | **外部 Redis** |

## 安装与使用

安装时设置 Web 访问端口，填写 **Redis 地址与端口**、**Redis 密码**、**要管理的逻辑库编号**，以及**本界面的登录账号密码**。

**本应用只是 Redis 的管理界面，不包含 Redis 本身**——连接失败时页面会提示无法连接。

**已修正的上游缺陷**：上游把「数据库主机」变量当作 Redis 地址使用，而向导里**根本没有 Redis 地址字段**——即**你选的是数据库主机、实际却连了 Redis**。已拆分为独立的 Redis 地址字段。

**逻辑库编号**取 0—15，多个应用共用同一 Redis 时用不同编号可避免键冲突。

**界面登录密码**上游默认值是弱占位符，已改为必填且留空。

## 高级配置

### 图标来源说明

上游提供的 `logo.png` 实际是 **WebP 格式**（文件扩展名为 `.png` 但内容是 WebP），而本项目的图标管线（jimp）不支持解码 WebP。

本项目在生成图标时用 `ffmpeg` 把该文件转换为 PNG（输出到临时目录，**不修改上游文件**），再交给图标脚本处理。**记录此处以便后人遇到同类问题时有先例可循。**

## 相关链接

- [上游项目](https://github.com/joeferner/redis-commander)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-redis-commander)
