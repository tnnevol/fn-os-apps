<AppIcon name="fn-gatus" alt="Gatus 图标" />

# Gatus

## 应用简介

Gatus 是面向开发者的健康监控面板，用声明式 YAML 配置持续探测服务可用性。

## 主要能力

- 声明式配置探测目标与断言条件。
- 支持 HTTP、TCP、ICMP 等多种探测方式。
- 提供状态页与告警通知。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-gatus` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开查看状态页。

**配置文件需自行放置**：探测规则写在 `config/config.yaml` 中，该文件位于目标 NAS 的应用数据目录下的 `config` 子目录（对应容器内 `/config`）。首次使用请在容器终端或通过文件管理创建该文件，否则应用无监控项可显示。数据保存在同一应用数据目录的 `data` 子目录中。

## 相关链接

- [上游项目](https://github.com/TwiN/gatus)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-gatus)
