<AppIcon name="fn-casdoor" alt="Casdoor 图标" />

# Casdoor

## 应用简介

Casdoor 是基于 OAuth 2.0 / OIDC 的身份认证与单点登录平台。

## 主要能力

- OAuth 2.0 / OIDC 单点登录。
- 用户、组织与权限管理。
- 多应用接入与令牌签发。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-casdoor` |
| 目标平台 | x86 |
| 外部依赖 | **外部数据库（MySQL / MariaDB / PostgreSQL）** |

## 安装与使用

安装时设置 Web 访问端口，选择**数据库类型**并填写**数据库 DSN**。

**DSN 格式必须与所选类型匹配，否则应用启动失败**：

- MySQL / MariaDB：`user:password@tcp(host:port)/`
- PostgreSQL：`user=X password=Y host=H port=P dbname=D sslmode=disable`

**转换说明**：上游用「驱动 + DSN」两个变量，但这两个变量由其 `scripts/init.sh` 生成；fnOS 没有该预启动钩子，因此改为由你直接填写 DSN。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 高级配置

配置目录以 `conf` 挂载（应用数据目录下的 `conf`），对应容器内 `/conf`。如需调整 Casdoor 的 `app.conf`，可在该目录下按官方文档修改后重启应用。

## 相关链接

- [上游项目](https://github.com/casdoor/casdoor)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-casdoor)
