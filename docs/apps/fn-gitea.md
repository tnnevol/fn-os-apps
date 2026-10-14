<AppIcon name="fn-gitea" alt="Gitea 图标" />

# Gitea

## 应用简介

Gitea 是轻量的自托管代码托管平台，提供 Git 仓库、协作与 CI 集成。

## 主要能力

- 托管 Git 仓库，支持 HTTPS 与 SSH 拉取。
- 问题跟踪、合并请求与代码评审。
- 轻量，资源占用低。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-gitea` |
| 目标平台 | x86 |
| 外部依赖 | **外部 MySQL / PostgreSQL / MariaDB 数据库** |

## 安装与使用

安装时设置 Web 访问端口、**SSH 端口**与容器时区，并填写数据库连接信息。数据库地址与端口分开填写。

数据库需用户自备：安装时分别填写**数据库地址、端口、库名、用户名与密码**。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**SSH 端口**用于 Git over SSH，默认 222（容器内固定映射到 22）。

仓库数据保存在应用数据目录中（目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。）；**数据库内容保存在你所提供的实例中**。

## 高级配置

### 已删除的宿主挂载

上游编排里有两个宿主路径只读挂载：

```yaml
- /etc/timezone:/etc/timezone:ro
- /etc/localtime:/etc/localtime:ro
```

按转换规约「挂载源为宿主绝对路径一律删除」，它们**未随本应用提供**。**时区改由 `TZ` 环境变量（向导字段「时区」）提供**。

### 用户与权限

上游以硬编码的 `USER_UID`/`USER_GID=1000` 运行。fnOS 上包用户的 UID 是**动态分配**的，固定 1000 会指向登录用户而非本应用包用户，故改为由 `TRIM_UID`/`TRIM_GID` 注入。

## 相关链接

- [上游项目](https://github.com/commitgo/gitea-ee)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-gitea)
