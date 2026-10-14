<AppIcon name="fn-openclaw" alt="OpenClaw 图标" />

# OpenClaw

## 应用简介

OpenClaw 是自托管的 AI 助手网关，统一接入多种大模型服务。

## 主要能力

- 统一接入多种大模型供应商。
- 提供 Web 管理界面与健康检查。
- 配置与工作区持久化。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-openclaw` |
| 目标平台 | x86 |
| 额外依赖 | 无（所需模型服务由用户自行提供） |

## 安装与使用

安装时设置 Web 访问端口，并填写**模型 API Key**、**允许的来源地址**、**模型供应商**与**默认模型**；使用自建或代理模型服务时，再填写**模型接口地址**。网关访问令牌为可选项，留空则由应用自行生成。安装完成后从应用中心打开。

配置与工作区分别保存在应用数据目录的 `data/data/conf`、`data/data/workspace` 子目录中。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 高级配置

### 已删除的宿主挂载

上游编排里有一个宿主路径挂载 `- /etc/localtime:/etc/localtime`，按转换规约「挂载源为宿主绝对路径一律删除」**未随本应用提供**（fnOS 上不作为应用挂载点使用）。**时区改由 `TZ` 环境变量提供**。

### 可省略的字段

上游共有 7 个向导字段，本应用收敛为 6 个（合并了名称重复的配置项）。其余未开放为向导字段的高级项（如 `OPENCLAW_DISABLE_BONJOUR`、`TERM`、`HOME`）已按上游原值写死在 compose 中，如需调整请直接编辑 `app/docker/docker-compose.yaml`。

## 相关链接

- [上游项目](https://github.com/1Panel-dev/openclaw)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-openclaw)
