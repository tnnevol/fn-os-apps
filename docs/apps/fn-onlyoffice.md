<AppIcon name="fn-onlyoffice" alt="ONLYOFFICE Docs 图标" />

# ONLYOFFICE Docs

## 应用简介

ONLYOFFICE Docs 是免费的在线办公套件，在浏览器中编辑文档、表格与演示文稿。

## 主要能力

- 在线编辑文字文档、表格与演示文稿。
- 支持多人协作与格式兼容。
- 提供接口供其它系统集成。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-onlyoffice` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，并填写 **JWT 密钥**（用于签发文档服务令牌，上游默认值是弱占位符，请自行设置一个唯一值）。安装完成后从应用中心打开即可使用。

日志、文档数据、运行库与内置数据库分别保存在目标 NAS 应用数据目录下的 `logs`、`data`、`lib`、`db` 子目录中，卸载时选择「保留数据」可在重装后恢复。**本应用占用空间较大，请预留足够容量。**

## 相关链接

- [上游项目](https://github.com/ONLYOFFICE/DocumentServer)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-onlyoffice)
