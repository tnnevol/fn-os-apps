import type { App } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { staticRoutes } from './routes/staticRoutes'
import { configureNProgress } from '@/utils/router'
import { setupBeforeEachGuard } from './guards/beforeEach'
import { setupAfterEachGuard } from './guards/afterEach'

/**
 * 创建路由实例。
 *
 * 用 history 模式而不是 hash 模式：
 * - 地址更干净（/app/fn-xiaoya-native/settings/sync 而不是 /#/settings/sync）；
 * - 与飞牛统一网关的子路径天然契合——网关转发保留前缀，
 *   后端已剥离 `/app/fn-xiaoya-native`，前端的 base 与之保持一致，
 *   所以 router 不需要再关心前缀。
 *
 * 依赖两个前提，缺一不可（都已具备）：
 * 1. Vite 的 base 在生产环境是 `/app/fn-xiaoya-native/`；
 * 2. 后端对非静态资源路径回退到 index.html（见 http/static.mjs）。
 */
export const router = createRouter({
  // import.meta.env.BASE_URL 由 Vite 的 base 注入，末尾带 /
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: staticRoutes // 静态路由
})

// 初始化路由
export function initRouter(app: App<Element>): void {
  configureNProgress() // 顶部进度条
  setupBeforeEachGuard(router) // 路由前置守卫
  setupAfterEachGuard(router) // 路由后置守卫
  app.use(router)
}

// 主页路径，默认使用菜单第一个有效路径，配置后使用此路径
export const HOME_PAGE_PATH = ''
