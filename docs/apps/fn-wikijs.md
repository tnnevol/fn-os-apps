<AppIcon name="fn-wikijs" alt="Wiki.js 图标" />

# Wiki.js

## 应用简介

Wiki.js 是现代化的知识库系统，支持 Markdown 编辑与细粒度权限。

## 主要能力

- Markdown 知识库与目录树。
- 细粒度的页面权限。
- 多语言与版本历史。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-wikijs` |
| 目标平台 | x86 |
| 外部依赖 | **外部 MySQL / MariaDB / PostgreSQL** |

## 安装与使用

安装时设置 Web 访问端口，填写数据库连接信息（类型、地址、端口、库名、用户名、密码分开填写）。

**数据库需用户自备**：安装时填写数据库连接信息。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**首次访问**会进入安装向导，需在页面上选择并确认数据库连接（此处填写的凭据需与向导字段一致）。

**本应用无状态挂载**：应用数据全部保存在你所提供的数据库中。

## 相关链接

- [上游项目](https://github.com/requarks/wiki)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-wikijs)
