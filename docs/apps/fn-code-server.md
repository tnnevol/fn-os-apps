<AppIcon name="fn-code-server" alt="code-server 图标" />

# code-server

## 应用简介

code-server 把 VS Code 运行在服务器上，通过浏览器即可获得完整的开发环境。

## 主要能力

- 在浏览器中使用完整的 VS Code。
- 集成终端、扩展与调试能力。
- 工作区文件保存在自有 NAS 上。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-code-server` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口、容器时区、**Web 访问密码**与**终端 sudo 密码**（两者请设置为自己的密码）。安装完成后从应用中心打开，输入 Web 访问密码即可进入编辑器。

容器以本应用的包用户身份读写数据目录（通过 `TRIM_UID`/`TRIM_GID` 传入），工作区与编辑器配置保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/coder/code-server)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-code-server)
