<AppIcon name="fn-roundcube" alt="Roundcube 图标" />

# Roundcube

## 应用简介

Roundcube 是基于浏览器的 Webmail 客户端，支持 IMAP 与 SMTP。

## 主要能力

- 浏览器中的邮件收发。
- 通讯录与日历。
- 多语言与插件扩展。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-roundcube` |
| 目标平台 | x86 |
| 外部依赖 | **外部 MySQL/MariaDB（保存 Webmail 自身数据）+ 一个 IMAP/SMTP 邮箱** |

## 运行身份

容器以镜像默认用户（**root**）运行，**未**改为包用户。原因：该镜像的 `docker-entrypoint.sh` 会执行`chown www-data ${ROUNDCUBEMAIL_TEMP_DIR}`，而该变量在脚本内有默认值 `/tmp/roundcube-temp`，**每次启动都会执行**。非 root 身份下 `chown` 会失败。

应用数据仍落在 `${TRIM_PKGVAR}` 下并由包用户拥有；仅容器内进程身份为 root。

## 安装与使用

安装时设置 Web 访问端口，填写两类信息：

**① 保存 Webmail 自身数据的数据库**（地址、端口、库名、用户名、密码分开填写）。**数据库需用户自备**：安装时填写数据库连接信息。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**② 要登录的邮箱服务器**：IMAP 服务器与端口、SMTP 服务器与端口。

**数据库类型只提供 MySQL / MariaDB**：上游给出 `postgresql`，但 Roundcube 官方镜像的合法值是 `mysql`/`pgsql`/`sqlite`，直接透传会得到非法值，故只保留合法选项并按 `forgejo` 的处理方式收敛。

**附件大小上限**格式为「数字+单位」，例如 `5M`、`10M`。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/roundcube/roundcubemail)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-roundcube)
