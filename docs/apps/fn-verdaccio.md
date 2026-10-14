<AppIcon name="fn-verdaccio" alt="Verdaccio 图标" />

# Verdaccio

## 应用简介

Verdaccio 是轻量的私有 npm 注册中心，可代理公共仓库并托管团队内部包。

## 主要能力

- 托管私有 npm 包。
- 代理并缓存公共仓库。
- 支持插件扩展与访问控制。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-verdaccio` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开管理界面。在需要推送包的机器上执行 `npm set registry http://<NAS 地址>:<端口>` 即可接入。

包存储、配置与插件分别保存在目标 NAS 应用数据目录下的 `storage`、`config`、`plugins` 子目录中，卸载时选择「保留数据」可在重装后恢复；**包存储会持续增长，请注意存储容量**。

## 相关链接

- [上游项目](https://github.com/verdaccio/verdaccio)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-verdaccio)
