import { AppRouteRecord } from '@/types/router'

/** 元数据：包状态与任务。 */
export const metadataRoutes: AppRouteRecord = {
  name: 'Metadata',
  path: '/metadata',
  component: '/index/index',
  meta: {
    title: 'menus.metadata.title',
    icon: 'ri:database-2-line'
  },
  children: [
    {
      path: 'packages',
      name: 'MetadataPackages',
      component: '/metadata/packages',
      meta: { title: 'menus.metadata.packages', icon: 'ri:box-3-line' }
    },
    {
      path: 'tasks',
      name: 'MetadataTasks',
      component: '/metadata/tasks',
      meta: { title: 'menus.metadata.tasks', icon: 'ri:list-check-2' }
    }
  ]
}
