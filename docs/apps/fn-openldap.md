<AppIcon name="fn-openldap" alt="OpenLDAP 图标" />

# OpenLDAP

## 应用简介

OpenLDAP 是 LDAP（轻量级目录访问协议）的开源实现，为各类系统提供统一的账号与目录服务。

## 主要能力

- 提供标准 LDAP 目录服务。
- 统一管理用户、组与权限条目。
- 可被其它系统作为认证后端接入。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-openldap` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 LDAP 监听端口、baseDN 与管理员账号密码。**本应用没有 Web 管理界面**，安装后在需要使用目录服务的应用中填写本机地址与端口（默认 1389）即可。目录数据库保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游官网](https://openldap.org)
- [上游项目](https://github.com/openldap/openldap)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-openldap)
