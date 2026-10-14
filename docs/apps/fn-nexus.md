<AppIcon name="fn-nexus" alt="Nexus Repository 图标" />

# Nexus Repository

## 应用简介

Sonatype Nexus 是制品仓库管理器，可托管 Maven、npm、Docker 等多种格式的依赖包。

## 主要能力

- 托管多种格式的制品仓库。
- 代理与缓存上游公共仓库。
- 提供权限与清理策略管理。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-nexus` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口与容器时区，安装完成后从应用中心打开并按向导创建管理员账号（初始密码查看容器日志）。制品库与配置保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复；**仓库会持续增长，请注意存储容量**。

## 相关链接

- [上游项目](https://github.com/sonatype/nexus-public)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-nexus)
