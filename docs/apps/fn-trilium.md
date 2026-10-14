<AppIcon name="fn-trilium" alt="Trilium Notes 图标" />

# Trilium Notes

## 应用简介

Trilium Notes 是大纲式笔记应用，用树状层级组织笔记，支持双向链接、属性与附件管理。

## 主要能力

- 树形大纲结构，笔记之间可互相嵌套。
- 双向链接与反向链接索引。
- 自定义属性与脚本化功能。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-trilium` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口（默认 `8080`）与时区（默认 `Asia/Shanghai`）。

首次打开时按引导创建初始账号密码。笔记数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 高级配置

### 已删除的宿主挂载

上游编排里有两个宿主路径只读挂载：

```yaml
- /etc/timezone:/etc/timezone:ro
- /etc/localtime:/etc/localtime:ro
```

按转换规约「挂载源为宿主绝对路径一律删除」，它们**未随本应用提供**（fnOS 上不作为应用挂载点使用）。**时区改由向导的「时区」字段经 `TZ` 环境变量提供。**

### 数据目录

笔记数据位于应用数据目录下的 `data`（对应容器内 `/home/node/trilium-data`），由 `TRILIUM_DATA_DIR` 环境变量指向。**不要直接改动该目录结构**，备份请使用 Trilium 自身的导出功能。

## 相关链接

- [上游项目](https://github.com/triliumnext/trilium)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-trilium)