/** Settings card for the fnOS shared-directory authorization list. */

import { useCallback, useEffect, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { FnosLocaleKey } from '../client/locales.ts'
import { diagnosePickerResult, isPickerCancellation, isPickerNoSelection, logPickerSdkEvent, logPickerSdkValue } from '../client/input-references/picker-result.ts'
import { createTrimApp } from '../client/services/sdk.ts'
import {
  DirectoryRequestError,
  requestAuthorizedDirectories,
} from '../client/services/authorized-directories-client.ts'
import {
  FNOS_AUTHORIZED_DIRECTORIES_DELETE_PATH,
  FNOS_AUTHORIZED_DIRECTORIES_PATH,
  type AuthorizedDirectory,
} from '../contracts/authorized-directories-contract.ts'
import { FNOS_GATEWAY_PROXY_PATHS_ROUTE } from '../contracts/gateway-proxy-contract.ts'

type Translate = (key: FnosLocaleKey) => string

type LoadState =
  | { status: 'idle'; directories: AuthorizedDirectory[] }
  | { status: 'loading'; directories: AuthorizedDirectory[] }
  | { status: 'ready'; directories: AuthorizedDirectory[] }
  | { status: 'error'; directories: AuthorizedDirectory[]; code?: string }

export type AuthorizedDirectoriesCardProps = PropsRuntime<'settings.plugin.item'> & {
  t: Translate
}

const AUTHORIZED_DIRECTORY_LOG_PREFIX = '[dsh-fnos][authorized-directories]'

function logAuthorizedDirectoryEvent(stage: string, details: Record<string, unknown>): void {
  console.info(AUTHORIZED_DIRECTORY_LOG_PREFIX, stage, details)
}

function logAuthorizedDirectoryWarning(stage: string, details: Record<string, unknown>): void {
  console.warn(AUTHORIZED_DIRECTORY_LOG_PREFIX, stage, details)
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span aria-hidden="true" className={`dsh-fnos-authorized-chevron${open ? ' is-open' : ''}`}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2.15 5.5 3 4.65l3.73 3.73a.38.38 0 0 0 .54 0L11 4.65l.85.85-2.73 2.73c-.58.58-.9.9-1.4 1.03a2.1 2.1 0 0 1-.94 0c-.5-.13-.82-.45-1.4-1.03L2.15 5.5Z" fill="currentColor" />
      </svg>
    </span>
  )
}

async function jsonRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers: HeadersInit = { accept: 'application/json' }
  if (typeof navigator === 'object' && typeof navigator.language === 'string' && navigator.language.length > 0) {
    headers['accept-language'] = navigator.language
  }
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
    throw new DirectoryRequestError(code)
  }
  return value as T
}

function errorMessage(error: unknown, t: Translate, action: 'load' | 'pick' | 'delete'): string {
  logAuthorizedDirectoryWarning('user-visible-error', {
    action,
    errorType: error instanceof Error ? error.name : typeof error,
    code: error instanceof DirectoryRequestError ? error.code : undefined,
    message: error instanceof Error ? error.message : undefined,
  })
  if (error instanceof DirectoryRequestError) {
    if (error.code === 'fnos-authorized-directory-permission-denied') return t('permissionDenied')
    if (error.code === 'remote-web-origin-not-trusted') return t('originNotTrusted')
    if (error.code === 'fnos-authorized-directory-request-failed') return t('unavailable')
  }
  if (action === 'pick') return t('pickFailed')
  if (action === 'delete') return t('deleteFailed')
  return t('loadFailed')
}

