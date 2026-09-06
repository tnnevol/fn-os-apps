/** Account and model settings for the Codex Auth plugin. */

import { useCallback, useEffect, useState } from 'react'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import { DshButton } from '@tnnevol/dsh-semi-ui'
import type { CodexAuthLocaleKey } from '../client/locales.ts'
import { CodexGlobalModel } from './CodexGlobalModel.tsx'
import { copyTextToClipboard } from '../client/services/copy-to-clipboard.ts'
import {
  CODEX_AUTH_LOGIN_PATH,
  CODEX_AUTH_LOGOUT_PATH,
  CODEX_AUTH_STATUS_PATH,
  CODEX_MODEL_REFRESH_PATH,
} from '../contracts/auth-paths.ts'

type Translate = (key: CodexAuthLocaleKey) => string

const CODEX_MODEL_REFRESH_FAILED_CODE = 'codex-model-refresh-failed'

type AccountStatus =
  (
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

interface RefreshedCodexModel {
  id: string
  name: string
  reasoningEfforts: Record<string, string> | false
}

interface ModelRefreshResponse {
  ok: true
  models: RefreshedCodexModel[]
  skipped: string[]
}

type ModelRefreshState =
  | { status: 'idle' }
  | { status: 'busy' }
  | { status: 'done'; count: number }
  | { status: 'error'; message: string }

export interface CodexAuthSectionInjected {
  t: Translate
  connection: ConnectionHandle
  remote: unknown
}

export type CodexAuthSectionProps = CodexAuthSectionInjected

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

/** Render a standalone login/logout page for the Settings section slot. */
export function CodexAuthSection({ t, connection, remote }: CodexAuthSectionProps) {
  if (t === undefined) throw new Error('Codex auth section requires its translation function')
  if (connection === undefined) throw new Error('Codex auth section requires the DSH connection')
  const [status, setStatus] = useState<AccountStatus>({ status: 'loading' })
  const [busy, setBusy] = useState(false)
  const [challenge, setChallenge] = useState<LoginChallenge | undefined>()
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [modelRefresh, setModelRefresh] = useState<ModelRefreshState>({ status: 'idle' })
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0)

  const refreshModels = useCallback(async (): Promise<void> => {
    if (status.status !== 'signed-in' || modelRefresh.status === 'busy') return
    setModelRefresh({ status: 'busy' })
    try {
      const response = await jsonRequest<ModelRefreshResponse>(CODEX_MODEL_REFRESH_PATH, 'POST')
      setModelRefresh({ status: 'done', count: response.models.length })
      setCatalogRefreshKey(current => current + 1)
    } catch (error: unknown) {
      setModelRefresh({
        status: 'error',
        message: error instanceof AccountRequestError
          ? error.code === CODEX_MODEL_REFRESH_FAILED_CODE
            ? t('modelRefreshFailed')
            : error.message
          : error instanceof Error ? error.message : t('modelRefreshFailed'),
      })
    }
  }, [status.status, modelRefresh.status, t])

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
      void copyAuthorizationCode(next.userCode)
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
      setChallenge(undefined)
      setCopyStatus('idle')
    } catch (error: unknown) {
      setStatus({ status: 'error', message: error instanceof Error ? error.message : t('requestFailed') })
    } finally {
      setBusy(false)
    }
  }

  const copyAuthorizationCode = async (code = challenge?.userCode): Promise<void> => {
    if (code === undefined) return
    try {
      await copyTextToClipboard(code)
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
    <div className="dsh-codex-auth-section">
      <h2 className="dsh-codex-auth-section-title">{t('title')}</h2>
      <p className="dsh-codex-body dsh-codex-auth-section-desc">{t('intro')}</p>
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
      <CodexGlobalModel connection={connection} remote={remote} catalogRefreshKey={catalogRefreshKey} t={t} />
      {status.status === 'signed-in' ? (
        <section className="dsh-codex-model-refresh" aria-labelledby="dsh-codex-model-refresh-title">
          <div className="dsh-codex-model-refresh-header">
            <div>
              <h3 id="dsh-codex-model-refresh-title" className="dsh-codex-section-heading">{t('modelRefreshTitle')}</h3>
              <p className="dsh-codex-body dsh-codex-model-refresh-intro">{t('modelRefreshIntro')}</p>
            </div>
            <DshButton
              htmlType="button"
              theme="outline"
              type="secondary"
              size="small"
              disabled={modelRefresh.status === 'busy'}
              loading={modelRefresh.status === 'busy'}
              onClick={() => { void refreshModels() }}
            >
              {modelRefresh.status === 'busy' ? t('modelRefreshing') : t('modelRefreshAction')}
            </DshButton>
          </div>
          <p className="dsh-codex-body dsh-codex-model-refresh-status" aria-live="polite">
            {modelRefresh.status === 'done'
              ? t('modelRefreshDone').replace('{count}', String(modelRefresh.count))
              : modelRefresh.status === 'error'
                ? modelRefresh.message
                : ''}
          </p>
        </section>
      ) : null}
    </div>
  )
}
