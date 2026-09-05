/** Compact CodeBuddy quota readout for the conversation composer dock. */

import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { DshPopover, DshProgress, DshTooltip } from '@tnnevol/dsh-semi-ui'
import { CODEBUDDY_AUTH_CHANNEL, CODEBUDDY_USAGE_REFRESH_MS } from '../client/constants.ts'
import type { CodeBuddyLocaleKey } from '../client/locales.ts'
import type { ConnectionRpc, UsageResult, UsageWindow } from '../client/rpc.ts'
import { getCustomLimit, getDangerPct, getUsagePref, subscribeUsagePref } from '../client/usage-prefs.ts'
import { CodeBuddyLogo } from './CodeBuddyLogo.tsx'

type Translate = (key: CodeBuddyLocaleKey) => string

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

function formatAmount(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function resetLabel(window: UsageWindow | undefined, t: Translate): string | undefined {
  if (window?.resetsAt !== undefined && window.resetsAt.length > 0) {
    return `${t('usageResets')} ${window.resetsAt}`
  }
  return undefined
}

/** Build the tooltip text: the used/total figures plus an optional reset hint. */
function usageSummary(label: string, window: UsageWindow, t: Translate): string {
  const used = window.used !== undefined ? formatAmount(window.used) : '—'
  const total = window.limit !== undefined ? formatAmount(window.limit) : '—'
  const reset = resetLabel(window, t)
  return [label, `${t('usageUsed')}: ${used} / ${total}`, reset]
    .filter((item): item is string => item !== undefined)
    .join(' · ')
}

function UsageWindowDetails({ label, value, t }: { label: string; value: UsageWindow | undefined; t: Translate }) {
  if (value === undefined) return null
  const remaining = percent(value.usedPercent) ?? '—'
  const reset = resetLabel(value, t)
  return (
    <div className="dsh-codebuddy-usage-popover-window">
      <div className="dsh-codebuddy-usage-popover-heading">
        <span>{label}</span>
        <span>{`${t('usageRemaining')} ${remaining}`}</span>
      </div>
      <DshProgress
        percent={progressPercent(value.usedPercent)}
        showInfo={false}
        stroke="var(--dsw-alias-label-tertiary)"
        orbitStroke="var(--dsw-alias-border-l3)"
        className="dsh-codebuddy-usage-popover-progress"
      />
      {reset === undefined ? null : <span className="dsh-codebuddy-usage-popover-reset">{reset}</span>}
    </div>
  )
}

function UsagePopover({ windows, fallback, t }: { windows: UsageWindow[]; fallback: string; t: Translate }) {
  return (
    <div className="dsh-codebuddy-usage-popover-content">
      {windows.length === 0 ? <span className="dsh-codebuddy-usage-popover-empty">{fallback}</span> : null}
      {windows.map((window, index) => (
        <UsageWindowDetails
          key={`${window.name}-${index}`}
          label={window.name}
          value={window}
          t={t}
        />
      ))}
    </div>
  )
}

export interface CodeBuddyUsageStatusProps {
  t: Translate
  timer: TimerService
  rpc: ConnectionRpc
}

export function CodeBuddyUsageStatus({ t, timer, rpc }: CodeBuddyUsageStatusProps) {
  const [usage, setUsage] = useState<UsageResult | undefined>()
  const [usageState, setUsageState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [showUsage, setShowUsage] = useState<boolean>(getUsagePref())
  const [customLimit, setCustomLimitState] = useState<number | undefined>(getCustomLimit())
  const [dangerPct, setDangerPctState] = useState<number>(getDangerPct())
  const [popoverOpen, setPopoverOpen] = useState(false)

  useEffect(() => subscribeUsagePref(() => {
    setShowUsage(getUsagePref())
    setCustomLimitState(getCustomLimit())
    setDangerPctState(getDangerPct())
  }), [])

  useEffect(() => {
    if (!showUsage) return
    let active = true
    let requestSequence = 0
    const refresh = async (): Promise<void> => {
      const sequence = ++requestSequence
      setUsageState('loading')
      try {
        const result = await rpc.call<UsageResult>(CODEBUDDY_AUTH_CHANNEL, 'usage', {})
        if (!active || sequence !== requestSequence) return
        if (result.ok && result.value.loggedIn) {
          setUsage(result.value)
          setUsageState('ready')
        } else {
          setUsage(undefined)
          setUsageState('unavailable')
        }
      } catch {
        if (active && sequence === requestSequence) {
          setUsage(undefined)
          setUsageState('unavailable')
        }
      }
    }
    void refresh()
    const disposeInterval = timer.interval(() => { void refresh() }, CODEBUDDY_USAGE_REFRESH_MS)
    return () => {
      active = false
      requestSequence += 1
      disposeInterval()
    }
  }, [rpc, showUsage, timer])

  const primary = usage?.primary
  const windows = usage?.windows ?? []
  // A custom cap overrides the meter's reported limit.
  const limit = customLimit ?? primary?.limit
  const usedPct = primary !== undefined && primary.used !== undefined && limit !== undefined && limit > 0
    ? Math.max(0, Math.min(100, (primary.used / limit) * 100))
    : undefined
  const derived: UsageWindow | undefined = primary === undefined || primary.used === undefined
    ? undefined
    : {
        name: primary.name,
        used: primary.used,
        ...(limit === undefined ? {} : { limit }),
        ...(usedPct === undefined ? {} : { usedPercent: usedPct }),
        ...(primary.resetsAt === undefined ? {} : { resetsAt: primary.resetsAt }),
      }

  useEffect(() => {
    if (derived === undefined && popoverOpen) setPopoverOpen(false)
  }, [popoverOpen, derived])

  if (!showUsage) return null

  const hasUsage = derived !== undefined
  const currentSummary = hasUsage ? usageSummary(derived.name, derived, t) : usageState === 'loading' ? t('usageLoading') : t('usageUnavailable')
  const color = hasUsage && usedPct !== undefined && usedPct >= dangerPct
    ? 'var(--dsw-alias-state-error-primary)'
    : 'var(--dsw-alias-label-tertiary)'

  const togglePopover = (): void => setPopoverOpen((open) => !open)
  const handlePopoverTriggerKeyDown = (event: KeyboardEvent<HTMLSpanElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    togglePopover()
  }

  const progressContent = (
    <span className="dsh-codebuddy-usage-progress-track" aria-label={currentSummary}>
      <DshProgress
        type="circle"
        percent={hasUsage ? progressPercent(usedPct) : 0}
        width={26}
        strokeWidth={3}
        stroke={color}
        orbitStroke="var(--dsw-alias-border-l3)"
        showInfo
        format={() => <CodeBuddyLogo />}
      />
    </span>
  )

  // Tooltip must be unmounted while Popover is open.
  const progress = popoverOpen
    ? progressContent
    : (
        <DshTooltip content={currentSummary} mouseEnterDelay={0.35} mouseLeaveDelay={0.35}>
          {progressContent}
        </DshTooltip>
      )

  return (
    <span className="dsh-codebuddy-usage-progress" aria-label={currentSummary} aria-busy={usageState === 'loading'}>
      <DshPopover
        trigger="custom"
        position="topRight"
        content={<UsagePopover windows={windows} fallback={currentSummary} t={t} />}
        contentClassName="dsh-codebuddy-usage-popover"
        visible={popoverOpen}
        onVisibleChange={setPopoverOpen}
        onClickOutSide={() => setPopoverOpen(false)}
        showArrow={false}
      >
        <span
          className="dsh-codebuddy-usage-popover-trigger"
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
