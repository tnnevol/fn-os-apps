<AppIcon name="fn-tomcat" alt="Apache Tomcat 图标" />

# Apache Tomcat

## 应用简介

Apache Tomcat 是开源的 Web 服务器与 Servlet 容器，用于运行 Java Web 应用。

## 主要能力

- 运行 Java Servlet 与 JSP 应用。
- 提供管理界面用于部署应用。
- 支持虚拟主机与连接器配置。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-tomcat` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，并填写 **Tomcat 管理密码**（上游默认值是弱占位符，请自行设置）。安装完成后从应用中心打开即可；如需部署自己的应用，把 WAR 包放入应用数据目录对应位置后重启应用。数据保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/apache/tomcat)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-tomcat)
