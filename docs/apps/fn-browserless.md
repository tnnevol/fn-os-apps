<AppIcon name="fn-browserless" alt="Browserless 图标" />

# Browserless

## 应用简介

Browserless 把无头 Chrome 封装成容器服务，供自动化脚本通过 HTTP 接口执行网页渲染任务。

## 主要能力

- 提供无头 Chrome 的 HTTP 接口，用于抓取、截图与 PDF 生成。
- 通过 /pressure 健康检查暴露服务负载状态。
- 适合作为其它应用的浏览器渲染后端。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-browserless` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开可查看服务状态页。该服务无独立管理界面，主要由其它应用或脚本通过 API 调用。

## 相关链接

- [上游官网](https://www.browserless.io)
- [上游项目](https://github.com/browserless/browserless)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-browserless)
