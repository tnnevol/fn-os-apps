/** Compact Codex quota readout for the conversation composer dock. */

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CodexAuthLocaleKey } from './locales.ts'
import { CODEX_USAGE_PATH } from '../auth-paths.ts'

type Translate = (key: CodexAuthLocaleKey) => string

type TimerService = {
  interval(callback: () => void, delay: number): () => void
}

interface UsageWindow {
  remainingPercent?: number
  limitWindowSeconds?: number
  resetAfterSeconds?: number
  resetAt?: number
}

interface CodexUsage {
  secondaryWindow?: UsageWindow
  primaryWindow?: UsageWindow
}

const statusStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 12,
  lineHeight: '18px',
}

const dividerStyle: CSSProperties = {
  width: 3,
  height: 3,
  borderRadius: '50%',
  background: 'var(--dsw-alias-label-dimmed)',
}

function weeklyWindow(usage: CodexUsage): UsageWindow | undefined {
  const windows = [usage.primaryWindow, usage.secondaryWindow]
  return windows.find(window => window?.limitWindowSeconds === 7 * 24 * 60 * 60)
    ?? usage.secondaryWindow
}

function percent(value: number | undefined): string | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined
  return `${Math.round(Math.max(0, Math.min(100, value)))}%`
}

function resetLabel(value: UsageWindow | undefined): string | undefined {
  if (value?.resetAt !== undefined && Number.isFinite(value.resetAt)) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value.resetAt * 1_000))
  }
  if (value?.resetAfterSeconds !== undefined && Number.isFinite(value.resetAfterSeconds)) {
    return `${Math.max(1, Math.ceil(value.resetAfterSeconds / 60))} min`
  }
  return undefined
}

async function readUsage(): Promise<CodexUsage | undefined> {
  const response = await fetch(CODEX_USAGE_PATH, {
    method: 'GET',
    headers: { accept: 'application/json' },
    credentials: 'same-origin',
  })
  if (response.status === 401) return undefined
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
  return await response.json() as CodexUsage
}

export interface CodexUsageStatusProps {
  t: Translate
  timer: TimerService
}

export function CodexUsageStatus({ t, timer }: CodexUsageStatusProps) {
  const [usage, setUsage] = useState<CodexUsage | undefined>()

  useEffect(() => {
    let active = true
    const refresh = async (): Promise<void> => {
      try {
        const next = await readUsage()
        if (active) setUsage(next)
      } catch {
        if (active) setUsage(undefined)
      }
    }
    void refresh()
    const disposeInterval = timer.interval(() => { void refresh() }, 5 * 60 * 1_000)
    return () => {
      active = false
      disposeInterval()
    }
  }, [timer])

  const window = usage === undefined ? undefined : weeklyWindow(usage)
  const remaining = percent(window?.remainingPercent) ?? '—'
  const reset = resetLabel(window)
  return (
    <span style={statusStyle} aria-label={t('usageStatus')}>
      <span>{t('usageStatus')}</span>
      <span style={dividerStyle} aria-hidden="true" />
      <span>{t('usageStatusRemaining')} {remaining}</span>
      {reset === undefined ? null : <><span style={dividerStyle} aria-hidden="true" /><span>{t('usageStatusReset')} {reset}</span></>}
    </span>
  )
}
