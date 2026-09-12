
import type { PanelRouteController } from '../../client/panel-route.ts'
import type { ConnectionRpc } from '../../client/rpc.ts'
import type { Translate } from '../client/panel-types'
export type { Translate } from '../client/panel-types'

/** 页面循环经过的 UI 阶段。 */
export type Phase = 'loading' | 'idle' | 'error'
export interface CodeBuddySectionProps {
  rpc: ConnectionRpc
  t: Translate
  /** 管理面板路由；由 client 注入，点击头部按钮打开全页面。 */
  panelRoute?: PanelRouteController
  /** 设置外壳的关闭回调；打开 overlay 时把对话框一并收起，不留残影。 */
  close?: () => void
}
