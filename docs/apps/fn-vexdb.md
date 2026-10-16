<AppIcon name="fn-vexdb" alt="VexDB 图标" />

# VexDB

## 应用简介

VexDB 是兼容 PostgreSQL 的向量数据库，支持向量检索与 SQL 查询。

## 主要能力

- 向量检索与相似度搜索。
- 兼容 PostgreSQL 协议与 SQL。
- 支持 pgvector 风格的数据类型。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-vexdb` |
| 目标平台 | x86 |
| 外部依赖 | 无（**数据库随应用一同安装**） |

## 安装与使用

安装时设置访问端口与**数据库管理员账号密码**。

**本应用自带数据库**：容器内的 5432 端口就是它自身的数据库服务，**无需外部数据库**。安装时会用你填写的凭据初始化数据库。

**凭据**：上游默认密码是弱占位符（`p@ssw0rd`），已改为必填且留空，请自行设置强口令。

**连接方式**：用任意 PostgreSQL 客户端连接目标 NAS 的该端口即可。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://www.vexdb.com)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-vexdb)
