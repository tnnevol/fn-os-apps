# fnOS Apps

飞牛 fnOS 应用 Monorepo。

> **不再维护 dsh 应用。** 飞牛 DeepSeek Harness 应用请到
> [FNOSP/fnos-dsh](https://github.com/FNOSP/fnos-dsh) 安装。

## 这是什么

一个**由 agent 驱动**的应用转换流水线：把各开源项目中的 Web 应用，转换成飞牛 fnOS 原生的应用包（FPK），使其能在 fnOS 应用中心安装、启停与升级。

**当前的转换源是 [1Panel 应用商店](https://github.com/1Panel-dev/appstore)（265 个应用）。** 转换遵循
[转换规约](https://fnapps-doc.tnnevol.cn/development/1panel-conversion)，分级批量推进：

| 批次 | 含义 | 规模 |
| --- | --- | --- |
| T0 | 直接套模板（单容器单端口、无状态） | 14 |
| T1 | 状态落盘改造（数据落目标 NAS） | 125 |
| T2 | 资源集成改造（需外部数据库或中间件） | 47 |

转换过程与踩坑记录见[转换规约](https://fnapps-doc.tnnevol.cn/development/1panel-conversion)与
[经验教训](https://fnapps-doc.tnnevol.cn/development/1panel-conversion-lessons)。

## 应用

每个应用一个目录，产物是 `apps/<appname>/<appname>.fpk`。功能、依赖和安装说明见
[应用目录](https://fnapps-doc.tnnevol.cn/apps/)。

仓库同时是 [FnDepot](https://github.com/EWEDLCM/FnDepot) 外部应用源，可用根目录的
`fnpack.json` 直接添加为源，在客户端里安装这些应用。

## 许可

本仓库采用 [Apache License 2.0](./LICENSE)，与 [FNOSP/fnos-dsh](https://github.com/FNOSP/fnos-dsh) 一致。

各应用的著作权归其上游项目所有；本仓库只做打包与适配，不修改上游代码。
上游为 GPL-3.0 的部分（如 1Panel appstore）保持其原有许可，本仓库不将其源码并入本仓库。

## 开发

需要 Node 24 和 pnpm 11。

```bash
pnpm install
```

`start` 起本地开发服务，`build` 出产物，都能只选需要的部分，不带参数就弹多选。

```bash
pnpm run start -- --docs                            # 文档站，http://localhost:9876

pnpm run build -- --docs                            # 构建文档
pnpm run build -- --fpk --app fn-memos              # 构建 FPK
```

单个应用也可以在它自己的目录里跑 `./build`。

改完代码跑一遍检查。

```bash
pnpm run check -- --all
```

## 版本

项目版本由 `bumpp` 处理，更新根 `package.json`、`docs/package.json`、`apps/*/manifest`
和文档里的版本示例，然后建一条提交加 `v<版本号>` tag。

```bash
pnpm run version -- patch
```

可以加 `--no-commit --no-tag`，只改文件不提交。tag 推上去之后 GitHub Actions 会构建 FPK
并发布 Release。

## 本地安装

在 fnOS 设备上进到应用目录直接装。

```bash
cd apps/<appname>
appcenter-cli install-local
```

或者用构建好的 fpk 文件。

```bash
appcenter-cli install-fpk <appname>.fpk
```

## 开发资源

- [飞牛开发者官网](https://developer.fnnas.com/)
- [fnpack 下载](https://developer.fnnas.com/docs/cli/fnpack/)
- [通用 CGI 网关合集](https://github.com/FNOSP/fnosAppCenterCgiCollection)
