<AppIcon name="fn-nodebb" alt="NodeBB 图标" />

# NodeBB

## 应用简介

NodeBB 是基于 Node.js 的现代化论坛程序，支持实时通知、插件扩展与多数据库后端。

## 主要能力

- 实时通知与即时讨论体验。
- 插件与主题扩展机制。
- 支持多种数据库后端。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-nodebb` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开并按向导完成初始化（首次运行会引导配置数据库）。

构建产物、依赖、上传附件与配置分别保存在目标 NAS 应用数据目录下的 `build`、`node_modules`、`uploads`、`config` 四个子目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/NodeBB/NodeBB)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-nodebb)
