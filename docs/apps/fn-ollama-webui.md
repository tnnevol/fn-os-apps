<AppIcon name="fn-ollama-webui" alt="Open WebUI 图标" />

# Open WebUI

## 应用简介

Open WebUI 是自托管的 AI 对话界面，可对接 Ollama 或任意兼容 OpenAI 的服务。

## 主要能力

- 网页端多轮对话与历史记录。
- 可对接 Ollama 或兼容 OpenAI 的接口。
- 支持多用户与模型切换。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-ollama-webui` |
| 目标平台 | x86 |
| 额外依赖 | 无（需自行准备 Ollama 或兼容服务） |

## 安装与使用

安装时设置 Web 访问端口，并填写**要对接的 Ollama 服务地址**（例如 `http://192.168.10.100:11434`）。会话密钥可选，多副本部署时才需要填写同一个值。安装完成后从应用中心打开，首次使用需注册管理员账号。对话记录保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/open-webui/open-webui)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-ollama-webui)
