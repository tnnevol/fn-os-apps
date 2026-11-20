import { AppRouteRecord } from '@/types/router'

/**
 * 小雅服务：容器状态、启停与日志。
 *
 * 不套「服务」外层分组：该组下只有这一个页面，多一层可折叠父菜单
 * 只会让用户多点击一次。单条无 children 的路由由框架用 Layout 包成一级菜单。
 */
export const serviceRoutes: AppRouteRecord = {
  name: 'ServiceAlist',
  path: '/service/alist',
  component: '/service/alist',
  meta: {
    title: 'menus.service.alist',
    icon: 'ri:play-circle-line'
  }
}
