<AppIcon name="fn-discuz" alt="Discuz! 图标" />

# Discuz!

## 应用简介

Discuz! 是经典的社区论坛系统，支持版块、用户组与插件扩展。

## 主要能力

- 传统论坛的版块与主题体系。
- 用户组与积分权限。
- 插件与模板扩展。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-discuz` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口与 HTTPS 端口。安装完成后从应用中心打开并完成论坛安装向导。

**HTTPS 端口需要证书才能使用**：证书需你自备或在反向代理上终结 TLS。

**存储说明**：上游使用 Docker 托管命名卷，数据落在 Docker 数据目录、且卸载时不在本应用清理范围内；转换为绑定挂载到应用数据目录后，卸载时选择「删除数据」可一并清理。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/tencentci/discuz)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-discuz)
