<AppIcon name="fn-mongo-express" alt="Mongo Express 图标" />

# Mongo Express

## 应用简介

Mongo Express 是基于 Web 的 MongoDB 管理界面，用于浏览集合与执行查询。

## 主要能力

- 浏览数据库、集合与文档。
- 执行查询与聚合。
- 基础的文档增删改。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-mongo-express` |
| 目标平台 | x86 |
| 外部依赖 | **外部 MongoDB** |

## 安装与使用

安装时设置 Web 访问端口，填写 **MongoDB 地址与端口**、**MongoDB 管理员凭据**，以及**本界面的登录账号密码**。

**本应用只是 MongoDB 的管理界面，不包含 MongoDB 本身**——连接失败时页面会提示无法连接。

**为什么需要管理员凭据**：管理界面需要读写任意数据库，普通账号权限不足。

**界面登录密码**：上游默认值是弱占位符（与应用名相同），已改为必填且留空，请自行设置。

## 相关链接

- [上游项目](https://github.com/mongo-express/mongo-express)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-mongo-express)
