<AppIcon name="fn-ollama" alt="Ollama 图标" />

# Ollama

## 应用简介

Ollama 用于在本机部署和运行各类开源大语言模型，对外提供兼容 OpenAI 的 API。

## 主要能力

- 快速拉取并运行多种开源大模型。
- 提供兼容 OpenAI 的 REST API，便于其它应用接入。
- 支持模型热加载与多模型并存。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-ollama` |
| 目标平台 | x86 |
| 额外依赖 | 无（模型文件由应用自行下载） |

## 安装与使用

安装时设置 API 服务端口。**本应用没有 Web 管理界面**，只提供 REST API（默认 11434）；安装后可在目标 NAS 的终端中执行 `ollama pull <模型名>` 下载模型，再由其它应用通过 `http://<NAS 地址>:<端口>` 调用。

模型文件保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。**模型文件较大（单个可达数 GB），请确认所选存储空间（安装时选择的卷）有足够容量。**

## 相关链接

- [上游官网](https://ollama.com)
- [上游项目](https://github.com/ollama/ollama)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-ollama)
