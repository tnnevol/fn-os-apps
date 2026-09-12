/**
 * 三个 auto* 偏好开关（账号页标题行）。
 *
 * 与设置页同一组：状态来自 `usage-prefs` 持久化 store，UI 由本面板使用。
 *
 * `AutoSwitchToggle` / `AutoCheckinToggle` / `AutoTravelToggle` 形似，但
 * - switch 启用的细节不同（switch 用 Tooltip 包，描述「自动切换」的含义）；
 * - 提取三份各自的注释比抽公共 helper 更省：每个开关的 Tooltip/label 都不一样。
 *
 * @module dsh-codebuddy/ui/auto-toggles
 */

import type { ReactNode } from 'react'
import { DshSwitch, DshTooltip } from '@tnnevol/dsh-semi-ui'
import type { Translate } from '../panel-types.ts'

/** 自动切换账号开关（账号页标题行）。 */
export function AutoSwitchToggleImpl({ checked, t, onChange }: {
  checked: boolean
  t: Translate
  onChange: (checked: boolean) => void
}): ReactNode {
  return (
    <DshTooltip content={t('autoSwitchDesc')}>
      <span className="dsh-codebuddy-auto-checkin-toggle">
        <span className="dsh-codebuddy-muted">{t('autoSwitch')}</span>
        <DshSwitch
          size="small"
          checked={checked}
          onChange={onChange}
          aria-label={t('autoSwitch')}
        />
      </span>
    </DshTooltip>
  )
}

/** 自动签到开关（账号页标题行）。 */
export function AutoCheckinToggleImpl({ checked, t, onChange }: {
  checked: boolean
  t: Translate
  onChange: (checked: boolean) => void
}): ReactNode {
  return (
    <span className="dsh-codebuddy-auto-checkin-toggle">
      <span className="dsh-codebuddy-muted">{t('autoCheckin')}</span>
      <DshSwitch
        size="small"
        checked={checked}
        onChange={onChange}
        aria-label={t('autoCheckin')}
      />
    </span>
  )
}

/** 自动旅行开关（账号页标题行）。 */
export function AutoTravelToggleImpl({ checked, t, onChange }: {
  checked: boolean
  t: Translate
  onChange: (checked: boolean) => void
}): ReactNode {
  return (
    <DshTooltip content={t('travelAutoDesc')}>
      <span className="dsh-codebuddy-auto-checkin-toggle">
        <span className="dsh-codebuddy-muted">{t('travelAuto')}</span>
        <DshSwitch
          size="small"
          checked={checked}
          onChange={onChange}
          aria-label={t('travelAuto')}
        />
      </span>
    </DshTooltip>
  )
}
