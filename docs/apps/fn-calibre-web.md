<AppIcon name="fn-calibre-web" alt="Calibre-Web 图标" />

# Calibre-Web

## 应用简介

Calibre-Web 是基于浏览器的电子书库，管理 Calibre 书库并提供在线阅读。

## 主要能力

- 浏览、搜索电子书库。
- 在线阅读与格式转换。
- 多用户与书架管理。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-calibre-web` |
| 目标平台 | x86 |
| 外部依赖 | 无 |
| 用户数据 | 共享目录（文件管理器中可见） |

## 安装与使用

安装时设置 Web 访问端口与容器时区，安装完成后从应用中心打开并按提示完成初始化（首次需指定书库路径为 `/books`）。

**共享目录**：把电子书文件放入共享目录下的 `books` 子目录（在文件管理器中位于 `<存储卷>/@appshare/fn-<应用名>/books`）。

应用自身的配置/索引数据保存在应用私有数据目录（文件管理器中不可见），与你的媒体文件分开存放。（Calibre-Web 自身的数据库与配置在应用数据目录的 `data/config`。）

**权限说明**：上游以硬编码的 `PUID`/`PGID=1000` 运行。fnOS 上包用户的 UID 是动态分配的，固定 1000 会指向登录用户而非本应用包用户，故改为由 `TRIM_UID`/`TRIM_GID` 注入。**该镜像为 linuxserver 系 s6-overlay，以 root 启动后再按 PUID/PGID 降权**，因此未覆写 `user:`。

## 共享目录结构

| 用途 | 共享目录下的子目录 | 容器内路径 |
| --- | --- | --- |
| 电子书库 | `books` | `/books` |

### 书库格式说明

Calibre-Web 通常读取 **Calibre 生成的书库目录**（含 `metadata.db`）。你也可以直接把电子书文件放入 `books` 目录，但部分功能（元数据、封面）需要 Calibre 的库结构。

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

- [上游项目](https://github.com/linuxserver/docker-calibre-web)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-calibre-web)
