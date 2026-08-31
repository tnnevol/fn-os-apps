/** Compact Codex quota readout for the conversation composer dock. */

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { DshTag, DshTooltip } from '@tnnevol/dsh-semi-ui'
import type { CodexAuthLocaleKey } from './locales.ts'
import { readSignedInUsage } from './usage-status-data.ts'
import type { CodexUsage } from './usage-status-data.ts'
import { compactUsageWindow, FIVE_HOUR_WINDOW_SECONDS } from './usage-windows.ts'
import type { CodexUsageWindow } from './usage-windows.ts'

type Translate = (key: CodexAuthLocaleKey) => string

type TimerService = {
  interval(callback: () => void, delay: number): () => void
}

const statusStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
}

function percent(value: number | undefined): string | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined
  return `${Math.round(Math.max(0, Math.min(100, value)))}%`
}

function resetLabel(value: CodexUsageWindow | undefined): string | undefined {
  if (value?.resetAt !== undefined && Number.isFinite(value.resetAt)) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value.resetAt * 1_000))
  }
  if (value?.resetAfterSeconds !== undefined && Number.isFinite(value.resetAfterSeconds)) {
    return `${Math.max(1, Math.ceil(value.resetAfterSeconds / 60))} min`
  }
  return undefined
}

export interface CodexUsageStatusProps {
  t: Translate
  timer: TimerService
}

export function CodexUsageStatus({ t, timer }: CodexUsageStatusProps) {
  const [usage, setUsage] = useState<CodexUsage | undefined>()

  useEffect(() => {
    let active = true
    let requestSequence = 0
    const refresh = async (): Promise<void> => {
      const sequence = ++requestSequence
      try {
        const next = await readSignedInUsage()
        if (active && sequence === requestSequence) setUsage(next)
      } catch {
        if (active && sequence === requestSequence) setUsage(undefined)
      }
    }
    void refresh()
    const disposeInterval = timer.interval(() => { void refresh() }, 5 * 60 * 1_000)
    return () => {
      active = false
      requestSequence += 1
      disposeInterval()
    }
  }, [timer])

  const window = usage === undefined ? undefined : compactUsageWindow(usage)
  if (window === undefined) return null
  const label = window.limitWindowSeconds === FIVE_HOUR_WINDOW_SECONDS ? t('usageFiveHour') : t('usageWeekly')
  const remaining = percent(window.remainingPercent) ?? '—'
  const reset = resetLabel(window)
  const tooltip = [label, `${t('usageStatusRemaining')} ${remaining}`, reset === undefined ? undefined : `${t('usageStatusReset')} ${reset}`]
    .filter((value): value is string => value !== undefined)
    .join(' · ')
  return (
    <span style={statusStyle} aria-label={label}>
      <DshTooltip content={tooltip} mouseEnterDelay={0.35} mouseLeaveDelay={0}>
        <DshTag className="dsh-codex-usage-tag" size="small" type="light" color="grey" aria-label={tooltip}>
          {t('usageStatusRemaining')} {remaining}
        </DshTag>
      </DshTooltip>
    </span>
  )
}
