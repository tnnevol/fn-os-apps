<AppIcon name="fn-typecho" alt="Typecho 图标" />

# Typecho

## 应用简介

Typecho 是轻量简洁的博客程序，支持 Markdown 与插件扩展。

## 主要能力

- 轻量快速的博客系统。
- Markdown 写作。
- 主题与插件扩展。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-typecho` |
| 目标平台 | x86 |
| 外部依赖 | **外部 MySQL / MariaDB** |

## 安装与使用

安装时设置 Web 访问端口，填写数据库连接信息（地址、端口、库名、用户名、密码分开填写），以及**站点访问地址**与**管理员信息**。

**数据库需用户自备**：安装时填写数据库连接信息。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**数据库只提供 MySQL / MariaDB**：上游用一个「适配器」变量（由其预启动脚本按数据库类型派生）来区分 MySQL 与 PostgreSQL，而 fnOS 没有该钩子、编排也无法按选项分支。为避免出现「选了类型却要手填适配器、填错就连不上」的情况，**当前转换版本只支持 MySQL/MariaDB，不提供 PostgreSQL 选项**。

**站点访问地址**填错会导致页面跳转与静态资源异常。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/typecho/typecho)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-typecho)
