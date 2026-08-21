/** Expandable account card for the DSH Plugins settings section. */

import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { CodexAuthSettingsConfig } from '../settings-contract.ts'
import type { CodexAuthLocaleKey } from './locales.ts'
import { CodexCapabilities } from './CodexCapabilities.tsx'
import { CodexGlobalModel } from './CodexGlobalModel.tsx'
import { copyTextToClipboard } from './copy-to-clipboard.ts'
import {
  CODEX_AUTH_LOGIN_PATH,
  CODEX_AUTH_LOGOUT_PATH,
  CODEX_AUTH_STATUS_PATH,
  CODEX_USAGE_PATH,
} from '../auth-paths.ts'

type Translate = (key: CodexAuthLocaleKey) => string

type AccountStatus =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signing-in' }
  | { status: 'signed-in'; expiresAt?: string }
  | { status: 'error'; message: string }
  | { status: 'remote-web-origin-not-trusted' }

interface LoginChallenge {
  type: 'device_code'
  userCode: string
  verificationUri: string
  intervalSeconds?: number
  expiresInSeconds?: number
}

interface UsageWindow {
  remainingPercent?: number
  limitWindowSeconds?: number
  resetAfterSeconds?: number
  resetAt?: number
}

interface CodexUsage {
  planType?: string
  allowed?: boolean
  limitReached?: boolean
  primaryWindow?: UsageWindow
  secondaryWindow?: UsageWindow
  credits?: { hasCredits?: boolean; unlimited?: boolean; balance?: string }
}

type UsageState =
  | { status: 'hidden' }
  | { status: 'loading' }
  | { status: 'ready'; usage: CodexUsage }
  | { status: 'error' }

export interface CodexAuthCardInjected {
  t: Translate
  configScope: SettingsScope<CodexAuthSettingsConfig>
  connection: ConnectionHandle
}

export type CodexAuthCardProps = PropsRuntime<'settings.plugin.item'> & Partial<CodexAuthCardInjected>

const cardStyle: CSSProperties = {
  overflow: 'hidden',
  listStyle: 'none',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 12,
  background: 'var(--dsw-alias-bg-layer-3)',
  transition: 'border-color 160ms ease, background 160ms ease',
}
const cardOpenStyle: CSSProperties = {
  background: 'var(--dsw-alias-bg-layer-2)',
  borderColor: 'var(--dsw-alias-label-dimmed)',
}
const headerStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  border: 0,
  padding: '14px 16px',
  borderRadius: 12,
  background: 'none',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
}
const headTextStyle: CSSProperties = { display: 'flex', minWidth: 0, flexDirection: 'column', gap: 4 }
const nameStyle: CSSProperties = { fontSize: 15, lineHeight: '1.4', fontWeight: 600 }
const descriptionStyle: CSSProperties = { fontSize: 13, lineHeight: '1.5', color: 'var(--dsw-alias-label-tertiary)' }
const bodyStyle: CSSProperties = { margin: 0, fontSize: 13, lineHeight: '20px', color: 'var(--dsw-alias-label-secondary)' }
const errorStyle: CSSProperties = { ...bodyStyle, color: 'var(--dsw-alias-state-error-primary, #d92d20)' }
const cardBodyStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--dsw-alias-border-l2)', margin: '0 16px', padding: '12px 0 8px' }
const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }
const statusStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, fontWeight: 500, color: 'var(--dsw-alias-label-primary)' }
const buttonStyle: CSSProperties = { boxSizing: 'border-box', minHeight: 34, padding: '6px 14px', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 18, background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 14, cursor: 'pointer' }
const codeStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 38, padding: '0 14px', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 18, fontWeight: 700, letterSpacing: '0.08em' }
const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  height: 36,
  minHeight: 36,
  padding: '0 14px',
  border: 0,
  background: 'var(--dsw-alias-button-primary-fill)',
  color: 'var(--dsw-alias-label-primary-foreground)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: '22px',
}
const usageStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 2 }
const usageHeaderStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }
const usageTitleStyle: CSSProperties = { color: 'var(--dsw-alias-label-primary)', fontSize: 14, fontWeight: 600 }
const usageWindowStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 12, padding: '14px 14px 15px', background: 'var(--dsw-alias-bg-layer-1)' }
const usageWindowHeaderStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }
const usageWindowDetailsStyle: CSSProperties = { display: 'flex', minWidth: 0, flexDirection: 'column', gap: 3 }
const usageWindowTitleStyle: CSSProperties = { color: 'var(--dsw-alias-label-primary)', fontSize: 14, fontWeight: 600 }
const usageResetStyle: CSSProperties = { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 }
const usageRemainingStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: '1 1 220px', minWidth: 200, gap: 12 }
const usageTrackStyle: CSSProperties = { overflow: 'hidden', flex: '1 1 140px', width: 192, minWidth: 100, maxWidth: 192, height: 8, borderRadius: 999, background: 'rgba(127, 127, 127, 0.28)' }
const usageFillStyle: CSSProperties = { height: '100%', borderRadius: 'inherit', background: 'var(--dsw-alias-brand-primary)', transition: 'width 160ms ease' }
const usageRemainingTextStyle: CSSProperties = { color: 'var(--dsw-alias-label-secondary)', fontSize: 14, whiteSpace: 'nowrap' }

