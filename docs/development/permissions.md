# 权限与入口

权限和桌面入口决定了应用“以谁运行、能访问什么、用户如何打开”。配置修改必须同时考虑 `config/privilege`、`config/resource`、`app/ui/config`、Manifest 和应用实际服务。

> 涉及权限字段、入口字段或统一网关行为时，先查阅 [`fnnas-docs` Skill](https://github.com/tnnevol/skills/tree/main/skills/fnnas-docs) 的 privilege、resource、app-entry 和 gateway 参考。

## 运行权限

`config/privilege` 使用 JSON 声明应用运行用户和用户组。推荐从最小权限开始：

```json
{
  "defaults": {
    "run-as": "package"
  },
  "username": "fn-memos",
  "groupname": "fn-memos"
}
```

| 配置 | 说明 |
| --- | --- |
| `defaults.run-as` | 默认以应用包身份运行，避免使用 root |
| `username` | 应用运行用户；应与应用资源和脚本约定一致 |
| `groupname` | 应用运行用户组；不要复用无关应用的组 |

权限设计原则：

- 只授予服务实际需要的目录和能力。
- 安装目录尽量只读，运行时写入 `${TRIM_PKGVAR}` 或声明的资源目录。
- 生命周期脚本、应用进程和网关代理使用同一套用户/目录假设。
- 不通过放宽权限解决路径或端口配置错误。
- 升级和卸载时保留用户数据的边界必须明确记录。

## 资源声明

共享目录、配置目录和持久化数据应在 `config/resource` 声明，并在应用文档中解释用途。声明、脚本实际写入路径和 `wizard/uninstall` 的删除策略必须一致。

检查资源时关注：

1. 应用是否只写入已声明或明确允许的目录。
2. 资源是否应在升级时保留。
3. 卸载时用户是否可以选择保留数据。
4. 多用户访问是否会造成越权读取或写入。

## 桌面入口

入口配置位于 `app/ui/config`，通常使用 `.url` 对象和与 Manifest 一致的入口 ID：

```json
{
  ".url": {
    "fn-memos.main": {
      "title": "Memos",
      "icon": "images/icon_{0}.png",
      "type": "iframe",
      "protocol": "http",
      "port": "${wizard_port}",
      "url": "/",
      "allUsers": false
    }
  }
}
```

| 字段 | 作用 | 注意事项 |
| --- | --- | --- |
| `title` | 桌面显示名称 | 与 Manifest 的用户可见名称保持一致 |
| `icon` | 图标资源路径 | 相对 `desktop_uidir` 对应目录检查实际文件 |
| `type` | `url` 或 `iframe` | 根据独立页面或嵌入式页面选择 |
| `protocol` / `port` | 服务连接方式和端口 | 与 Manifest、向导和 `cmd/main` 一致 |
| `url` | 应用路径 | 网关、静态资源和 API 路径要一起验证 |
| `allUsers` | 是否允许所有用户访问 | 默认按最小权限设置为受限访问 |

`iframe` 适合需要保留 fnOS 上下文、统一主题或统一网关的 Web 应用；`url` 适合跳转到应用提供的独立地址。不要只改入口类型而不验证登录、静态资源和 API 请求。

## 网关和访问控制

使用统一网关或 iframe 时，至少验证：

- 服务监听地址和端口在应用启动后真实可用。
- 网关前缀、静态资源路径和 `/api` 路径不会重复拼接或丢失。
- SSE、WebSocket、EventSource 请求不会被错误重写为 HTML。
- `allUsers`、授权路径开关和应用自身登录策略没有冲突。
- 管理入口与普通用户入口分离，敏感操作需要额外权限。
- 错误页面不泄露内部路径、Token、DSN 或环境变量。

三方 API URL 反代等能力应由受控配置驱动，使用白名单和规范化路径；不要接受任意 URL 作为代理目标。

## 配置联动检查

修改权限或入口后执行：

```bash
pnpm run check -- --all
cd apps/<appname>
fnpack build
```

在测试 NAS 上完成：

```bash
appcenter-cli install-local
appcenter-cli start <appname>
```

分别使用管理员、授权用户和无权限用户验证入口可见性、目录访问、API 请求、文件上传/打开、应用停止和卸载。涉及升级时还要确认资源和用户配置不被意外删除。

相关页面：

- [Manifest 配置](./manifest)
- [生命周期脚本](./lifecycle)
- [用户向导](./wizard)
- [开发环境与脚本](./environment-and-scripts)
- [Package 任务与 Turbo](./package-tasks-and-turbo)
