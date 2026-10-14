<AppIcon name="fn-phpmyadmin" alt="phpMyAdmin 图标" />

# phpMyAdmin

## 应用简介

phpMyAdmin 是基于浏览器的 MySQL/MariaDB 管理工具，可管理数据库、表与执行 SQL。

## 主要能力

- 图形化管理数据库、表与索引。
- 执行 SQL 语句并导出查询结果。
- 支持连接任意可达的 MySQL/MariaDB 实例。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-phpmyadmin` |
| 目标平台 | x86 |
| 额外依赖 | 无（被管理的数据库由用户自行提供） |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开，填写要连接的主机、用户名与密码即可（本应用不内置数据库）。

数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 高级配置

本应用有**两个单文件挂载**：安装时 `cmd/install_callback` 会从应用自带的**最小可用配置**（`app/seed/`，本项目自行编写）拷贝一份到应用数据目录。**这些文件已含可用的默认内容，不影响启动**，如需自定义请编辑目标 NAS 应用数据目录下的这两个文件：

| 文件（应用数据目录下） | 容器内路径 | 用途 |
| --- | --- | --- |
| `data/conf.d/uploads.ini` | `/usr/local/etc/php/conf.d/uploads.ini` | PHP 配置，例如调大 `upload_max_filesize`、`post_max_size` |
| `data/conf.inc/config.user.inc.php` | `/etc/phpmyadmin/config.user.inc.php` | phpMyAdmin 自定义配置片段，例如预设多个服务器 |

**安装后再修改**：`install_callback` 只在文件不存在或为空时写入种子内容，用户已修改的文件不会被覆盖。改完后重启应用生效。

## 相关链接

- [上游项目](https://github.com/phpmyadmin/phpmyadmin)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-phpmyadmin)
