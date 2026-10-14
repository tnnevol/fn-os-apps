<AppIcon name="fn-zfile" alt="ZFile 图标" />

# ZFile

## 应用简介

ZFile 是基于 Java 的在线网盘程序，把多种存储源统一到一个网页中浏览与下载。

## 主要能力

- 聚合多种存储源统一浏览。
- 支持在线预览与生成分享链接。
- 多用户与目录权限控制。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-zfile` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开并登录（初始账号密码见应用日志），再在后台添加存储源。

数据库、日志与本地挂载目录分别保存在目标 NAS 应用数据目录下的 `db`、`logs`、`mnt` 子目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/zhaojun1998/zfile)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-zfile)
