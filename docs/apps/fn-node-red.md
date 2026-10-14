<AppIcon name="fn-node-red" alt="Node-RED 图标" />

# Node-RED

## 应用简介

Node-RED 是基于流程的编程工具，用于把硬件、API 与在线服务连接起来。

## 主要能力

- 可视化流程编辑器，拖拽式连线。
- 内置大量节点，支持安装扩展。
- 适合做自动化与 IoT 场景编排。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-node-red` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口与容器时区，安装完成后从应用中心打开编辑器。流程与凭据保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

容器以本应用的包用户身份运行（通过 `TRIM_UID`/`TRIM_GID` 传入），不以上游默认的 root 身份运行。

## 相关链接

- [上游项目](https://github.com/node-red/node-red)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-node-red)
