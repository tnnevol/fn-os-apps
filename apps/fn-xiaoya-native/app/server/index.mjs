/**
 * 应用入口。
 *
 * 两种监听形态：
 * - 生产：飞牛统一网关把 `/app/fn-xiaoya-native` 的请求转发到 `${TRIM_APPDEST}/app.sock`；
 * - 开发：直接监听 TCP 端口，前端 Vite 代理到它，不需要任何飞牛环境变量。
 */
import { chmodSync, existsSync, rmSync } from 'node:fs'
import { createApp, createRouter } from './http/server.mjs'
import { serveStatic } from './http/static.mjs'
import { registerRoutes } from './routes/index.mjs'
import { ensureDirs, gatewaySocket, isDev } from './paths.mjs'
import { loadTasks } from './tasks/engine.mjs'

/** 启动服务。 */
async function main() {
  ensureDirs()
  // 恢复上次的任务列表：运行中的任务会被标成中断，避免面板显示假状态
  loadTasks()

  const router = createRouter()
  registerRoutes(router)
  const app = createApp({ router, staticHandler: serveStatic })

  if (isDev) {
    const port = Number(process.env.XIAOYA_PORT ?? 5274)
    const host = process.env.XIAOYA_HOST ?? '127.0.0.1'
    app.listen(port, host, () => {
      console.log(`[fn-xiaoya-native] 开发模式已启动：http://${host}:${port}`)
      console.log(`[fn-xiaoya-native] 数据目录：${process.env.XIAOYA_DATA_DIR ?? '(默认 ~/.fn-xiaoya-native)'}`)
    })
    return
  }

  // 生产：清理上一轮遗留的 socket 文件，否则 listen 会因地址被占用失败
  if (existsSync(gatewaySocket)) rmSync(gatewaySocket, { force: true })
  app.listen(gatewaySocket, () => {
    // 只允许属主访问：套接字由网关进程转发，不应被同机其它用户直接连
    chmodSync(gatewaySocket, 0o600)
    console.log(`[fn-xiaoya-native] 已监听网关套接字：${gatewaySocket}`)
  })
}

main().catch((error) => {
  console.error('[fn-xiaoya-native] 启动失败：', error)
  process.exit(1)
})
