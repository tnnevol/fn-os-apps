/** Compact Codex quota readout for the conversation composer dock. */

import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { DshPopover, DshProgress, DshTooltip } from '@tnnevol/dsh-semi-ui'
import type { CodexAuthLocaleKey } from './locales.ts'
import { readCodexSignedInStatus, readCodexUsage } from './usage-status-data.ts'
import type { CodexUsage } from './usage-status-data.ts'
import { compactUsageWindow, fiveHourWindow, FIVE_HOUR_WINDOW_SECONDS, weeklyWindow } from './usage-windows.ts'
import type { CodexUsageWindow } from './usage-windows.ts'

type Translate = (key: CodexAuthLocaleKey) => string

type TimerService = {
  interval(callback: () => void, delay: number): () => void
}

function percent(value: number | undefined): string | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined
  return `${Math.round(Math.max(0, Math.min(100, value)))}%`
}

function progressPercent(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
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

function usageSummary(label: string, value: CodexUsageWindow | undefined, t: Translate): string | undefined {
  if (value === undefined) return undefined
  const remaining = percent(value.remainingPercent) ?? '—'
  const reset = resetLabel(value)
  return [label, `${t('usageStatusRemaining')} ${remaining}`, reset === undefined ? undefined : `${t('usageStatusReset')} ${reset}`]
    .filter((item): item is string => item !== undefined)
    .join(' · ')
}

/** OpenAI mark sourced from Simple Icons' openai icon (CC0-1.0). */
function CodexLogo() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.282 9.821a6 6 0 0 0-.516-4.91a6.05 6.05 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a6 6 0 0 0-3.998 2.9a6.05 6.05 0 0 0 .743 7.097a5.98 5.98 0 0 0 .51 4.911a6.05 6.05 0 0 0 6.515 2.9A6 6 0 0 0 13.26 24a6.06 6.06 0 0 0 5.772-4.206a6 6 0 0 0 3.997-2.9a6.06 6.06 0 0 0-.747-7.073M13.26 22.43a4.48 4.48 0 0 1-2.876-1.04l.141-.081l4.779-2.758a.8.8 0 0 0 .392-.681v-6.737l2.02 1.168a.07.07 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494M3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085l4.783 2.759a.77.77 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646M2.34 7.896a4.5 4.5 0 0 1 2.366-1.973V11.6a.77.77 0 0 0 .388.677l5.815 3.354l-2.02 1.168a.08.08 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.08.08 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667m2.01-3.023l-.141-.085l-4.774-2.782a.78.78 0 0 0-.785 0L9.409 9.23V6.897a.07.07 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.8.8 0 0 0-.393.681zm1.097-2.365l2.602-1.5l2.607 1.5v2.999l-2.597 1.5l-2.607-1.5Z"
      />
    </svg>
  )
}

function UsageWindowDetails({ label, value, t }: { label: string; value: CodexUsageWindow | undefined; t: Translate }) {
  if (value === undefined) return null
  const remaining = percent(value.remainingPercent) ?? '—'
  const reset = resetLabel(value)
  return (
    <div className="dsh-codex-usage-popover-window">
      <div className="dsh-codex-usage-popover-heading">
        <span>{label}</span>
        <span>{`${t('usageStatusRemaining')} ${remaining}`}</span>
      </div>
      <DshProgress
        percent={progressPercent(value.remainingPercent)}
        showInfo={false}
        stroke="var(--dsw-alias-label-tertiary)"
        orbitStroke="var(--dsw-alias-border-l3)"
        className="dsh-codex-usage-popover-progress"
      />
      {reset === undefined ? null : <span className="dsh-codex-usage-popover-reset">{`${t('usageStatusReset')} ${reset}`}</span>}
    </div>
  )
}

function UsagePopover({ fiveHour, weekly, fallback, t }: { fiveHour: CodexUsageWindow | undefined; weekly: CodexUsageWindow | undefined; fallback: string; t: Translate }) {
  return (
    <div className="dsh-codex-usage-popover-content">
      {fiveHour === undefined && weekly === undefined ? <span className="dsh-codex-usage-popover-empty">{fallback}</span> : null}
      <UsageWindowDetails label={t('usageFiveHour')} value={fiveHour} t={t} />
      <UsageWindowDetails label={t('usageWeekly')} value={weekly} t={t} />
    </div>
  )
}

