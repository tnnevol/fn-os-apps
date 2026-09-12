/**
 * 时间档位按钮组：互斥单选、solid/borderless 激活态，aria-pressed 表达选中。
 *
 * 与 `DimensionToggle` 是同构体：sizing / 激活表达 / a11y 全部一致，区别只在
 * 选项数据类型。读者学一次就能在两个地方都用。
 *
 * @module dsh-codebuddy/ui/range-toggle
 */

import type { ReactNode } from 'react'
import { DshButton, DshButtonGroup } from '@tnnevol/dsh-semi-ui'
import type { TokenRangeKey } from '../token-range.ts'

export function RangeToggle({ options, range, onChange, label, format }: {
  options: readonly TokenRangeKey[]
  range: TokenRangeKey
  onChange: (value: TokenRangeKey) => void
  label: string
  format: (key: TokenRangeKey) => string
}): ReactNode {
  return (
    <DshButtonGroup size="small" className="dsh-codebuddy-panel-range" aria-label={label}>
      {options.map(key => (
        <DshButton
          key={key}
          size="small"
          // solid = 当前档位；borderless = 其余选项。
          theme={range === key ? 'solid' : 'borderless'}
          type={range === key ? 'primary' : 'tertiary'}
          // aria-pressed 给读屏表达选中态（纯视觉的 theme 切换对辅助技术不可见）。
          aria-pressed={range === key}
          onClick={() => { onChange(key) }}
        >
          {format(key)}
        </DshButton>
      ))}
    </DshButtonGroup>
  )
}

/** 与 panel.tsx 共用：导入时希望统一 `*Impl` 后缀命名。 */
export const RangeToggleImpl = RangeToggle
