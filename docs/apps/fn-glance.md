<AppIcon name="fn-glance" alt="Glance 图标" />

# Glance

## 应用简介

Glance 是可自托管的仪表盘，把订阅源、服务状态与书签汇总到一个页面。

## 主要能力

- 一页汇总 RSS、服务状态、书签等组件。
- 组件化配置，按需组合。
- 轻量、启动快。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-glance` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口。

**必须先填写配置文件**：仪表盘内容来自 `glance.yml`（应用数据目录下的 `data/data/glance.yml`，对应容器内 `/app/config/glance.yml`）。该文件安装时被预创建为**空文件**，**空文件下应用无法渲染任何内容**，请按 Glance 的配置格式填写后再从应用中心打开。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 高级配置

### 已删除的宿主挂载

上游编排里有两个宿主路径只读挂载：

```yaml
- /etc/timezone:/etc/timezone:ro
- /etc/localtime:/etc/localtime:ro
```

按转换规约「挂载源为宿主绝对路径一律删除」，它们**未随本应用提供**（fnOS 上不作为应用挂载点使用）。**时区改由 `TZ` 环境变量提供**。

### 修改配置文件

编辑目标 NAS 应用数据目录下的 `data/data/glance.yml`，改完后重启应用生效。

## 相关链接

- [上游项目](https://github.com/glanceapp/glance)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-glance)
