<AppIcon name="fn-localai" alt="LocalAI 图标" />

# LocalAI

## 应用简介

LocalAI 是兼容 OpenAI 接口的本地推理服务，可在自有硬件上运行文本、图像与音频模型。

## 主要能力

- 提供兼容 OpenAI 的 REST API。
- 本地运行多种开源模型，数据不出内网。
- 支持 CPU 与 GPU 推理。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-localai` |
| 目标平台 | x86 |
| 额外依赖 | 无（模型文件由应用自行下载） |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开查看服务状态，或直接以 OpenAI 兼容接口调用（默认路径 `/v1`）。模型文件保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复；**模型文件较大，请注意存储容量**。

## 相关链接

- [上游项目](https://github.com/mudler/LocalAI)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-localai)
