<AppIcon name="fn-newsnow" alt="NewsNow 图标" />

# NewsNow

## 应用简介

NewsNow 聚合多个来源的实时热门新闻，用简洁的界面快速浏览。

## 主要能力

- 聚合多个站点的实时热门内容。
- 支持 GitHub 登录与个性化订阅。
- 可开启内容缓存以减少重复抓取。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-newsnow` |
| 目标平台 | x86 |
| 额外依赖 | 无（GitHub 登录为可选项） |

## 安装与使用

安装时设置 Web 访问端口，并填写 **JWT 密钥**（用于签发登录令牌，请自行填写一个唯一值）。如需 GitHub 登录，再填写对应的 Client ID 与 Secret，否则留空即可。安装完成后从应用中心打开。数据与缓存保存在目标 NAS 的应用数据目录中。

## 相关链接

- [上游项目](https://github.com/ourongxing/newsnow)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-newsnow)
