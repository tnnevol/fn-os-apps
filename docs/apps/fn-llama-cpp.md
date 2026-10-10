<AppIcon name="fn-llama-cpp" alt="llama.cpp 图标" />

# llama.cpp

## 应用简介

llama.cpp 在本地以服务方式运行 GGUF 格式的大语言模型，并提供兼容 OpenAI 的接口。

## 主要能力

- 加载本地 GGUF 模型并提供 HTTP 推理接口。
- 接口兼容 OpenAI，可被同类客户端直接调用。
- 启动参数可自定义，便于调整上下文与并发。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-llama-cpp` |
| 目标平台 | x86 |
| 额外依赖 | 无（模型文件由用户自备） |

## 安装与使用

安装时设置 Web 访问端口，并填写目标 NAS 上存放 GGUF 模型的目录绝对路径（例如 /vol1/1000/models），该目录会以只读方式挂载到容器内 /models；启动参数中的 -m 指向该目录下的模型文件。模型文件需自行下载准备。

## 相关链接

- [上游项目](https://github.com/ggml-org/llama.cpp)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-llama-cpp)
