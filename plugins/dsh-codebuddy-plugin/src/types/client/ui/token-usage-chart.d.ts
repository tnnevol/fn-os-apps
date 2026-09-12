
import type { TokenStats } from '../panel-types'

/** props 形态（panel.tsx 中同名 type 仅作为导入源）。 */
export interface TokenUsageChartProps {
  days: TokenStats['days']
  inputLabel: string
  outputLabel: string
  cacheReadLabel: string
  recordsLabel: string
}
