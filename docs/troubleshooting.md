# 问题排查

## 文档站无法启动

确认 Node.js 和 pnpm 版本满足根 `package.json` 的要求，并重新安装依赖：

```bash
node --version
pnpm --version
pnpm install
pnpm run docs:dev
```

## fnpack 找不到

```bash
command -v fnpack
fnpack --help
```

如果没有输出，请按照 [fnpack 打包](./build/fnpack) 安装并配置 `PATH`。

## 应用安装失败

先查看 fnOS 应用安装日志，再检查：

- `manifest` 中的依赖是否已安装。
- `cmd/install_callback` 是否返回非零状态。
- 安装向导字段是否缺失或格式不正确。
- 应用依赖的 npm、Python、镜像或中间件是否可访问。

## 应用无法启动

重点检查：

- `cmd/main` 使用的环境变量和目录是否存在。
- 服务监听端口是否被其他进程占用。
- 应用运行时版本是否与 `install_dep_apps` 一致。
- 应用日志中是否出现权限、路径或依赖加载错误。

## iframe 页面资源异常

如果页面能打开但静态资源、API 或 EventSource 失败，检查 `app/ui/config`、统一网关前缀以及应用代理对以下路径的处理：

- `/api`
- `/plugins`
- `/plugins/events`

同时确认浏览器开发者工具中的响应类型与请求路径，避免将 API 或 SSE 请求错误返回为 HTML。