function Chevron({ open }: { open: boolean }) {
  return (
    <span aria-hidden="true" style={{ color: 'var(--dsw-alias-label-tertiary)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease' }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2.15 5.5 3 4.65l3.73 3.73a.38.38 0 0 0 .54 0L11 4.65l.85.85-2.73 2.73c-.58.58-.9.9-1.4 1.03a2.1 2.1 0 0 1-.94 0c-.5-.13-.82-.45-1.4-1.03L2.15 5.5Z" fill="currentColor" />
      </svg>
    </span>
  )
}

class AccountRequestError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'AccountRequestError'
  }
}

async function jsonRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers: HeadersInit = { accept: 'application/json' }
  if (body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    credentials: 'same-origin',
  })
  const value: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const code = typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
      ? value.error
      : `HTTP ${response.status}`
    throw new AccountRequestError(code, code)
  }
  return value as T
}

function dotStyle(status: AccountStatus['status']): CSSProperties {
  const color = status === 'signed-in'
    ? 'var(--dsw-alias-state-success-primary, #22a06b)'
    : status === 'error' || status === 'remote-web-origin-not-trusted'
      ? 'var(--dsw-alias-state-error-primary, #d92d20)'
      : status === 'signing-in' || status === 'loading'
        ? 'var(--dsw-alias-brand-primary, #1677ff)'
        : 'var(--dsw-alias-label-dimmed, #9aa0a6)'
  return { width: 9, height: 9, borderRadius: '50%', flex: '0 0 auto', background: color }
}

function percent(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  return `${Math.round(value)}%`
}

function progressWidth(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '0%'
  return `${Math.max(0, Math.min(100, value))}%`
}

function weeklyWindow(usage: CodexUsage): UsageWindow | undefined {
  const windows = [usage.primaryWindow, usage.secondaryWindow]
  // The WHAM response normally exposes the weekly quota as secondary_window.
  // Prefer the explicit seven-day window when the API includes its duration.
  return windows.find(window => window?.limitWindowSeconds === 7 * 24 * 60 * 60)
    ?? usage.secondaryWindow
}

function resetLabel(window: UsageWindow | undefined, t: Translate): string | undefined {
  if (window?.resetAt !== undefined && Number.isFinite(window.resetAt)) {
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(window.resetAt * 1_000))
    return `${t('usageResetAt')} ${date}`
  }
  if (window?.resetAfterSeconds !== undefined && Number.isFinite(window.resetAfterSeconds)) {
    const minutes = Math.max(1, Math.ceil(window.resetAfterSeconds / 60))
    return `${t('usageResetAfter')}: ${minutes}${t('usageMinutes')}`
  }
  return undefined
}

