<AppIcon name="fn-twenty" alt="Twenty 图标" />

# Twenty

## 应用简介

Twenty 是现代开源 CRM，提供销售流程、联系人与机会管理。

## 主要能力

- 联系人与公司管理。
- 销售机会与流程看板。
- 自定义字段与视图。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-twenty` |
| 目标平台 | x86 |
| 外部依赖 | **外部 PostgreSQL + Redis** |

## 安装与使用

安装时设置 Web 访问端口，填写**站点访问地址**、**应用密钥**、数据库连接信息与 **Redis 地址/密码**。

**数据库需用户自备**：安装时填写数据库连接信息。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**站点访问地址**上游默认是占位符 `<YOUR IP>`，已改为必填；填错会导致页面跳转与资源加载异常。

**多容器**：本应用包含主服务 `fn-twenty` 与后台任务进程 `fn-twenty-worker`（无端口），两者都需要运行。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/twentyhq/twenty)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-twenty)
