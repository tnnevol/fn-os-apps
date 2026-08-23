/** Settings card for the fnOS shared-directory authorization list. */

import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { FnosLocaleKey } from './locales.ts'
import { diagnosePickerResult, isPickerCancellation, isPickerNoSelection, logPickerSdkEvent, logPickerSdkValue } from './picker-result.ts'
import { isEmbeddedFnosFrame } from './sdk-carrier.ts'
import { createTrimApp } from './sdk.ts'
import { requestSettingsDocumentPath } from './settings-document-client.ts'
import {
  DirectoryRequestError,
  requestAuthorizedDirectories,
} from './authorized-directories-client.ts'
import {
  FNOS_AUTHORIZED_DIRECTORIES_DELETE_PATH,
  FNOS_AUTHORIZED_DIRECTORIES_PATH,
  type AuthorizedDirectory,
} from '../authorized-directories-contract.ts'

type Translate = (key: FnosLocaleKey) => string

type LoadState =
  | { status: 'idle'; directories: AuthorizedDirectory[] }
  | { status: 'loading'; directories: AuthorizedDirectory[] }
  | { status: 'ready'; directories: AuthorizedDirectory[] }
  | { status: 'error'; directories: AuthorizedDirectory[]; code?: string }

export type AuthorizedDirectoriesCardProps = PropsRuntime<'settings.plugin.item'> & {
  t: Translate
}

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
const cardBodyStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--dsw-alias-border-l2)', margin: '0 16px', padding: '12px 0 8px' }
const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }
const buttonStyle: CSSProperties = { boxSizing: 'border-box', minHeight: 30, padding: '4px 12px', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 16, background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 13, cursor: 'pointer' }
const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  border: 0,
  background: 'var(--dsw-alias-button-primary-fill)',
  color: 'var(--dsw-alias-label-primary-foreground)',
}
const pathListStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, margin: 0, padding: 0, listStyle: 'none' }
const pathRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 9, background: 'var(--dsw-alias-bg-layer-1)' }
const pathStyle: CSSProperties = { minWidth: 0, overflow: 'hidden', color: 'var(--dsw-alias-label-primary)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const readOnlyStyle: CSSProperties = { flex: '0 0 auto', color: 'var(--dsw-alias-label-tertiary)', fontSize: 12, whiteSpace: 'nowrap' }
const dangerButtonStyle: CSSProperties = { ...buttonStyle, minHeight: 28, padding: '3px 9px', color: 'var(--dsw-alias-state-error-primary, #d92d20)', flex: '0 0 auto' }
const AUTHORIZED_DIRECTORY_LOG_PREFIX = '[dsh-fnos][authorized-directories]'

function logAuthorizedDirectoryEvent(stage: string, details: Record<string, unknown>): void {
  console.info(AUTHORIZED_DIRECTORY_LOG_PREFIX, stage, details)
}

function logAuthorizedDirectoryWarning(stage: string, details: Record<string, unknown>): void {
  console.warn(AUTHORIZED_DIRECTORY_LOG_PREFIX, stage, details)
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span aria-hidden="true" style={{ color: 'var(--dsw-alias-label-tertiary)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease' }}>
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
    if (open) void refresh()
  }, [open, refresh])

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

  const openSettingsDocument = useCallback(async (): Promise<void> => {
    if (!isEmbeddedFnosFrame()) return
    setBusy(true)
    try {
      const path = await requestSettingsDocumentPath()
      const sdk = createTrimApp()
      await sdk.ready()
      if (!sdk.isWeb || sdk.isStandaloneWeb) throw new Error('fnOS iframe SDK did not initialize its web carrier')
      await sdk.openFile(path)
    } catch (error: unknown) {
      logAuthorizedDirectoryWarning('settings-document-open-failed', {
        errorType: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : undefined,
      })
      setState(current => ({ status: 'error', directories: current.directories, code: t('settingsDocumentOpenFailed') }))
    } finally {
      setBusy(false)
    }
  }, [t])

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
    <div style={open ? { ...cardStyle, ...cardOpenStyle } : cardStyle}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="dsh-fnos-authorized-directories-body"
        style={headerStyle}
        onClick={() => setOpen(value => !value)}
      >
        <span style={headTextStyle}>
          <span style={nameStyle}>{t('title')}</span>
          <span style={descriptionStyle}>{t('intro')}</span>
        </span>
        <Chevron open={open} />
      </button>
      {open ? (
        <div id="dsh-fnos-authorized-directories-body" style={cardBodyStyle}>
          <div style={rowStyle}>
            <button type="button" style={primaryButtonStyle} disabled={busy || state.status === 'loading'} onClick={() => { void addDirectory() }}>
              {t('add')}
            </button>
            <button type="button" style={buttonStyle} disabled={busy || state.status === 'loading' || !isEmbeddedFnosFrame()} onClick={() => { void openSettingsDocument() }}>
               {t('openSettingsDocument')}
             </button>
             <button type="button" style={buttonStyle} disabled={busy || state.status === 'loading'} onClick={() => { void refresh() }}>
              {t('refresh')}
            </button>
          </div>
          {state.status === 'loading' ? <p style={bodyStyle}>{t('loading')}</p> : null}
          {state.status === 'error' ? <p style={errorStyle}>{state.code ?? t('loadFailed')}</p> : null}
          {state.status !== 'loading' && state.directories.length === 0 ? <p style={bodyStyle}>{t('empty')}</p> : null}
          {state.directories.length > 0 ? (
            <ul style={pathListStyle}>
              {state.directories.map(directory => (
                <li key={directory.path} style={pathRowStyle}>
                  <span title={directory.semanticPath} style={pathStyle}>{directory.semanticPath}</span>
                  {directory.removable ? (
                    <button type="button" style={dangerButtonStyle} disabled={busy} onClick={() => { void removeDirectory(directory.path) }}>
                      {t('delete')}
                    </button>
                  ) : <span style={readOnlyStyle}>{t('sharedDirectory')}</span>}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
