/** Expandable account card for the DSH Plugins settings section. */

import { useCallback, useEffect, useState } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import { DshButton, DshProgress } from '@tnnevol/dsh-semi-ui'
import type { CodexAuthSettingsConfig } from '../contracts/settings-contract.ts'
import type { CodexAuthLocaleKey } from '../client/locales.ts'
import { CodexCapabilities } from './CodexCapabilities.tsx'
import { CodexGlobalModel } from './CodexGlobalModel.tsx'
import { copyTextToClipboard } from '../client/services/copy-to-clipboard.ts'
import { fiveHourWindow, weeklyWindow } from '../client/services/usage-windows.ts'
import type { CodexUsageWindow } from '../client/services/usage-windows.ts'
import {
  CODEX_AUTH_LOGIN_PATH,
  CODEX_AUTH_LOGOUT_PATH,
  CODEX_AUTH_STATUS_PATH,
  CODEX_USAGE_PATH,
} from '../contracts/auth-paths.ts'

type Translate = (key: CodexAuthLocaleKey) => string

type AccountStatus =
  & { dshVersion?: string }
  & (
    | { status: 'loading' }
    | { status: 'signed-out' }
    | { status: 'signing-in' }
    | { status: 'signed-in'; expiresAt?: string }
    | { status: 'error'; message: string }
    | { status: 'remote-web-origin-not-trusted' }
  )

interface LoginChallenge {
  type: 'device_code'
  userCode: string
  verificationUri: string
  intervalSeconds?: number
  expiresInSeconds?: number
}

interface CodexUsage {
  planType?: string
  allowed?: boolean
  limitReached?: boolean
  primaryWindow?: CodexUsageWindow
  secondaryWindow?: CodexUsageWindow
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
  remote: unknown
}

export type CodexAuthCardProps = PropsRuntime<'settings.plugin.item'> & Partial<CodexAuthCardInjected>

