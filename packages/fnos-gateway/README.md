# @tnnevol/fnos-gateway

飞牛 fnOS 统一网关代理工具包。基于 `connect` 与 `http-proxy-middleware`，用 tsdown 打包成单个 ESM 文件，供 FPK 应用直接分发。

## 用途

替换 FPK 应用中直接使用 `node:http` 实现的网关代理。打包后产物包含所有三方依赖，FPK 不需要在 NAS 上执行 `npm install`。

## 包结构

```text
packages/fnos-gateway/
├── src/
│   ├── index.ts              # 库入口：导出 createGateway
│   ├── cli.ts                # FPK 入口：读取环境变量并启动网关
│   ├── client/
│   │   └── bridge.ts         # bridge 源码，编译为 lib/client/bridge.js
│   ├── config/
│   │   ├── bridge-config.ts  # bridge 注入配置
│   │   └── dsh-web-args.ts   # DSH Web 启动参数
│   ├── constants/
│   │   └── index.ts          # 共享常量
│   ├── middleware/
│       ├── path-rewrite.ts   # 路径前缀剥离
│       ├── request-headers.ts # loopback 头注入
│       ├── response-headers.ts # hop-by-hop 剥离
│       ├── sse-keepalive.ts  # SSE 心跳
│       └── content-rewrite.ts # HTML/CSS/JS 改写
│   ├── server/
│   │   ├── bridge-script.ts   # 客户端 bridge 注入脚本
│   │   ├── gateway-server.ts  # Unix Socket + connect 服务
│   │   ├── path-allowlist.ts  # 代理路径白名单
│   │   ├── proxy.ts           # http-proxy-middleware 配置
│   │   ├── recovery-page.ts   # DSH Web 故障恢复页
│   │   └── web-process.ts     # DSH Web 进程控制
│   └── types/
│       ├── gateway.ts         # 网关类型定义
│       └── virtual.d.ts       # 虚拟模块声明
├── package.json
├── tsconfig.json
├── tsdown.bridge.config.ts   # 客户端 bridge 构建入口
├── tsdown.config.ts          # 库构建配置
└── tsdown.app.config.ts      # FPK 构建配置（输出到 apps/fn-deepseek-harness/app）
```

## 构建

```bash
# 构建库产物到 lib/
pnpm --filter @tnnevol/fnos-gateway run build

# 构建 FPK 入口到 apps/fn-deepseek-harness/app/gateway-proxy.mjs
pnpm --filter @tnnevol/fnos-gateway run build:app
```

`build:bridge` 会先将 `src/client/bridge.ts` 编译为 `lib/client/bridge.js`，随后网关构建读取该产物并将其注入 FPK Web 页面。`lib/` 属于构建产物，不应直接编辑。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `GATEWAY_SOCKET` | `/var/apps/fn-deepseek-harness/target/app.sock` | Unix Socket 路径 |
| `GATEWAY_PREFIX` | `/app/fn-deepseek-harness` | 网关前缀 |
| `DSH_UPSTREAM_HOST` | `127.0.0.1` | 上游 DSH 地址 |
| `DSH_UPSTREAM_PORT` | `3080` | 上游 DSH 端口 |

## FPK 集成

`build:app` 命令会输出 `apps/fn-deepseek-harness/app/gateway-proxy.mjs`，该文件包含所有依赖，可直接随 FPK 分发。`cmd/main` 通过 `node gateway-proxy.mjs` 启动网关。
