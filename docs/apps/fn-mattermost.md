<AppIcon name="fn-mattermost" alt="Mattermost 图标" />

# Mattermost

## 应用简介

Mattermost 是面向团队的自托管协作平台，提供频道、私信与文件共享。

## 主要能力

- 频道、私信与线程讨论。
- 文件共享与搜索。
- 支持语音通话与集成扩展。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-mattermost` |
| 目标平台 | x86 |
| 外部依赖 | **外部 PostgreSQL 数据库** |

## 安装与使用

安装时设置 Web 访问端口、通话端口与容器时区，填写**站点访问地址**（如 http://192.168.1.10:40271，**填错会导致登录后跳转异常**）以及数据库连接信息。

**数据库需用户自备**：安装时填写数据库连接信息。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**注意**：本应用使用 **PostgreSQL**；数据库连接串由「类型 + 用户名密码 + 连接」拼接，因此数据库连接需按「地址:端口/库名」格式填写。

**安全设置**：保留上游的 `no-new-privileges` 与临时文件系统配置。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 高级配置

本应用包含 6 个数据子目录（`config`、`data`、`logs`、`plugins`、`client/plugins`、`bleve`），均以读写方式挂载到应用数据目录，层级与上游一致。

### 只读容器

上游提供 `MATTERMOST_CONTAINER_READONLY` 选项（只读根文件系统）。本应用固定为 `false`：在 fnOS 上启用只读根文件系统会让应用失去写入运行期临时文件的能力，未在真机验证前不开放该开关。

## 相关链接

- [上游项目](https://github.com/mattermost/mattermost)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-mattermost)
