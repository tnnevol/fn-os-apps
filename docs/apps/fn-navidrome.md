<AppIcon name="fn-navidrome" alt="Navidrome 图标" />

# Navidrome

## 应用简介

Navidrome 是轻量音乐服务器，支持按标签自动整理音乐库与多端播放。

## 主要能力

- 按标签自动整理音乐库。
- 支持 Subsonic / OpenSubsonic 协议的客户端。
- 播放列表与收藏。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-navidrome` |
| 目标平台 | x86 |
| 外部依赖 | 无 |
| 用户数据 | 共享目录（文件管理器中可见） |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开并按提示创建管理员账号。

**共享目录**：把音乐文件放入共享目录下的 `music` 子目录（在文件管理器中位于 `<存储卷>/@appshare/fn-<应用名>/music`）。该目录以**只读**方式挂载（Navidrome 只扫描元数据、不改动你的音乐文件）。

应用自身的配置/索引数据保存在应用私有数据目录（文件管理器中不可见），与你的媒体文件分开存放。（数据库与缓存保存在应用数据目录的 `data`。）

## 共享目录结构

| 用途 | 共享目录下的子目录 | 容器内路径 | 挂载方式 |
| --- | --- | --- | --- |
| 音乐库 | `music` | `/music` | 只读 |

> **关于共享目录路径（如实说明，尚未真机验证）**
>
> 本应用的共享目录通过 `${TRIM_APPDEST_VOL}/@appshare/fn-<应用名>/` 挂载。其中 `TRIM_APPDEST_VOL` 是飞牛 fnOS 提供的「应用安装所在的存储空间路径」变量，**但它在 compose 中的展开尚未经过真机验证**。
>
> - 若展开正常：共享目录位于你安装应用时选择的存储卷，例如安装在存储 4 时为 `/vol4/@appshare/fn-<应用名>/`。
> - 若该变量为空：路径会退化为 `/@appshare/...`，**容器仍能正常启动、应用也能运行，但数据会落到错误位置**（这是静默错误，不会报错）。
>
> 安装后可用以下命令自查（在目标 NAS 上执行）：
>
> ```bash
> docker inspect <容器名> --format '{{json .Mounts}}'
> ```
>
> 查看 `Source` 是真实路径还是 `/@appshare/...`。

## 相关链接

- [上游项目](https://github.com/navidrome/navidrome)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-navidrome)
