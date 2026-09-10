/** Compact CodeBuddy quota readout for the conversation composer dock. */

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent } from 'react'
import { DshPopover, DshProgress, DshScrollList, DshTooltip } from '@tnnevol/dsh-semi-ui'
import { CODEBUDDY_USAGE_REFRESH_MS } from '../client/constants.ts'
import { CODEBUDDY_AUTH_CHANNEL } from '../contracts/constants.ts'

import { accountEpoch, subscribeAccountEpoch } from '../client/account-epoch.ts'
import type { CodeBuddyLocaleKey } from '../client/locales.ts'
import type { ConnectionRpc, UsageResult, UsageWindow } from '../client/rpc.ts'
import { useStore } from '@nanostores/react'
import { $showUsage } from '../client/usage-prefs.ts'
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

/**
 * The earliest reset timestamp across windows. The combined pool shrinks when
 * any package resets, so the hint stays conservative by showing the first
 * reset that will reduce it.
 */
function earliestReset(windows: UsageWindow[] | undefined): string | undefined {
  const times = (windows ?? [])
    .map(window => window.resetsAt)
    .filter((value): value is string => value !== undefined && value.length > 0)
    .sort()
  return times[0]
}

/** Build the tooltip text: the remaining percentage plus a reset hint. */
function usageSummary(label: string, window: UsageWindow, t: Translate): string {
  const remaining = window.usedPercent !== undefined
    ? percent(100 - window.usedPercent) ?? '—'
    : '—'
  const reset = resetLabel(window, t)
  return [label, `${t('usageRemaining')}: ${remaining}`, reset]
    .filter((item): item is string => item !== undefined)
    .join(' · ')
}

function UsageWindowDetails({ label, value, t }: { label: string; value: UsageWindow | undefined; t: Translate }) {
  if (value === undefined) return null
  const remaining = percent(value.usedPercent === undefined ? undefined : 100 - value.usedPercent) ?? '—'
  const reset = resetLabel(value, t)
  const amounts = value.used !== undefined || value.limit !== undefined
    ? `${value.used !== undefined ? formatAmount(value.used) : '—'} / ${value.limit !== undefined ? formatAmount(value.limit) : '—'}`
    : undefined
  return (
    <div className="dsh-codebuddy-usage-popover-window">
      <div className="dsh-codebuddy-usage-popover-heading">
        <span>{label}</span>
        <span>{`${t('usageRemaining')} ${remaining}`}</span>
      </div>
      {amounts === undefined ? null : (
        <div className="dsh-codebuddy-usage-popover-amounts">
          <span>{t('usageUsed')}</span>
          <span>{amounts}</span>
        </div>
      )}
      <DshProgress
        percent={progressPercent(value.usedPercent === undefined ? undefined : 100 - value.usedPercent)}
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
  if (windows.length === 0) {
    return <div className="dsh-codebuddy-usage-popover-content"><span className="dsh-codebuddy-usage-popover-empty">{fallback}</span></div>
  }
  return (
    <DshScrollList className="dsh-codebuddy-usage-popover-scroll">
      {windows.map((window, index) => (
        <UsageWindowDetails
          key={`${window.name}-${index}`}
          label={window.name}
          value={window}
          t={t}
        />
      ))}
    </DshScrollList>
  )
}


export interface CodeBuddyUsageStatusProps {
  t: Translate
  timer: TimerService
  rpc: ConnectionRpc
}

export function CodeBuddyUsageStatus({ t, timer, rpc }: CodeBuddyUsageStatusProps) {
  // host 切换账号后通过 llm/adapters-updated 推进代际；立即重拉额度，
  // 不等待一分钟轮询也不需要刷新页面。
  const accountVersion = useSyncExternalStore(subscribeAccountEpoch, accountEpoch, accountEpoch)
  const [usage, setUsage] = useState<UsageResult | undefined>()
  const [usageState, setUsageState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  // 显示开关直接来自持久化 store：useStore 内部就是 useSyncExternalStore，
  // 因此跨标签变化、其它组件写入都会自动反映到这里，不再需要手写订阅 effect。
  const showUsage = useStore($showUsage)
  const [popoverOpen, setPopoverOpen] = useState(false)

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
  }, [rpc, showUsage, timer, accountVersion])

  const primary = usage?.primary
  // The ring and tooltip read the COMBINED allowance: every capped window the
  // account holds contributes its used and limit (e.g. a base pack plus a
  // bonus pack share one pool in the UI), so the percentage reflects
  // `used total / package-sum`, not the first package alone.
  //
  // Both the ring and the per-package rows fill by REMAINING percentage —
  // "剩多少填多少" — so the arc and every "剩余 XX%" text always agree. The
  // arc shrinks as the quota drains, which matches how the surrounding copy
  // is phrased; the underlying usedPercent stays consumed-based as parsed.
  const totals = (usage?.windows ?? []).reduce(
    (acc, window) => ({
      used: acc.used + (window.used ?? 0),
      limit: acc.limit + (window.limit ?? 0),
    }),
    { used: 0, limit: 0 },
  )
  const limit = totals.limit > 0 ? totals.limit : undefined
  const used = totals.used
  const nextReset = earliestReset(usage?.windows)
  const usedPct = used !== undefined && limit !== undefined && limit > 0
    ? Math.max(0, Math.min(100, (used / limit) * 100))
    : undefined
  const derived: UsageWindow | undefined = primary === undefined
    ? undefined
    : {
        name: primary.name,
        used,
        ...(limit === undefined ? {} : { limit }),
        ...(usedPct === undefined ? {} : { usedPercent: usedPct }),
        // The earliest reset across the windows keeps the "resets at" hint
        // conservative — the combined pool shrinks when any package resets.
        ...(nextReset === undefined ? {} : { resetsAt: nextReset }),
      }
  // The popover keeps per-package detail rows so the combined figure in the
  // ring stays traceable to each package's own allowance.
  const popoverWindows: UsageWindow[] = usage?.windows ?? []

  useEffect(() => {
    if (derived === undefined && popoverOpen) setPopoverOpen(false)
  }, [popoverOpen, derived])

  if (!showUsage) return null

  const hasUsage = derived !== undefined
  const currentSummary = hasUsage ? usageSummary(derived.name, derived, t) : usageState === 'loading' ? t('usageLoading') : t('usageUnavailable')
  const color = 'var(--dsw-alias-label-tertiary)'

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
        percent={hasUsage ? progressPercent(usedPct === undefined ? undefined : 100 - usedPct) : 0}
        width={26}
        strokeWidth={3}
        stroke={color}
        orbitStroke="var(--dsw-alias-border-l3)"
        showInfo
        format={() => <CodeBuddyLogo variant="mono" />}
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
        content={<UsagePopover windows={popoverWindows} fallback={currentSummary} t={t} />}
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
