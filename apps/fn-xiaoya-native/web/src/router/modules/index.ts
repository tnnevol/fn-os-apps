import { AppRouteRecord } from '@/types/router'
import { dashboardRoutes } from './dashboard'
import { accountRoutes } from './account'
import { metadataRoutes } from './metadata'
import { serviceRoutes } from './service'
import { settingsRoutes } from './settings'

/**
 * 导出本应用的模块化路由。
 *
 * 脚手架自带的 template / widgets / examples / article / result / safeguard 等演示模块
 * 已移除：它们对应的是模板展示页，与本应用功能无关，保留只会让菜单里出现死链。
 */
export const routeModules: AppRouteRecord[] = [
  dashboardRoutes,
  accountRoutes,
  metadataRoutes,
  serviceRoutes,
  settingsRoutes
]
