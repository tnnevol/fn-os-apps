<AppIcon name="fn-memcached" alt="Memcached 图标" />

# Memcached

## 应用简介

Memcached 是分布式内存对象缓存系统，用于减轻数据库负载、加速动态应用。

## 主要能力

- 以键值方式在内存中缓存数据对象。
- 内存上限可在安装时配置。
- 提供标准的 Memcached 协议接口。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-memcached` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置服务端口与内存上限。本应用没有 Web 管理界面，安装后在其它应用中把缓存地址指向本机对应端口即可使用。

## 相关链接

- [上游官网](https://memcached.org)
- [上游项目](https://github.com/memcached/memcached)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-memcached)
