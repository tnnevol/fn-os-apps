<AppIcon name="fn-alist" alt="AList 图标" />

# AList

## 应用简介

AList 是多存储文件列表程序，把本地与云盘统一到一个界面管理。

## 主要能力

- 聚合多种存储（本地、对象存储、网盘）。
- 统一的文件浏览与直链。
- WebDAV 与 S3 兼容访问。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-alist` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口与 **S3 API 端口**（S3 为非 HTTP 协议，不建桌面入口）。安装完成后从应用中心打开并按向导设置管理员密码。

**权限说明**：上游默认以 `PUID=0`/`PGID=0`（即 root）运行，以获得更好的文件权限兼容性。按 fnOS 规范，本应用改为**以包用户运行**（`TRIM_UID`/`TRIM_GID`），`UMASK=022` 保留。**若遇到文件权限相关异常**，可在 `apps/fn-alist/app/docker/docker-compose.yaml` 中把 `PUID`/`PGID` 改回 `0`。

挂载两个目录：`data/data`（程序数据）与 `data/mnt`（本地存储挂载点）。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 高级配置

### 挂载本地目录到 AList

`data/mnt` 对应容器内 `/mnt/data`。如需让 AList 访问目标 NAS 上的其它目录，把内容放入应用数据目录的 `mnt` 子目录，或在 AList 后台以「本地存储」驱动指向容器内路径。

## 相关链接

- [上游项目](https://github.com/AlistGo/alist)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-alist)
