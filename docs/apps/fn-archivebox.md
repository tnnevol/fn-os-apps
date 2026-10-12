<AppIcon name="fn-archivebox" alt="ArchiveBox 图标" />

# ArchiveBox

## 应用简介

ArchiveBox 是自托管的网页存档工具，把网页保存为可离线检索的归档。

## 主要能力

- 把网页存档为多种格式（HTML、PDF、截图等）。
- 对存档内容建立索引，支持离线检索。
- 可通过命令行或定时任务批量存档。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-archivebox` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，并填写 Web 界面的**管理员用户名与密码**（上游默认值是弱占位符，请自行设置）。安装完成后从应用中心打开即可添加要存档的网址。归档内容与索引保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复；**归档会随时间占用较多空间，请注意存储容量**。

## 相关链接

- [上游项目](https://github.com/ArchiveBox/ArchiveBox)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-archivebox)
