<AppIcon name="fn-kibana" alt="Kibana 图标" />

# Kibana

## 应用简介

Kibana 是面向 Elasticsearch 的数据分析与可视化平台，用于检索数据并制作仪表盘。

## 主要能力

- 检索与探索 Elasticsearch 中的数据。
- 创建可视化图表与仪表盘。
- 提供开发者工具与索引管理。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-kibana` |
| 目标平台 | x86 |
| 额外依赖 | 无（**需自行准备 Elasticsearch 实例**） |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开。

**本应用自身不包含 Elasticsearch**：Kibana 只是可视化前端，需另行部署 Elasticsearch 并在本应用界面中填入其地址，否则无法使用。数据保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/elastic/kibana)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-kibana)
