# fnpack 打包

`fnpack` 是飞牛应用打包工具，用于将应用目录构建为 `.fpk` 安装包。

## 安装

请从[飞牛 fnpack 文档](https://developer.fnnas.com/docs/cli/fnpack/)下载适合开发机的版本，并将可执行文件放入 `PATH`。

验证安装：

```bash
fnpack --help
```

## 构建单个应用

```bash
cd apps/<appname>
fnpack build
```

构建产物会生成在当前应用目录中。`.fpk` 文件默认被 Git 忽略，不应提交到仓库。

## 构建包装脚本

部分应用提供 `./build` 脚本，用于在调用 `fnpack build` 前完成版本递增、环境准备或构建失败后的回滚。使用前先阅读对应应用 README，确认脚本是否会修改版本号。

## 本地安装测试

在 fnOS 设备上进入应用目录执行：

```bash
appcenter-cli install-local
```

需要复现安装包行为时，使用：

```bash
appcenter-cli install-fpk <appname>.fpk
```
