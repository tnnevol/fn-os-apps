<AppIcon name="fn-redpanda-console" alt="Redpanda Console 图标" />

# Redpanda Console

## 应用简介

Redpanda Console 是 Kafka / Redpanda 的 Web 管理界面，用于查看主题与消费组。

## 主要能力

- 浏览 Kafka 主题与分区详情。
- 管理消费组与查看消费滞后。
- 查看消息内容与连接器状态。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-redpanda-console` |
| 目标平台 | x86 |
| 外部依赖 | **外部 Kafka / Redpanda 集群** |

## 安装与使用

安装时设置 Web 访问端口，填写 **Kafka 地址**（只填地址，端口固定 9092）。

**本应用不包含 Kafka 本身**，只是管理界面；**连接失败时界面会提示无法获取集群信息**，请确认 Kafka 地址可达、9092 端口已放行。

**本应用无状态**：不保存数据，卸载时无需保留数据。

## 相关链接

- [上游项目](https://github.com/redpanda-data/console)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-redpanda-console)
