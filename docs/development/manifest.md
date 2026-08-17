# Manifest 配置

`apps/<appname>/manifest` 是 fnOS 应用的基础清单，使用 INI 风格的键值格式。

## 常用字段

| 字段 | 说明 |
| --- | --- |
| `appname` | 应用唯一标识，通常与应用目录名一致 |
| `version` | 应用版本号，由根目录 `bump` 脚本统一维护 |
| `display_name` | 应用中心显示名称 |
| `desc` | 应用描述 |
| `platform` | 目标架构，例如 `x86`、`arm` 或 `all` |
| `source` | 应用来源，第三方应用通常为 `thirdparty` |
| `maintainer` | 原始项目维护者 |
| `maintainer_url` | 原始项目地址 |
| `distributor` | 当前分发者 |
| `desktop_uidir` | 桌面入口 UI 目录 |
| `desktop_applaunchname` | 桌面启动项名称 |
| `install_dep_apps` | 应用依赖的运行时或中间件 |
| `os_min_version` | 最低 fnOS 版本 |
| `micro_app` | 是否作为微应用运行 |

## 版本约定

不要单独修改某个应用的版本来绕过项目版本流程。执行以下命令会同步更新根 `package.json`、所有应用 manifest 和 README 中的版本示例：

```bash
pnpm run bump:patch
# 或 pnpm run bump:minor / pnpm run bump:major
```

## 校验建议

修改 Manifest 后至少检查：

- `appname` 与目录名一致。
- `version` 是合法的三段式版本号。
- 依赖名称与 fnOS 应用中心可用的依赖一致。
- `desktop_uidir`、`desktop_applaunchname` 与实际入口文件一致。
