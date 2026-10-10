<AppIcon name="fn-linkding" alt="linkding 图标" />

# linkding

## 应用简介

linkding 是自托管的书签管理器，设计简洁、快速且易于部署。

## 主要能力

- 收集与整理网页书签，支持标签与搜索。
- 自动抓取标题与描述，支持归档快照。
- 提供浏览器扩展与 API。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-linkding` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，并填写**管理员用户名与密码**（首次启动时创建该管理员账号，请设置为自己的密码）。安装完成后从应用中心打开并登录。书签数据库保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/sissbruecker/linkding)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-linkding)