/** Render the fnOS authorization card in the DSH Plugins settings tab. */
export function AuthorizedDirectoriesCard({ t }: AuthorizedDirectoriesCardProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<LoadState>({ status: 'idle', directories: [] })
  const [busy, setBusy] = useState(false)
  const [savedProxyPaths, setSavedProxyPaths] = useState('')
  const [proxyPathsDraft, setProxyPathsDraft] = useState('')
  const [proxyMessage, setProxyMessage] = useState<string>()

  const loadProxyPaths = useCallback(async (): Promise<void> => {
    try {
      const result = await jsonRequest<{ paths?: string[] }>(FNOS_GATEWAY_PROXY_PATHS_ROUTE)
      const text = Array.isArray(result.paths) ? result.paths.join('\n') : ''
      setSavedProxyPaths(text)
      setProxyPathsDraft(text)
      setProxyMessage(undefined)
    } catch { setProxyMessage(t('gatewayProxyFailed')) }
  }, [t])

  const refresh = useCallback(async (): Promise<void> => {
    logAuthorizedDirectoryEvent('refresh-start', {})
    setState(current => ({ status: 'loading', directories: current.directories }))
    try {
      const directories = await requestAuthorizedDirectories()
      logAuthorizedDirectoryEvent('refresh-success', { count: directories.length })
      setState({ status: 'ready', directories })
    } catch (error: unknown) {
      logAuthorizedDirectoryWarning('refresh-failed', {
        errorType: error instanceof Error ? error.name : typeof error,
        code: error instanceof DirectoryRequestError ? error.code : undefined,
        message: error instanceof Error ? error.message : undefined,
      })
      setState(current => ({ status: 'error', directories: current.directories, code: errorMessage(error, t, 'load') }))
    }
  }, [t])

  useEffect(() => {
    if (open) { void refresh(); void loadProxyPaths() }
  }, [loadProxyPaths, open, refresh])

  const saveProxyPaths = useCallback(async (): Promise<void> => {
    setBusy(true)
    try {
      const paths = proxyPathsDraft.split(/\r?\n/u).map(value => value.trim()).filter(Boolean)
      const result = await jsonRequest<{ paths: string[] }>(FNOS_GATEWAY_PROXY_PATHS_ROUTE, 'PUT', { version: 1, paths })
      const text = result.paths.join('\n')
      setSavedProxyPaths(text)
      setProxyPathsDraft(text)
      setProxyMessage(t('gatewayProxySaved'))
    } catch (error: unknown) {
      setProxyMessage(error instanceof DirectoryRequestError && error.code === 'invalid-gateway-proxy-paths' ? t('gatewayProxyInvalid') : t('gatewayProxyFailed'))
    }
    finally { setBusy(false) }
  }, [proxyPathsDraft, t])

  const addDirectory = useCallback(async (): Promise<void> => {
    setBusy(true)
    let phase = 'createTrimApp'
    try {
      const sdk = createTrimApp()
      const params = {
        title: t('add'),
        okText: t('confirm'),
        sidebarGroup: ['myFiles', 'otherShare', 'external', 'remote', 'favorites'],
      } as const
      logPickerSdkEvent('created', {
        isWeb: sdk.isWeb,
        isStandaloneWeb: sdk.isStandaloneWeb,
        params: {
          title: params.title,
          okText: params.okText,
          sidebarGroup: params.sidebarGroup,
        },
      })

      phase = 'ready'
      await sdk.ready()
      logPickerSdkEvent('ready', { isWeb: sdk.isWeb, isStandaloneWeb: sdk.isStandaloneWeb })

      phase = 'pickSharedFile'
      const result = await sdk.pickSharedFile(params)
      const diagnosis = logPickerSdkValue('resolved', result)
      const noSelection = isPickerNoSelection(result)
      logAuthorizedDirectoryEvent('picker-decision', {
        outcome: diagnosis.outcome,
        reason: diagnosis.reason,
        code: diagnosis.code,
        status: diagnosis.status,
        noSelection,
      })
      if (diagnosis.outcome === 'cancelled' || noSelection) {
        logAuthorizedDirectoryEvent('picker-silent-cancel', { reason: noSelection ? 'empty-success-data' : diagnosis.reason })
        return
      }
      if (diagnosis.outcome !== 'success') {
        throw new DirectoryRequestError(
          diagnosis.code === 1 ? 'fnos-authorized-directory-permission-denied' : 'fnos-authorized-directory-request-failed',
          diagnosis.message ?? diagnosis.error ?? `fnOS picker returned ${diagnosis.reason}`,
        )
      }
      await refresh()
    } catch (error: unknown) {
      const diagnosis = diagnosePickerResult(error)
      logPickerSdkEvent('rejected', { phase, diagnosis })
      logAuthorizedDirectoryWarning('picker-catch', {
        phase,
        outcome: diagnosis.outcome,
        reason: diagnosis.reason,
        code: diagnosis.code,
        message: diagnosis.message,
      })
      if (phase === 'pickSharedFile') {
        logAuthorizedDirectoryEvent('picker-silent-cancel', { reason: diagnosis.reason, outcome: diagnosis.outcome })
        return
      }
      if (isPickerCancellation(error)) return
      setState(current => ({ status: 'error', directories: current.directories, code: errorMessage(error, t, 'pick') }))
    } finally {
      setBusy(false)
    }
  }, [refresh, t])

  const removeDirectory = useCallback(async (path: string): Promise<void> => {
    if (!window.confirm(t('deleteConfirm'))) return
    setBusy(true)
    try {
      await jsonRequest(FNOS_AUTHORIZED_DIRECTORIES_DELETE_PATH, 'POST', { path })
      await refresh()
    } catch (error: unknown) {
      setState(current => ({ status: 'error', directories: current.directories, code: errorMessage(error, t, 'delete') }))
    } finally {
      setBusy(false)
    }
  }, [refresh, t])

  return (
    <div className={`dsh-fnos-authorized-card${open ? ' is-open' : ''}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="dsh-fnos-authorized-directories-body"
        className="dsh-fnos-authorized-card-header"
        onClick={() => setOpen(value => !value)}
      >
        <span className="dsh-fnos-authorized-card-head-text">
          <span className="dsh-fnos-authorized-card-name">{t('title')}</span>
          <span className="dsh-fnos-authorized-card-description">{t('intro')}</span>
        </span>
        <Chevron open={open} />
      </button>
      {open ? (
        <div id="dsh-fnos-authorized-directories-body" className="dsh-fnos-authorized-card-body">
          <div className="dsh-fnos-authorized-row">
            <button type="button" className="dsh-fnos-authorized-button dsh-fnos-authorized-button--primary" disabled={busy || state.status === 'loading'} onClick={() => { void addDirectory() }}>
              {t('add')}
            </button>
             <button type="button" className="dsh-fnos-authorized-button" disabled={busy || state.status === 'loading'} onClick={() => { void refresh() }}>
              {t('refresh')}
            </button>
          </div>
          {state.status === 'loading' ? <p className="dsh-fnos-authorized-body">{t('loading')}</p> : null}
          {state.status === 'error' ? <p className="dsh-fnos-authorized-error">{state.code ?? t('loadFailed')}</p> : null}
          {state.status !== 'loading' && state.directories.length === 0 ? <p className="dsh-fnos-authorized-body">{t('empty')}</p> : null}
          {state.directories.length > 0 ? (
            <ul className="dsh-fnos-authorized-path-list">
              {state.directories.map(directory => (
                <li key={directory.path} className="dsh-fnos-authorized-path-row">
                  <span title={directory.semanticPath} className="dsh-fnos-authorized-path">{directory.semanticPath}</span>
                  {directory.removable ? (
                    <button type="button" className="dsh-fnos-authorized-button dsh-fnos-authorized-button--danger" disabled={busy} onClick={() => { void removeDirectory(directory.path) }}>
                      {t('delete')}
                    </button>
                  ) : <span className="dsh-fnos-authorized-read-only">{t('sharedDirectory')}</span>}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="dsh-fnos-authorized-gateway">
            <strong className="dsh-fnos-authorized-gateway-title">{t('gatewayProxyTitle')}</strong>
            <p className="dsh-fnos-authorized-body dsh-fnos-authorized-gateway-description">{t('gatewayProxyDescription')}</p>
            <textarea value={proxyPathsDraft} placeholder={t('gatewayProxyPlaceholder')} className="dsh-fnos-authorized-textarea" disabled={busy} onChange={event => { setProxyPathsDraft(event.currentTarget.value); setProxyMessage(undefined) }} />
            {proxyMessage === undefined ? null : <p className="dsh-fnos-authorized-body dsh-fnos-authorized-gateway-message">{proxyMessage}</p>}
            <div className="dsh-fnos-authorized-row dsh-fnos-authorized-row--end">
              <button type="button" className="dsh-fnos-authorized-button" disabled={busy || proxyPathsDraft === savedProxyPaths} onClick={() => { setProxyPathsDraft(savedProxyPaths); setProxyMessage(undefined) }}>{t('discard')}</button>
              <button type="button" className="dsh-fnos-authorized-button dsh-fnos-authorized-button--primary" disabled={busy || proxyPathsDraft === savedProxyPaths} onClick={() => { void saveProxyPaths() }}>{t('save')}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
