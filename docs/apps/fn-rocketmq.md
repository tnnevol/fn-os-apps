<AppIcon name="fn-rocketmq" alt="RocketMQ 图标" />

# RocketMQ

## 应用简介

Apache RocketMQ 是分布式消息队列中间件，提供事务消息、延迟消息、定时消息与海量消息存储能力。

## 主要能力

- 高吞吐、低延迟的消息投递。
- 事务消息与定时消息。
- 消费进度管理与消息回溯。
- 附带 Web 控制台管理主题与消费者组。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-rocketmq` |
| 目标平台 | x86 |
| 外部依赖 | 无（NameServer 与 Broker 均在本应用内） |

## 安装与使用

安装分两步：先设置**控制台**（访问端口、用户名密码、是否强制登录），再设置**服务端口**（NameServer、Broker、Proxy 共 7 个端口）。

::: warning 控制台只是其中一部分
控制台（默认 8088）用于查看主题与消费者。真正的消息收发需要客户端连接 NameServer（默认 9876）与 Broker（默认 10911）。
:::

安装后打开控制台，用安装时设置的用户名密码登录。**在游戏/生产环境使用前，请确认 NameServer 与 Broker 端口在防火墙或路由器上按需开放。**

## 高级配置

### 容器构成

| 服务 | 容器名 | 作用 |
| --- | --- | --- |
| `namesrv` | `fn-rocketmq-namesrv` | 名字服务，负责路由 |
| `broker` | `fn-rocketmq-broker` | 消息存储与投递 |
| `proxy` | `fn-rocketmq-proxy` | 协议代理（gRPC 等） |
| `dashboard` | `fn-rocketmq` | Web 控制台 |

### 配置文件

安装时会在应用数据目录预置两份最小可用配置：

```text
data/broker/conf/broker.conf      挂载到容器内 /opt/rocketmq-5.2.0/conf/broker.conf
data/proxy/conf/rmq-proxy.json    挂载到容器内 /opt/rocketmq-5.2.0/conf/rmq-proxy.json
```

直接编辑这两个文件即可调整 Broker 存储策略、事务超时等参数，**改完重启应用生效**。这两份配置由本项目自行编写，只含必要项；需要更多参数时请参照 [RocketMQ 官方配置文档](https://rocketmq.apache.org/docs/broker/Configuration/)。

> **关于配置路径**：容器内使用的是 `/opt/rocketmq-5.2.0/conf/`，而镜像的 `ROCKETMQ_HOME` 是 `/home/rocketmq/rocketmq-5.5.0`。该路径沿用自上游编排——挂载目标与 `mqbroker -c` 参数指向同一位置，配置能正常生效，但属**上游遗留的版本号不一致**，如后续调整需同步修改两处。

### 修改控制台密码

在应用中心「配置」中修改密码后，需要删除数据目录下的 `dashboard/users.properties` 与 `.users.properties.generated` 并重启，否则旧密码仍然有效。

## 相关链接

- [上游项目](https://rocketmq.apache.org)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-rocketmq)