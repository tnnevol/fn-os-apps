<AppIcon name="fn-filebrowser" alt="File Browser 图标" />

# File Browser

## 应用简介

File Browser 是网页文件浏览器，在浏览器中管理、上传、预览与编辑指定目录下的文件。

## 主要能力

- 浏览与管理指定目录下的文件。
- 支持上传、下载、重命名与在线编辑。
- 多用户与目录级权限控制。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-filebrowser` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开登录（初始账号密码见应用日志），再按需创建用户。

可浏览的目录、配置与数据库分别保存在目标 NAS 应用数据目录下的 `mnt`、`config`、`database` 子目录中，卸载时选择「保留数据」可在重装后恢复。

## 高级配置

### 修改「可浏览目录」

上游允许通过向导字段 `MOUNT_PATH` 让用户填写任意宿主路径，但 fnOS 上无法校验该路径是否存在、也不受应用权限约束，因此本应用**固定**为 `${TRIM_PKGVAR}/data/mnt`（对应容器内 `/srv`）。

这**削弱了「浏览我指定的目录」这一核心能力**。如需让 File Browser 管理其它目录，请修改本应用的 `app/docker/docker-compose.yaml`：

```yaml
volumes:
  # 把下面这一条替换为你希望浏览的目录（目标 NAS 上的绝对路径）
  - "/vol1/1000/我的文档:/srv"
```

修改后重新打包安装即可。**也可关注后续版本**：本项目计划为「用户需要直接看到/导入/导出的数据」引入 `data-share` 机制（由用户在安装时授权目录），届时本应用会改为让用户授权而非固定路径。

## 相关链接

- [上游项目](https://github.com/filebrowser/filebrowser)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-filebrowser)
