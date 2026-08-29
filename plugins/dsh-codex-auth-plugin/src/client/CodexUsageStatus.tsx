/** Compact Codex quota readout for the conversation composer dock. */

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CodexAuthLocaleKey } from './locales.ts'
import { CODEX_AUTH_STATUS_PATH, CODEX_USAGE_PATH } from '../auth-paths.ts'
import { compactUsageWindow, FIVE_HOUR_WINDOW_SECONDS } from './usage-windows.ts'
import type { CodexUsageWindow } from './usage-windows.ts'

type Translate = (key: CodexAuthLocaleKey) => string

type TimerService = {
  interval(callback: () => void, delay: number): () => void
}

interface CodexUsage {
  secondaryWindow?: CodexUsageWindow
  primaryWindow?: CodexUsageWindow
}

interface CodexAuthStatus {
  status?: string
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

async function readJson<T>(path: string): Promise<T | undefined> {
  const response = await fetch(path, {
    method: 'GET',
    headers: { accept: 'application/json' },
    credentials: 'same-origin',
  })
  if (response.status === 401) return undefined
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
  return await response.json() as T
}

/** Read one coherent snapshot so quota is never shown for a signed-out account. */
export async function readSignedInUsage(): Promise<CodexUsage | undefined> {
  const status = await readJson<CodexAuthStatus>(CODEX_AUTH_STATUS_PATH)
  if (status?.status !== 'signed-in') return undefined
  return await readJson<CodexUsage>(CODEX_USAGE_PATH)
}

async function readUsage(): Promise<CodexUsage | undefined> {
  return await readSignedInUsage()
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
        const next = await readUsage()
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
  return (
    <span style={statusStyle} aria-label={label}>
      <span>{label}</span>
      <span style={dividerStyle} aria-hidden="true" />
      <span>{t('usageStatusRemaining')} {remaining}</span>
      {reset === undefined ? null : <><span style={dividerStyle} aria-hidden="true" /><span>{t('usageStatusReset')} {reset}</span></>}
    </span>
  )
}
