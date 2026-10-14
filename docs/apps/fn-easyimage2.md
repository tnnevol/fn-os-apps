<AppIcon name="fn-easyimage2" alt="EasyImage 2.0 图标" />

# EasyImage 2.0

## 应用简介

EasyImage 是简洁的自托管图床，支持多种存储后端与图片管理。

## 主要能力

- 上传与管理图片，生成外链。
- 支持本地与多种云存储后端。
- 提供 API 便于批量上传。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-easyimage2` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口与容器时区，安装完成后从应用中心打开并完成初始化（默认账号密码见应用日志）。

配置与图片数据分别保存在应用数据目录的 `config`、`i` 子目录中。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/ddsderek/easyimage)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-easyimage2)
