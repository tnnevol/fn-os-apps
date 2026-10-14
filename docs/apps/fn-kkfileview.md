<AppIcon name="fn-kkfileview" alt="kkFileView 图标" />

# kkFileView

## 应用简介

kkFileView 是文件在线预览服务，支持 office、PDF、图片、压缩包等多种格式。

## 主要能力

- 在线预览多种文档格式。
- 提供 HTTP 接口供其它系统嵌入调用。
- 转换过程在服务端完成，客户端无需插件。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-kkfileview` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开首页，通过接口提交文件地址即可预览。

**本应用为无状态服务**：上游未声明任何数据卷，预览所需的文件来自被预览方的地址，因此本应用不保存用户数据，卸载时无需保留数据（卸载向导的「保留数据」选项对本应用无实际内容可保留）。

## 相关链接

- [上游项目](https://github.com/kekingcn/kkFileView)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-kkfileview)
