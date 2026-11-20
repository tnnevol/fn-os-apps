import { AppRouteRecord } from '@/types/router'

/** 设置：镜像版本、代理与目录信息。 */
export const settingsRoutes: AppRouteRecord = {
  name: 'Settings',
  path: '/settings',
  component: '/index/index',
  meta: {
    title: 'menus.settings.title',
    icon: 'ri:settings-3-line'
  },
  children: [
    {
      path: 'general',
      name: 'SettingsGeneral',
      component: '/settings/general',
      meta: { title: 'menus.settings.general', icon: 'ri:equalizer-line' }
    },
    {
      path: 'sync',
      name: 'SettingsSync',
      component: '/settings/sync',
      meta: { title: 'menus.settings.sync', icon: 'ri:refresh-line' }
    }
  ]
}