export interface CodexUsageStatusProps {
  t: Translate
  timer: TimerService
}

export function CodexUsageStatus({ t, timer }: CodexUsageStatusProps) {
  const [accountState, setAccountState] = useState<'checking' | 'signed-out' | 'signed-in'>('checking')
  const [usage, setUsage] = useState<CodexUsage | undefined>()
  const [usageState, setUsageState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [popoverOpen, setPopoverOpen] = useState(false)

  useEffect(() => {
    let active = true
    let requestSequence = 0
    const refresh = async (): Promise<void> => {
      const sequence = ++requestSequence
      let signedIn = false
      try {
        signedIn = await readCodexSignedInStatus()
      } catch {
        if (active && sequence === requestSequence) {
          setAccountState('signed-out')
          setUsage(undefined)
          setUsageState('unavailable')
        }
        return
      }
      if (!active || sequence !== requestSequence) return
      if (!signedIn) {
        setAccountState('signed-out')
        setUsage(undefined)
        setUsageState('unavailable')
        return
      }
      setAccountState('signed-in')
      setUsageState('loading')
      try {
        const next = await readCodexUsage()
        if (active && sequence === requestSequence) {
          setUsage(next)
          setUsageState('ready')
        }
      } catch {
        if (active && sequence === requestSequence) {
          setUsage(undefined)
          setUsageState('unavailable')
        }
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

  const fiveHour = usage === undefined ? undefined : fiveHourWindow(usage)
  const weekly = usage === undefined ? undefined : weeklyWindow(usage)
  const usageWindow = usage === undefined ? undefined : compactUsageWindow(usage)
  useEffect(() => {
    if (usageWindow === undefined && popoverOpen) setPopoverOpen(false)
  }, [popoverOpen, usageWindow])
  if (accountState === 'signed-out') return null
  const togglePopover = (): void => setPopoverOpen((open) => !open)
  const handlePopoverTriggerKeyDown = (event: KeyboardEvent<HTMLSpanElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    togglePopover()
  }
  const hasUsage = usageWindow !== undefined
  const label = hasUsage && usageWindow.limitWindowSeconds === FIVE_HOUR_WINDOW_SECONDS ? t('usageFiveHour') : t('usageWeekly')
  const currentSummary = hasUsage ? usageSummary(label, usageWindow, t) ?? label : usageState === 'loading' ? t('usageLoading') : t('usageUnavailable')
  const tooltip = currentSummary
  const progressContent = (
    <span className="dsh-codex-usage-progress-track" aria-label={currentSummary}>
      <DshProgress
        type="circle"
        percent={hasUsage ? progressPercent(usageWindow.remainingPercent) : 0}
        width={26}
        strokeWidth={3}
        stroke="var(--dsw-alias-label-tertiary)"
        orbitStroke="var(--dsw-alias-border-l3)"
        showInfo
        format={() => <CodexLogo />}
      />
    </span>
  )
  // Tooltip must be unmounted while Popover is open. Controlling `visible` alone
  // leaves Semi's hover trigger mounted and can reopen a stale tooltip.
  const progress = popoverOpen
    ? progressContent
    : (
        <DshTooltip content={tooltip} mouseEnterDelay={0.35} mouseLeaveDelay={0.35}>
          {progressContent}
        </DshTooltip>
      )
  return (
    <span className="dsh-codex-usage-progress" aria-label={tooltip} aria-busy={usageState === 'loading'}>
      <DshPopover
        trigger="custom"
        position="topRight"
        content={<UsagePopover fiveHour={fiveHour} weekly={weekly} fallback={currentSummary} t={t} />}
        contentClassName="dsh-codex-usage-popover"
        visible={popoverOpen}
        onVisibleChange={setPopoverOpen}
        onClickOutSide={() => setPopoverOpen(false)}
        showArrow={false}
      >
        <span
          className="dsh-codex-usage-popover-trigger"
          role="button"
          tabIndex={0}
          onClick={togglePopover}
          onKeyDown={handlePopoverTriggerKeyDown}
        >
          {progress}
        </span>
      </DshPopover>
    </span>
  )
}
