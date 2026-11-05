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

## 高级配置

本应用现同步到上游最高的 **2.0.0**。相比 1.x，2.0.0 增加了视觉模型、联网搜索与天气能力，安装或运行设置里可配置以下**可选项**（留空即使用镜像默认行为）：

| 字段 | 用途 |
| --- | --- |
| `LLM_VISION_PROVIDER` / `LLM_VISION_MODEL` | 主模型不支持多模态时，另选视觉模型供应商与模型名 |
| `VISION_PROVIDER_BASE_URL` / `VISION_PROVIDER_API_KEY` | 视觉模型服务的接口地址与密钥 |
| `SERPER_API_KEY` / `WEATHER_API_KEY` | 联网搜索与天气组件所需的密钥 |
| `MAX_UPLOAD_SIZE_MB` | 单个上传文件大小上限，默认 5 MB |

另有三个由上游固定的运行参数（`USAGE_LOG_FILE`、`OPERATING_ENV`、`LOG_LEVEL`）直接写在编排里，不作为向导字段。

> 2.0.0 上游把宿主侧数据目录从 `./data/data` 等改为 `./data` 等，但容器内目标 `/app/data`、`/app/logs`、`/app/storage` 没变。本应用保留原有宿主子目录，避免升级后已有数据与生成产物看起来丢失。从 1.x 升级前建议先备份应用数据目录。

## 相关链接

- [上游项目](https://github.com/halo-dev/upage)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-upage)
