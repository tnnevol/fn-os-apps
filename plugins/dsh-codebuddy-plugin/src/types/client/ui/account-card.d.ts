
import type { ClassifiedResource } from '../../../client/resource-history.ts'
import type { AccountCardLabels, PanelAccountRow } from '../panel-types'

export interface AccountCardProps {
  row: PanelAccountRow
  labels: AccountCardLabels
  /** 自动签到开启时不显示手动签到动作。 */
  autoCheckin: boolean
  /** 自动切换开启时不渲染「设为当前账号」入口。 */
  autoSwitch: boolean
  /** 该账号已分类的资源包（概览取前两个）。 */
  resources: ClassifiedResource[]
  busy: boolean
  onCheckin: (id: string) => void
  onSwitch: (id: string) => void
  onDelete: (row: PanelAccountRow) => void
  onRename: (row: PanelAccountRow) => void
  /** 点击卡片主体查看该账号全部资源包。 */
  onOpenResources: (row: PanelAccountRow) => void
}
