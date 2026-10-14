<AppIcon name="fn-mkdocs-material" alt="MkDocs Material 图标" />

# MkDocs Material

## 应用简介

MkDocs Material 是构建文档站点的容器镜像，挂载文档源目录后即可预览与生成站点。

## 主要能力

- 挂载 Markdown 源目录即可预览站点。
- 内置 Material 主题与搜索。
- 可作为文档站点的构建环境。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-mkdocs-material` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，安装完成后把 MkDocs 项目的文档源文件放到目标 NAS 的应用数据目录（对应容器内 `/docs`），再从应用中心打开预览。文档源保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可保留源文件。

## 相关链接

- [上游项目](https://github.com/squidfunk/mkdocs-material)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-mkdocs-material)
