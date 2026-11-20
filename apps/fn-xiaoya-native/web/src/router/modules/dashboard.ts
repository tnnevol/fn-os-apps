import { AppRouteRecord } from '@/types/router'

/**
 * 运行概览：进入应用后的首屏，汇总容器、授权与任务状态。
 *
 * 刻意不套一层「概览」分组：本应用只有这一个总览页，
 * 多一层可折叠父菜单只会让用户多点一次才能看到首屏。
 * 单条无 children 的路由会被框架用 Layout 包成一级菜单。
 */
export const dashboardRoutes: AppRouteRecord = {
  name: 'Console',
  path: '/dashboard/console',
  component: '/dashboard/console',
  meta: {
    title: 'menus.dashboard.console',
    icon: 'ri:home-smile-2-line',
    keepAlive: false,
    // 首屏固定标签，避免被误关
    fixedTab: true
  }
}
