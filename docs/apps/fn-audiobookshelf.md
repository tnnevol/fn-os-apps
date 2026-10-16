<AppIcon name="fn-audiobookshelf" alt="Audiobookshelf 图标" />

# Audiobookshelf

## 应用简介

Audiobookshelf 是有声书与播客服务器，支持多端同步收听进度。

## 主要能力

- 有声书与播客管理。
- 多端同步收听进度。
- 支持 iOS / Android 客户端。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-audiobookshelf` |
| 目标平台 | x86 |
| 外部依赖 | 无 |
| 用户数据 | 共享目录（文件管理器中可见） |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开并按提示创建管理员账号。

**共享目录**：把有声书音频文件放入共享目录下的 `audiobooks` 子目录（在文件管理器中位于 `<存储卷>/@appshare/fn-<应用名>/audiobooks`）。

**共享目录**：把播客音频文件放入共享目录下的 `podcasts` 子目录（在文件管理器中位于 `<存储卷>/@appshare/fn-<应用名>/podcasts`）。

应用自身的配置/索引数据保存在应用私有数据目录（文件管理器中不可见），与你的媒体文件分开存放。

## 共享目录结构

| 用途 | 共享目录下的子目录 | 容器内路径 |
| --- | --- | --- |
| 有声书 | `audiobooks` | `/audiobooks` |
| 播客 | `podcasts` | `/podcasts` |

**注意**：本应用在文件管理器中只占用**一个**共享目录（`fn-audiobookshelf`），两个用途是它下面的子目录——这样你打开一个共享目录就能看到全部内容。

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

- [上游项目](https://github.com/advplyr/audiobookshelf)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-audiobookshelf)
