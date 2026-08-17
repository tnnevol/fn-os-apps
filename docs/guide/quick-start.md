# 快速开始

## 开发环境

项目根目录的 `package.json` 声明了开发工具版本约束：

| 工具 | 要求 |
| --- | --- |
| Node.js | `>=22.23.0` |
| pnpm | `>=11.16.0` |
| fnpack | 按飞牛官方文档安装 |

fnOS 设备侧还需要安装应用声明的运行时或中间件依赖，例如 Node.js、Python、Redis 等。

## 获取项目

```bash
git clone https://github.com/tnnevol/fn-os-apps.git
cd fn-os-apps
pnpm install
```

## 启动文档站

```bash
pnpm run docs:dev
```

默认会启动本地开发服务器，修改 `docs/` 下的 Markdown 后页面会自动更新。

## 构建应用

先按照 [fnpack 打包](../build/fnpack) 安装 `fnpack`，然后进入具体应用目录：

```bash
cd apps/<appname>
fnpack build
```

如果应用提供了 `build` 包装脚本，也可以执行：

```bash
./build
```

## 安装到 fnOS

在 fnOS 设备上可以使用本地安装方式测试：

```bash
cd /path/to/<appname>
appcenter-cli install-local
```

需要分发安装包时，使用生成的 `.fpk` 文件，通过应用中心手动安装或执行：

```bash
appcenter-cli install-fpk <appname>.fpk
```
