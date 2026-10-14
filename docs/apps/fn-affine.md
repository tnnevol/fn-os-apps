<AppIcon name="fn-affine" alt="AFFiNE 图标" />

# AFFiNE

## 应用简介

AFFiNE 是集成文档、白板与数据库的知识管理平台。

## 主要能力

- 文档、白板与表格一体化编辑。
- 本地优先的协作与同步。
- 知识库与页面组织。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-affine` |
| 目标平台 | x86 |
| 外部依赖 | **外部 PostgreSQL + Redis** |

## 安装与使用

安装时设置 Web 访问端口，填写数据库连接信息与 **Redis 地址**。

**数据库需用户自备**：安装时填写数据库连接信息。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**Redis 说明**：本应用把 Redis 拆成「地址」与「密码」两个配置项消费，因此向导提供地址而非连接串。应用依赖 fnOS 提供的 Redis，安装时会自动安装依赖应用。

**多容器**：本应用包含两个容器——主服务 `fn-affine` 与首次启动执行的数据库迁移任务 `fn-affine-migration`（一次性，执行完即退出，属正常现象）。

数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 高级配置

### 迁移容器

`fn-affine-migration` 只在首次启动（或版本升级）时运行数据库迁移，完成后容器状态为 `exited (0)`，**不是故障**。

## 相关链接

- [上游项目](https://github.com/toeverything/AFFiNE)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-affine)
