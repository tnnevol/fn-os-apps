<AppIcon name="fn-beszel" alt="Beszel 图标" />

# Beszel

## 应用简介

Beszel 是轻量易用的服务器监控工具，通过探针汇总多台主机的资源占用与历史趋势。

## 主要能力

- 集中展示 CPU、内存、磁盘与网络占用。
- 支持多主机探针接入。
- 记录历史趋势并支持告警通知。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-beszel` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开并创建管理员账号，再在各被监控主机上部署探针。数据保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/henrygd/beszel)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-beszel)
