
import type { ConnectionRpc } from '../../client/rpc.ts'
import type { PanelRouteController } from '../../client/panel-route.ts'
import type { StatsDimension as StatsDimensionFromUi } from '../../client/ui/dimension-toggle.tsx'
import type { Translate } from './panel-types'
export type { TokenUsageChartProps } from './ui/token-usage-chart'

export type StatsDimension = StatsDimensionFromUi
/* ============================================================================
 * 顶层页面：CodeBuddyPanelPage
 * ========================================================================== */

export interface PanelPageProps {
  rpc: ConnectionRpc
  route: PanelRouteController
  t: Translate
}
