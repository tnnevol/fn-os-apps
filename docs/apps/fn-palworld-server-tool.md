<AppIcon name="fn-palworld-server-tool" alt="幻兽帕鲁服务器工具图标" />

# 幻兽帕鲁服务器工具

## 应用简介

Palworld Server Tool 用于查看与管理幻兽帕鲁服务器的存档与玩家数据。

## 主要能力

- 解析并查看帕鲁服务器存档。
- 管理玩家数据与公会信息。
- 支持定时备份存档。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-palworld-server-tool` |
| 目标平台 | x86 |
| 额外依赖 | 无（需自行准备帕鲁服务器存档） |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开并添加服务器。

工具自身的数据库、配置库与备份分别保存在应用数据目录的 `data/data/pst.db`、`data/data/config.db`、`data/data/backups` 中，前两个文件安装时被预创建为**空文件**（这两个文件由应用**自动初始化**，无需预置内容）。帕鲁存档目录见下方「高级配置」。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 高级配置

### 修改帕鲁存档目录

上游允许通过向导字段 `PALWORLD_SAVE_PATH` 让用户填写任意宿主路径（默认值甚至是 1Panel 专有路径 `/opt/1panel/...`）。fnOS 上无法校验该路径，因此本应用**固定**为 `${TRIM_PKGVAR}/data/save`（对应容器内 `/app/save`）。

如需读取真实的帕鲁服务器存档，请修改本应用的 `app/docker/docker-compose.yaml`：

```yaml
volumes:
  # 把下面这一条替换为帕鲁存档在目标 NAS 上的实际绝对路径
  - "/vol1/1000/games/Pal/Saved:/app/save"
```

修改后重新打包安装即可。**也可关注后续版本**：本项目计划为「用户需要直接看到/导入/导出的数据」引入 `data-share` 机制（由用户在安装时授权目录）。

## 相关链接

- [上游项目](https://github.com/zaigie/palworld-server-tool)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-palworld-server-tool)
