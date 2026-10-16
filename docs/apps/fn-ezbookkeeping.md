<AppIcon name="fn-ezbookkeeping" alt="ezBookkeeping 图标" />

# ezBookkeeping

## 应用简介

ezBookkeeping 是轻量记账工具，支持多账户、多币种与报表统计。

## 主要能力

- 多账户、多币种记账。
- 分类统计与图表报表。
- 支持导入导出与附件。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-ezbookkeeping` |
| 目标平台 | x86 |
| 外部依赖 | 无 |
| 用户数据 | 共享目录（文件管理器中可见） |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开并按提示创建账号。

**共享目录**：把导出的票据附件（需要你自己取走的文件）放入共享目录下的 `storage` 子目录（在文件管理器中位于 `<存储卷>/@appshare/fn-<应用名>/storage`）。

应用自身的配置/索引数据保存在应用私有数据目录（文件管理器中不可见），与你的媒体文件分开存放。（记账数据在应用数据目录的 `data/data`，运行日志在 `data/log`。）

**已删除的上游配置**：上游挂载了宿主机的 `/etc/localtime` 时区文件（只读），在飞牛 fnOS 上该宿主路径不可依赖，已删除。

**运行身份**：本应用镜像**默认即以非 root 用户（uid/gid 1000）运行**，因此未追加 `user:` 覆写。**注意**：该固定 uid 与 fnOS 为应用分配的包用户 uid 不同（属已登记的真机待验证项）。

## 共享目录结构

| 用途 | 共享目录下的子目录 | 容器内路径 |
| --- | --- | --- |
| 票据附件 | `storage` | `/ezbookkeeping/storage` |

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

- [上游项目](https://github.com/mayswind/ezbookkeeping)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-ezbookkeeping)
