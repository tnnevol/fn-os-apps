<AppIcon name="fn-koodo-reader" alt="Koodo Reader 图标" />

# Koodo Reader

## 应用简介

Koodo Reader 是多格式电子书阅读器，支持 EPUB、PDF、MOBI 等格式的云端书库。

## 主要能力

- 支持 EPUB / PDF / MOBI / TXT 等格式。
- 书库管理与阅读进度同步。
- 批注、书签与主题。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-koodo-reader` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，填写**服务登录用户名与密码**，安装完成后从应用中心打开并登录。

**登录密码必须设置**：上游该字段默认为空，转换后保持**必填且留空**——**不设置密码等于让任何人访问你的书库**。

**运行身份**：本应用以目标 NAS 的包用户（非 root）运行。

上传的书籍保存在应用数据目录的 `data` 中。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/koodo-reader/koodo-reader)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-koodo-reader)
