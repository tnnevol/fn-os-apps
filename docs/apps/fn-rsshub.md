<AppIcon name="fn-rsshub" alt="RSSHub 图标" />

# RSSHub

## 应用简介

RSSHub 为几乎所有网站生成 RSS 订阅源，把动态内容接入阅读器。

## 主要能力

- 为数千个网站生成 RSS 源。
- 支持路由参数与自定义规则。
- 缓存加速与无头浏览器渲染。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-rsshub` |
| 目标平台 | x86 |
| 外部依赖 | **外部 Redis + Browserless** |

## 安装与使用

安装时设置 Web 访问端口，填写 **Redis 地址/端口/密码**与 **Browserless 地址/端口**。

**本应用依赖两个外部服务**：

- **Redis**：用于缓存。安装时会自动安装飞牛应用中心的 Redis 依赖。
- **Browserless**：无头浏览器，供需要渲染 JavaScript 的路由使用。安装时会自动安装 `fn-browserless` 依赖（默认端口 3000）。**未安装或地址填错时，需要渲染的路由会失败，其余路由不受影响。**

**本应用无状态**：不保存数据。

## 相关链接

- [上游项目](https://github.com/DIYgod/RSSHub)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-rsshub)
