<AppIcon name="fn-domain-admin" alt="Domain Admin 图标" />

# Domain Admin

## 应用简介

Domain Admin 是域名与 SSL 证书监测平台，集中跟踪多个域名的到期时间。

## 主要能力

- 批量监测域名与证书到期时间。
- 到期前通过邮件等方式提醒。
- 记录域名解析与证书变更历史。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-domain-admin` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开并添加要监测的域名。数据库与日志保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/mouday/domain-admin)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-domain-admin)
