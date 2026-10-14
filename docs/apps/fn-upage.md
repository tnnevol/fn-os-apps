<AppIcon name="fn-upage" alt="UPage 图标" />

# UPage

## 应用简介

UPage 是基于大模型的可视化网页构建工具，用自然语言描述即可生成页面。

## 主要能力

- 用自然语言生成与修改页面。
- 对接多种大模型服务。
- 生成结果可导出使用。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-upage` |
| 目标平台 | x86 |
| 额外依赖 | 无（需自行准备模型服务的 API Key） |

## 安装与使用

安装时设置 Web 访问端口，并填写**模型 API Key**、**模型供应商**、**默认模型**与**辅助模型**；若使用自建或代理的模型服务，再填写**模型接口地址**。安装完成后从应用中心打开即可开始生成页面。

应用数据、日志与生成产物分别保存在目标 NAS 应用数据目录下的 `data`、`logs`、`storage` 子目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/halo-dev/upage)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-upage)
