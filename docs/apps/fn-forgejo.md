<AppIcon name="fn-forgejo" alt="Forgejo 图标" />

# Forgejo

## 应用简介

Forgejo 是轻量的自托管 Git 服务，提供代码托管、Issue 与 CI 集成。

## 主要能力

- Git 仓库托管与 Web 浏览。
- Issue、Pull Request 与代码评审。
- 用户、组织与权限管理。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-forgejo` |
| 目标平台 | x86 |
| 外部依赖 | **外部 MySQL / MariaDB / PostgreSQL 数据库** |

## 安装与使用

安装时设置 Web 访问端口、**SSH 端口**，填写数据库连接信息（地址、端口、库名、用户名、密码分开填写）。

**数据库需用户自备**。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**数据库类型只提供两项**：`MySQL / MariaDB` 与 `PostgreSQL`。**MariaDB 请选第一项**——Forgejo 的配置项只接受 `mysql`/`postgres` 等值，MariaDB 由 `mysql` 驱动承载，不存在独立的 `mariadb` 类型。

**SSH 端口为非 HTTP**（不建桌面入口），供 `git clone git@...` 使用。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 高级配置

### 镜像版本

本应用使用 `codeberg.org/forgejo/forgejo:16.0.5`，**仅提供非 rootless 版本**。

上游编排通过 `${IMAGE}` 变量取镜像，该变量由其 `scripts/init.sh` 写入 `.env`；fnOS 没有该预启动钩子，因此本应用直接在编排中写死上游登记的版本标签，不依赖 `.env` 机制。

### 数据目录

`data` 对应容器内 `/data`；另有两个子目录 `data/data-rootless/forgejo`（`/var/lib/gitea`）与 `data/data-rootless/conf`（`/etc/gitea`），层级与上游一致。

## 相关链接

- [上游项目](https://codeberg.org/forgejo/forgejo)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-forgejo)