function UsageWindowView({ label, value, t }: { label: string; value: UsageWindow | undefined; t: Translate }) {
  if (value === undefined) return null
  const reset = resetLabel(value, t)
  return (
    <div style={usageWindowStyle}>
      <div style={usageWindowHeaderStyle}>
        <div style={usageWindowDetailsStyle}>
          <span style={usageWindowTitleStyle}>{label}</span>
          {reset === undefined ? null : <span style={usageResetStyle}>{reset}</span>}
        </div>
        <div style={usageRemainingStyle}>
          <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value.remainingPercent} style={usageTrackStyle}>
            <div style={{ ...usageFillStyle, width: progressWidth(value.remainingPercent) }} />
          </div>
          <span style={usageRemainingTextStyle}>{t('usageRemaining')} {percent(value.remainingPercent)}</span>
        </div>
      </div>
    </div>
  )
}

/** Render a standalone login/logout card in the rc.8 keyed Plugin slot. */
export function CodexAuthCard({ t, configScope, connection }: CodexAuthCardProps) {
  if (t === undefined) throw new Error('Codex auth card requires its translation function')
  if (connection === undefined) throw new Error('Codex auth card requires the DSH connection')
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<AccountStatus>({ status: 'loading' })
  const [busy, setBusy] = useState(false)
  const [challenge, setChallenge] = useState<LoginChallenge | undefined>()
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [usage, setUsage] = useState<UsageState>({ status: 'hidden' })

  const refreshUsage = useCallback(async (): Promise<void> => {
    if (status.status !== 'signed-in') return
    setUsage(current => current.status === 'ready' ? current : { status: 'loading' })
    try {
      setUsage({ status: 'ready', usage: await jsonRequest<CodexUsage>(CODEX_USAGE_PATH) })
    } catch {
      setUsage({ status: 'error' })
    }
  }, [status.status])

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const next = await jsonRequest<AccountStatus>(CODEX_AUTH_STATUS_PATH)
      setStatus(next)
      if (next.status !== 'signing-in') {
        setChallenge(undefined)
        setCopyStatus('idle')
      }
    } catch (error: unknown) {
      setStatus(error instanceof AccountRequestError && error.code === 'remote-web-origin-not-trusted'
        ? { status: 'remote-web-origin-not-trusted' }
        : { status: 'error', message: error instanceof Error ? error.message : t('requestFailed') })
    }
  }, [t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (status.status !== 'signing-in') return
    const timer = window.setInterval(() => { void refresh() }, 1_000)
    return () => { window.clearInterval(timer) }
  }, [refresh, status.status])

  useEffect(() => {
    if (status.status !== 'signed-in') {
      setUsage({ status: 'hidden' })
      return
    }
    void refreshUsage()
    const timer = window.setInterval(() => { void refreshUsage() }, 60_000)
    return () => { window.clearInterval(timer) }
  }, [refreshUsage, status.status])

  const signIn = async (): Promise<void> => {
    const popup = window.open('about:blank', '_blank')
    if (popup === null) {
      setStatus({ status: 'error', message: t('popupBlocked') })
      return
    }
    popup.opener = null
    setBusy(true)
    setStatus({ status: 'signing-in' })
    setChallenge(undefined)
    setCopyStatus('idle')
    try {
      const next = await jsonRequest<LoginChallenge>(CODEX_AUTH_LOGIN_PATH, 'POST')
      setChallenge(next)
      popup.location.replace(next.verificationUri)
    } catch (error: unknown) {
      popup.close()
      setChallenge(undefined)
      setCopyStatus('idle')
      setStatus(error instanceof AccountRequestError && error.code === 'remote-web-origin-not-trusted'
        ? { status: 'remote-web-origin-not-trusted' }
        : { status: 'error', message: error instanceof Error ? error.message : t('requestFailed') })
    } finally {
      setBusy(false)
    }
  }

  const signOut = async (): Promise<void> => {
    setBusy(true)
    try {
      await jsonRequest<{ ok: true }>(CODEX_AUTH_LOGOUT_PATH, 'POST')
      setStatus({ status: 'signed-out' })
      setUsage({ status: 'hidden' })
      setChallenge(undefined)
      setCopyStatus('idle')
    } catch (error: unknown) {
      setStatus({ status: 'error', message: error instanceof Error ? error.message : t('requestFailed') })
    } finally {
      setBusy(false)
    }
  }

  const copyAuthorizationCode = async (): Promise<void> => {
    if (challenge === undefined) return
    try {
      await copyTextToClipboard(challenge.userCode)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  const label = status.status === 'signed-in'
    ? t('signedIn')
    : status.status === 'loading'
      ? t('loading')
      : status.status === 'signing-in'
        ? t('signingIn')
        : status.status === 'remote-web-origin-not-trusted'
          ? t('remoteOrigin')
          : status.status === 'error'
            ? t('requestFailed')
            : t('signedOut')

  return (
    <li style={{ ...cardStyle, ...(open ? cardOpenStyle : {}) }}>
      <button
        type="button"
        style={headerStyle}
        aria-expanded={open}
        aria-label={`${t(open ? 'collapse' : 'expand')}: ${t('title')}`}
        onClick={() => { setOpen(!open) }}
      >
        <span style={headTextStyle}>
          <span style={nameStyle}>{t('title')}</span>
          <span style={descriptionStyle}>{t('intro')}</span>
        </span>
        <Chevron open={open} />
      </button>
      {open ? (
        <div style={cardBodyStyle}>
          <div style={rowStyle}>
            <div style={statusStyle} role="status">
              <span aria-hidden="true" style={dotStyle(status.status)} />
              <span>{label}</span>
            </div>
            {status.status === 'loading' || status.status === 'remote-web-origin-not-trusted'
              ? null
              : status.status === 'signed-in'
                ? <button type="button" style={buttonStyle} disabled={busy} onClick={() => { void signOut() }}>{busy ? t('working') : t('signOut')}</button>
                : <button type="button" style={primaryButtonStyle} disabled={busy} onClick={() => { void signIn() }}>{busy ? t('working') : t('signIn')}</button>}
          </div>
          {status.status === 'error' ? <p style={errorStyle}>{status.message}</p> : null}
          {status.status === 'remote-web-origin-not-trusted' ? <p style={errorStyle}>{t('remoteOrigin')}</p> : null}
          {usage.status !== 'hidden' && status.status === 'signed-in' ? (
            <div style={usageStyle} aria-label={t('usageTitle')}>
              <div style={usageHeaderStyle}>
                <span style={usageTitleStyle}>{t('usageTitle')}</span>
                <button type="button" style={{ ...buttonStyle, minHeight: 28, padding: '3px 10px', fontSize: 12 }} onClick={() => { void refreshUsage() }}>
                  {t('refreshUsage')}
                </button>
              </div>
              {usage.status === 'loading' ? <p style={bodyStyle}>{t('usageLoading')}</p> : null}
              {usage.status === 'error' ? <p style={errorStyle}>{t('usageUnavailable')}</p> : null}
              {usage.status === 'ready' ? (
                <>
                  <UsageWindowView label={t('usageWeekly')} value={weeklyWindow(usage.usage)} t={t} />
                  {weeklyWindow(usage.usage) === undefined ? <p style={bodyStyle}>{t('usageNoWindow')}</p> : null}
                </>
              ) : null}
            </div>
          ) : null}
          {status.status === 'signing-in' && challenge !== undefined ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={bodyStyle}>{t('authorizationCodeHelp')}</p>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <code aria-label={t('authorizationCodeLabel')} style={codeStyle}>{challenge.userCode}</code>
                <button type="button" style={buttonStyle} onClick={() => { void copyAuthorizationCode() }}>
                  {copyStatus === 'copied' ? t('authorizationCodeCopied') : t('copyAuthorizationCode')}
                </button>
                <a href={challenge.verificationUri} target="_blank" rel="noreferrer" style={{ ...buttonStyle, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                  {t('openAuthorization')}
                </a>
              </div>
              {copyStatus === 'failed' ? <p style={errorStyle}>{t('authorizationCodeCopyFailed')}</p> : null}
            </div>
          ) : null}
          <CodexGlobalModel connection={connection} t={t} />
          <CodexCapabilities scope={configScope} t={t} />
        </div>
      ) : null}
    </li>
  )
}
