<AppIcon name="fn-photoprism" alt="PhotoPrism 图标" />

# PhotoPrism

## 应用简介

PhotoPrism 是 AI 驱动的照片管理工具，支持自动分类、人脸识别与 RAW 转换。

## 主要能力

- AI 自动分类与标签。
- 人脸识别与相册整理。
- RAW 转换与视频转码。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-photoprism` |
| 目标平台 | x86 |
| 外部依赖 | **外部 MySQL / MariaDB** |

## 安装与使用

安装时设置 Web 访问端口，填写**管理员账号密码**、**站点访问地址**与数据库连接信息。

**数据库需用户自备**：安装时填写数据库连接信息。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**权限说明**：上游以 `UID`/`GID`（默认 1000）指定运行身份。fnOS 上包用户的 UID 是动态分配的，固定 1000 会指向登录用户而非本应用包用户，故改为由 `TRIM_UID`/`TRIM_GID` 注入。

**照片目录**：原始照片存放在应用数据目录的 `data/Pictures`（容器内 `/photoprism/originals`），索引与缩略图存放在 `data/storage`。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 高级配置

### 如何把已有照片库提供给它

原始照片目录默认落在应用数据目录中，你可以用以下任一方式放入照片：

1. 通过 PhotoPrism 的 Web 界面上传。
2. 把照片复制到应用数据目录下的 `data/Pictures`（该路径可在应用安装后于应用中心查看）。
3. 熟悉命令行的用户可自行修改 `apps/fn-photoprism/app/docker/docker-compose.yaml`，把 `originals` 的挂载源改为目标 NAS 上已有的照片目录，然后重启应用。**注意**：修改挂载源后需确保容器内进程对该目录有读权限。

### 硬件加速

如需启用 Intel QSV / NVIDIA 硬件转码，可自行在编排中补充 `devices` 段（上游模板中有示例）。**该能力未经真机验证。**

## 相关链接

- [上游项目](https://github.com/photoprism/photoprism)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-photoprism)
