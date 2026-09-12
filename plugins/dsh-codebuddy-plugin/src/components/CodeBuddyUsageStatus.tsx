/** 会话输入框 dock 的紧凑 CodeBuddy 额度读数。 */

import type { Translate, CodeBuddyUsageStatusProps } from '../types/components/CodeBuddyUsageStatus'
export type { CodeBuddyUsageStatusProps } from '../types/components/CodeBuddyUsageStatus'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent } from 'react'
import { DshPopover, DshProgress, DshScrollList, DshTooltip } from '@tnnevol/dsh-semi-ui'
import { CODEBUDDY_USAGE_REFRESH_MS } from '../client/constants.ts'
import { CODEBUDDY_AUTH_CHANNEL } from '../contracts/constants.ts'

import { accountEpoch, subscribeAccountEpoch } from '../client/store/account-epoch.ts'

import type { UsageResult, UsageWindow } from '../client/rpc.ts'
import { useStore } from '@nanostores/react'
import { $showUsage } from '../client/store/usage-prefs.ts'
import { CodeBuddyLogo } from './CodeBuddyLogo.tsx'

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
 * 各计量窗口中最早的重置时间戳。任一资源包重置时，合并池都会缩小，
 * 因此提示保持保守：显示第一个会减少额度的重置时间。
 */
function earliestReset(windows: UsageWindow[] | undefined): string | undefined {
  const times = (windows ?? [])
    .map(window => window.resetsAt)
    .filter((value): value is string => value !== undefined && value.length > 0)
    .sort()
  return times[0]
}

/** 构建 tooltip 文案：剩余百分比加一条重置提示。 */
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
  // 圆环与 tooltip 读取的是合并后的总额度：账号持有的每个有上限的计量窗口
  // 都贡献自己的 used 与 limit（例如基础包与奖励包在 UI 里共享一个池），
  // 因此百分比反映的是 `used 总量 / 各包之和`，而不是第一个资源包。
  //
  // 圆环与每个资源包行都按剩余百分比填充——「剩多少填多少」——这样圆弧与
  // 每处「剩余 XX%」文案始终一致。额度耗尽时圆弧随之缩小，与周围文案的
  // 表述方式吻合；底层的 usedPercent 仍按解析出的已消耗口径保持不变。
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
        // 取各计量窗口中最早的重置时间，让「重置时间」提示保持保守
        // ——任一资源包重置时，合并池都会缩小。
        ...(nextReset === undefined ? {} : { resetsAt: nextReset }),
      }
  // 弹出层保留每个资源包的明细行，让圆环里的合并数字能追溯
  // 到每个资源包各自的额度。
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

  // Popover 打开时必须卸载 Tooltip。
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
