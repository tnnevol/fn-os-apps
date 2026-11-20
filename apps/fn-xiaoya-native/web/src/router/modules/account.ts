import { AppRouteRecord } from '@/types/router'

/** 账号配置：网盘授权与强制登录密码。 */
export const accountRoutes: AppRouteRecord = {
  name: 'Account',
  path: '/account',
  component: '/index/index',
  meta: {
    title: 'menus.account.title',
    icon: 'ri:user-settings-line'
  },
  children: [
    {
      path: 'pan',
      name: 'AccountPan',
      component: '/account/pan',
      meta: { title: 'menus.account.pan', icon: 'ri:cloud-line' }
    },
    {
      path: 'access',
      name: 'AccountAccess',
      component: '/account/access',
      meta: { title: 'menus.account.access', icon: 'ri:lock-password-line' }
    }
  ]
}
