<AppIcon name="fn-komari" alt="Komari Monitor 图标" />

# Komari Monitor

## 应用简介

Komari 是轻量的服务器监控面板，可汇总多台主机的运行状态与资源占用。

## 主要能力

- 集中展示多台主机状态。
- 记录历史负载与在线情况。
- 提供 Web 面板与探针接入。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-komari` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开并添加探针。监控数据保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

容器以本应用的包用户身份运行（通过 `TRIM_UID`/`TRIM_GID` 传入），不以上游默认的 root 身份运行。

## 相关链接

- [上游项目](https://github.com/komari-monitor/komari)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-komari)
