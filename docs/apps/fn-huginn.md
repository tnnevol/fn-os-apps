<AppIcon name="fn-huginn" alt="Huginn 图标" />

# Huginn

## 应用简介

Huginn 是自动化代理平台，把网站与 API 的变化转化为可编程的事件流。

## 主要能力

- 用 Agent 监控网站与 API 的变化。
- 事件触发与条件分支。
- 把结果推送到邮件、Webhook 等。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-huginn` |
| 目标平台 | x86 |
| 外部依赖 | 无（**数据库随应用一同安装**） |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开并按界面提示创建账号（首个注册用户即管理员）。

**本应用自带数据库**：容器内的 `/var/lib/mysql` 是它自己的 MySQL 实例，**无需外部数据库**。

**运行身份**：本应用镜像**默认即以非 root 用户（uid 1001）运行**，因此未追加 `user:` 覆写。**注意**：该固定 uid 与 fnOS 为应用分配的包用户 uid 不同（属已登记的真机待验证项）。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/huginn/huginn)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-huginn)
