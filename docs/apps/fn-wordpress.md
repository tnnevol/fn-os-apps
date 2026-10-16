<AppIcon name="fn-wordpress" alt="WordPress 图标" />

# WordPress

## 应用简介

WordPress 是广泛使用的内容管理系统，用于搭建博客与网站。

## 主要能力

- 主题与插件生态丰富。
- 文章、页面与媒体管理。
- 多用户与权限角色。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-wordpress` |
| 目标平台 | x86 |
| 外部依赖 | **外部 MySQL / MariaDB 数据库** |

## 运行身份

容器以**包用户**（`${TRIM_UID}:${TRIM_GID}`）运行，而非镜像默认的 root。

该镜像的 `docker-entrypoint.sh` 仅在目录属主为 `root:root` 时才执行 `chown`（其注释明确说明这一点），且两处 `chown` 都带 `|| true` 容错；本应用的数据目录属主是包用户，**该分支不会触发**。

容器内 80 端口在非 root 下可绑定。若运行中遇到 Apache 的 pid/日志目录写入失败，请反馈——该风险已登记但**未经真机确认**。

## 安装与使用

安装时设置 Web 访问端口，并填写数据库连接信息。

数据库需用户自备：安装时分别填写**数据库地址、端口、库名、用户名与密码**。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**存储说明**：站点文件与上传的媒体保存在应用数据目录中（目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。）；**数据库内容保存在你所提供的实例中，卸载时请自行处理**。

## 高级配置

本应用有一个**单文件挂载** `data/conf/uploads.ini`（对应容器内 `/usr/local/etc/php/conf.d/uploads.ini`），安装时 `cmd/install_callback` 会写入一份**最小可用配置**（`app/seed/`，本项目自行编写），用于设置上传大小与执行时间限制。如需调整，编辑该文件后重启应用。

## 相关链接

- [上游项目](https://github.com/WordPress/WordPress)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-wordpress)
