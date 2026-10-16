<AppIcon name="fn-komga" alt="Komga 图标" />

# Komga

## 应用简介

Komga 是漫画与电子书服务器，提供书架管理、阅读进度与元数据整理。

## 主要能力

- 漫画/电子书书架管理。
- 阅读进度与多用户。
- 元数据与系列自动整理。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-komga` |
| 目标平台 | x86 |
| 外部依赖 | 无（内置 SQLite，数据落在应用数据目录） |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开并按提示创建管理员账号。

**书库目录**：把漫画或电子书放入应用数据目录的 `data`（容器内 `/data`），然后在 Komga 中把该路径添加为书库。配置与内置数据库在 `data/config`（容器内 `/config`）。

**运行身份**：本应用以目标 NAS 的包用户（非 root）运行。（上游编排中有一行被注释掉的 `user: "1000:1000"` 提示，方向与此一致。）

数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 关于应用图标

本应用的图标是 **48×48 放大而来**，在高分屏下可能略显模糊。**原因**：上游提供的图标是 **ICO 格式**（内含 16×16、32×32、48×48 三种尺寸，**48×48 已是其中最大**），没有更高分辨率的来源，因此无法获得更清晰的图标。这与 `miniflux`、`browserless` 等应用的情况同类。

### 转换先例（供维护者参考）

上游的 `logo.png` 实际是 **ICO 格式**（文件扩展名为 `.png` 但内容以 `00 00 01 00` 开头）。本项目的图标管线（jimp）不支持 ICO，处理方式是先用 `ffmpeg` 转成 PNG：

```bash
# 关键：必须先复制成 .ico 扩展名 —— ffmpeg 依据扩展名探测输入格式，
# 直接对名为 logo.png 的 ICO 文件执行会报 “Invalid PNG signature” 而失败。
cp appstore/apps/komga/logo.png /tmp/up/komga.ico
ffmpeg -y -i /tmp/up/komga.ico /tmp/up/komga/logo.png
# 再让图标脚本从转换后的目录读取（不修改上游文件）
node scripts/generate-icons.mjs komga --upstream /tmp/up
```

**注意**：同样是「扩展名与实际格式不符」，`redis-commander` 的 WebP 图标**不需要**改扩展名（WebP 的 magic bytes 能被正确识别），**只有 ICO 有这个坑**。

## 相关链接

- [上游项目](https://github.com/gotson/komga)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-komga)
