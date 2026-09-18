# fnOS Apps

飞牛 fnOS 应用 Monorepo，把第三方应用打包成 fnOS 应用商店的 FPK。

> **不再维护 dsh 应用。** 飞牛 DeepSeek Harness 应用请到
> [FNOSP/fnos-dsh](https://github.com/FNOSP/fnos-dsh) 安装。

## 应用

14 个应用各自一个目录，产物是 `apps/<appname>/<appname>.fpk`。功能、依赖和安装说明见
[应用目录](https://fnapps-doc.tnnevol.cn/apps/)。

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
