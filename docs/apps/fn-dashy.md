<AppIcon name="fn-dashy" alt="Dashy 图标" />

# Dashy

## 应用简介

Dashy 是可自托管的个人导航面板，把常用服务入口集中整理到一个页面。

## 主要能力

- 可视化整理服务入口与分组。
- 支持自定义图标与主题。
- 配置以 YAML 文件保存，便于版本管理。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-dashy` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开。

面板内容来自 `conf.yml`（应用数据目录下的 `data/data/user-data/conf.yml`，对应容器内 `/app/user-data/conf.yml`）。安装时 `cmd/install_callback` 会写入一份**最小可用配置**（`app/seed/`，本项目自行编写），页面可正常加载但**只有分组骨架、没有导航项**，请按 Dashy 的配置格式往 `sections` 里添加分组与链接后再使用。图标等静态资源放在同级的 `data/data/item-icons` 目录。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/Lissy93/dashy)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-dashy)