function Chevron({ open }: { open: boolean }) {
  return (
    <span aria-hidden="true" className={`dsh-codex-auth-chevron${open ? ' is-open' : ''}`}>
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

function dotClass(status: AccountStatus['status']): string {
  return `dsh-codex-auth-status-dot dsh-codex-auth-status-dot--${status}`
}

function percent(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  return `${Math.round(value)}%`
}

function progressPercent(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function resetLabel(window: CodexUsageWindow | undefined, t: Translate): string | undefined {
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

function UsageWindowView({ label, value, t }: { label: string; value: CodexUsageWindow | undefined; t: Translate }) {
  if (value === undefined) return null
  const reset = resetLabel(value, t)
  return (
    <div className="dsh-codex-auth-usage-window">
      <div className="dsh-codex-auth-usage-window-header">
        <div className="dsh-codex-auth-usage-window-details">
          <span className="dsh-codex-auth-usage-window-title">{label}</span>
          {reset === undefined ? null : <span className="dsh-codex-auth-usage-reset">{reset}</span>}
        </div>
        <div className="dsh-codex-auth-usage-remaining">
          <DshProgress
            percent={progressPercent(value.remainingPercent)}
            size="small"
            showInfo={false}
            aria-label={label}
            aria-valuetext={percent(value.remainingPercent)}
            className="dsh-codex-auth-usage-progress"
          />
          <span className="dsh-codex-auth-usage-remaining-text">{t('usageRemaining')} {percent(value.remainingPercent)}</span>
        </div>
      </div>
    </div>
  )
}

/** Render a standalone login/logout card in the alpha.4 keyed Plugin slot. */
export function CodexAuthCard({ t, configScope, connection, remote }: CodexAuthCardProps) {
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
    <li className={`dsh-codex-auth-card${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="dsh-codex-auth-card-header"
        aria-expanded={open}
        aria-label={`${t(open ? 'collapse' : 'expand')}: ${t('title')}`}
        onClick={() => { setOpen(!open) }}
      >
        <span className="dsh-codex-auth-card-head-text">
          <span className="dsh-codex-auth-card-name">{t('title')}</span>
          <span className="dsh-codex-auth-card-description">{t('intro')}</span>
        </span>
        <Chevron open={open} />
      </button>
      {open ? (
        <div className="dsh-codex-auth-card-body">
          <div className="dsh-codex-auth-row">
            <div className="dsh-codex-auth-status" role="status">
              <span aria-hidden="true" className={dotClass(status.status)} />
              <span>{label}</span>
            </div>
            {status.status === 'loading' || status.status === 'remote-web-origin-not-trusted'
              ? null
              : status.status === 'signed-in'
                ? <DshButton htmlType="button" theme="solid" type="primary" disabled={busy} loading={busy} onClick={() => { void signOut() }}>{busy ? t('working') : t('signOut')}</DshButton>
                : <DshButton htmlType="button" theme="solid" type="primary" disabled={busy} loading={busy} onClick={() => { void signIn() }}>{busy ? t('working') : t('signIn')}</DshButton>}
          </div>
          {status.status === 'error' ? <p className="dsh-codex-auth-error">{status.message}</p> : null}
          {status.status === 'remote-web-origin-not-trusted' ? <p className="dsh-codex-auth-error">{t('remoteOrigin')}</p> : null}
          {usage.status !== 'hidden' && status.status === 'signed-in' ? (
            <div className="dsh-codex-auth-usage" aria-label={t('usageTitle')}>
              <div className="dsh-codex-auth-usage-header">
                <span className="dsh-codex-auth-usage-title">{t('usageTitle')}</span>
                <DshButton htmlType="button" theme="outline" type="secondary" size="small" onClick={() => { void refreshUsage() }}>{t('refreshUsage')}</DshButton>
              </div>
              {usage.status === 'loading' ? <p className="dsh-codex-auth-body">{t('usageLoading')}</p> : null}
              {usage.status === 'error' ? <p className="dsh-codex-auth-error">{t('usageUnavailable')}</p> : null}
              {usage.status === 'ready' ? (
                <>
                  <UsageWindowView label={t('usageFiveHour')} value={fiveHourWindow(usage.usage)} t={t} />
                  <UsageWindowView label={t('usageWeekly')} value={weeklyWindow(usage.usage)} t={t} />
                  {fiveHourWindow(usage.usage) === undefined && weeklyWindow(usage.usage) === undefined
                    ? <p className="dsh-codex-auth-body">{t('usageNoWindow')}</p>
                    : null}
                </>
              ) : null}
            </div>
          ) : null}
          {status.status === 'signing-in' && challenge !== undefined ? (
            <div className="dsh-codex-auth-signing-in">
              <p className="dsh-codex-auth-body">{t('authorizationCodeHelp')}</p>
              <div className="dsh-codex-auth-signing-in-actions">
                <code aria-label={t('authorizationCodeLabel')} className="dsh-codex-auth-code">{challenge.userCode}</code>
                <DshButton htmlType="button" theme="outline" type="secondary" size="small" onClick={() => { void copyAuthorizationCode() }}>
                  {copyStatus === 'copied' ? t('authorizationCodeCopied') : t('copyAuthorizationCode')}
                </DshButton>
                <DshButton
                  htmlType="button"
                  theme="outline"
                  type="secondary"
                  size="small"
                  onClick={() => { window.open(challenge.verificationUri, '_blank', 'noopener,noreferrer') }}
                >
                  {t('openAuthorization')}
                </DshButton>
              </div>
              {copyStatus === 'failed' ? <p className="dsh-codex-auth-error">{t('authorizationCodeCopyFailed')}</p> : null}
            </div>
          ) : null}
          <CodexGlobalModel connection={connection} remote={remote} t={t} />
          <CodexCapabilities scope={configScope} t={t} dshVersion={status.dshVersion} />
        </div>
      ) : null}
    </li>
  )
}
