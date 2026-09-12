/**
 * 用量分布维度切换（按工作区 / 按模型）。
 *
 * 复用时间周期的 `RangeToggle`：同一形态的互斥单选、同样的 solid/borderless 激活
 * 表达、同样的 aria-pressed；读者学一次就在两个地方都用。
 *
 * @module dsh-codebuddy/ui/dimension-toggle
 */

import type { StatsDimension } from '../../types/client/ui/dimension-toggle'
export type { StatsDimension } from '../../types/client/ui/dimension-toggle'
import type { ReactNode } from 'react'
import { DshButton, DshButtonGroup } from '@tnnevol/dsh-semi-ui'

/** 维度切换的两个档位与文案键，顺序稳定（工作区在前）。 */
export const DIMENSIONS: ReadonlyArray<{ key: StatsDimension, labelKey: 'tokenByWorkspace' | 'tokenByModel' }> = [
  { key: 'workspace', labelKey: 'tokenByWorkspace' },
  { key: 'model', labelKey: 'tokenByModel' },
]

/** Impl 别名：让 panel.tsx 与外部引入统一走 `*Impl` 后缀。 */
export const DimensionToggleImpl = DimensionToggle

export function DimensionToggle({ dimension, onChange, t }: {
  dimension: StatsDimension
  onChange: (value: StatsDimension) => void
  t: (key: 'tokenByWorkspace' | 'tokenByModel' | 'tokenDimension') => string
}): ReactNode {
  return (
    <DshButtonGroup size="small" className="dsh-codebuddy-panel-dimension" aria-label={t('tokenDimension')}>
      {DIMENSIONS.map(({ key, labelKey }) => (
        <DshButton
          key={key}
          size="small"
          theme={dimension === key ? 'solid' : 'borderless'}
          type={dimension === key ? 'primary' : 'tertiary'}
          aria-pressed={dimension === key}
          onClick={() => { onChange(key) }}
        >
          {t(labelKey)}
        </DshButton>
      ))}
    </DshButtonGroup>
  )
}
