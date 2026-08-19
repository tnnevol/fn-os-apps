/** fnOS-aware directory flow rendered inside DSH's native workspace picker. */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { DirectoryFlowOwnerProps } from '@deepseek-ai/dsh-client-ui-workspace/client'
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { IconFolderOpen16, IconSearchOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { createTrimApp } from './sdk.ts'
import { isPickerCancellation } from './picker-result.ts'
import { requestAuthorizedDirectories, DirectoryRequestError } from './authorized-directories-client.ts'
import type { AuthorizedDirectory } from '../authorized-directories-contract.ts'
import type { FnosLocaleKey } from './locales.ts'
import { FnosColorLogo } from './FnosLogo.tsx'

type WorkspaceDirectoryFlowProps = DirectoryFlowOwnerProps & PropsLocale<'settings.dsh-fnos'>

type FlowState =
  | { status: 'idle'; directories: AuthorizedDirectory[] }
  | { status: 'loading'; directories: AuthorizedDirectory[] }
  | { status: 'ready'; directories: AuthorizedDirectory[] }
  | { status: 'error'; directories: AuthorizedDirectory[]; message: string }

type Translate = (key: FnosLocaleKey) => string

function pickerPaths(value: unknown): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return []
  const data = (value as Record<string, unknown>).data
  return Array.isArray(data) ? data.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : []
}

function pickerSucceeded(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const code = (value as Record<string, unknown>).code
  return code === undefined || code === 0 || code === '0'
}

function pickerMessage(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const message = record.msg ?? record.message
  return typeof message === 'string' && message.length > 0 ? message : undefined
}

function errorText(error: unknown, t: Translate): string {
  if (error instanceof DirectoryRequestError) {
    if (error.code === 'fnos-authorized-directory-permission-denied') return t('permissionDenied')
    if (error.code === 'remote-web-origin-not-trusted') return t('originNotTrusted')
  }
  return t('workspaceLoadFailed')
}

function WorkspaceDirectoryRow({ directory, disabled, onPick }: {
  directory: AuthorizedDirectory
  disabled: boolean
  onPick: (path: string) => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={directory.semanticPath}
      onMouseDown={event => event.preventDefault()}
      onClick={() => { onPick(directory.path) }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        minWidth: 0,
        padding: '10px 12px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 10,
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background 150ms ease, border-color 150ms ease, transform 100ms ease',
      }}
      onMouseEnter={event => {
        if (disabled) return
        event.currentTarget.style.background = 'var(--dsw-alias-interactive-bg-hover)'
        event.currentTarget.style.borderColor = 'var(--dsw-alias-brand-primary)'
      }}
      onMouseLeave={event => {
        event.currentTarget.style.background = 'var(--dsw-alias-bg-layer-1)'
        event.currentTarget.style.borderColor = 'var(--dsw-alias-border-l2)'
      }}
    >
      <span style={{ display: 'inline-flex', flex: '0 0 auto', color: 'var(--dsw-alias-label-secondary)' }}>
        <IconFolderOpen16 size={16} />
      </span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {directory.semanticPath}
      </span>
    </button>
  )
}

/**
 * Occupy DSH's directory-flow child slot. The parent workspace picker keeps
 * ownership of adoption, closing and error recovery; this component only
 * supplies fnOS-authorized path choices.
 */
export function FnosWorkspaceDirectoryFlow({ open, busy, onPicked, onCancel, t }: WorkspaceDirectoryFlowProps) {
  const [state, setState] = useState<FlowState>({ status: 'idle', directories: [] })
  const [query, setQuery] = useState('')
  const [pickerBusy, setPickerBusy] = useState(false)
  const settled = useRef(false)

  useEffect(() => {
    if (!open) {
      settled.current = false
      return
    }
    let cancelled = false
    settled.current = false
    setQuery('')
    setState(current => ({ status: 'loading', directories: current.directories }))
    void requestAuthorizedDirectories().then(
      directories => {
        if (!cancelled) setState({ status: 'ready', directories })
      },
      error => {
        if (!cancelled) setState(current => ({ status: 'error', directories: current.directories, message: errorText(error, t) }))
      },
    )
    return () => { cancelled = true }
  }, [open, t])

  const visibleDirectories = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (normalized.length === 0) return state.directories
    return state.directories.filter(directory => (
      directory.semanticPath.toLocaleLowerCase().includes(normalized)
      || directory.path.toLocaleLowerCase().includes(normalized)
    ))
  }, [query, state.directories])

  const pickPath = (path: string): void => {
    if (busy || pickerBusy || settled.current) return
    settled.current = true
    onPicked(path)
  }

  const chooseAnotherDirectory = async (): Promise<void> => {
    if (busy || pickerBusy || settled.current) return
    setPickerBusy(true)
    setState(current => current.status === 'error' ? current : { status: current.status, directories: current.directories })
    try {
      const sdk = createTrimApp()
      await sdk.ready()
      if (sdk.isStandaloneWeb) {
        setState(current => ({ status: 'error', directories: current.directories, message: t('workspacePickerUnavailable') }))
        return
      }
      const result = await sdk.pickUserFile({
        directory: true,
        multiple: false,
        title: t('workspaceOther'),
        okText: t('workspaceSelect'),
      })
      if (isPickerCancellation(result)) return
      if (!pickerSucceeded(result)) {
        setState(current => ({ status: 'error', directories: current.directories, message: pickerMessage(result) ?? t('workspacePickerFailed') }))
        return
      }
      const path = pickerPaths(result)[0]
      if (path !== undefined) pickPath(path)
    } catch (error: unknown) {
      if (!isPickerCancellation(error)) {
        setState(current => ({ status: 'error', directories: current.directories, message: t('workspacePickerFailed') }))
      }
    } finally {
      setPickerBusy(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={() => { if (!busy && !pickerBusy) onCancel() }}
      title={t('workspaceTitle')}
      description={t('workspaceDescription')}
      closeLabel={t('cancel')}
      footer={(
        <>
          <Button
            variant="outline"
            size="sm"
            icon={<FnosColorLogo />}
            disabled={busy || pickerBusy}
            onClick={() => { void chooseAnotherDirectory() }}
          >
            {t('workspaceOther')}
          </Button>
          <Button variant="outline" size="sm" disabled={busy || pickerBusy} onClick={onCancel}>{t('cancel')}</Button>
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        {state.directories.length > 10 && (
          <Input
            value={query}
            aria-label={t('workspaceSearch')}
            placeholder={t('workspaceSearchPlaceholder')}
            icon={<IconSearchOutline16 size={16} />}
            disabled={busy || pickerBusy}
            onChange={event => { setQuery(event.target.value) }}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        )}
        {state.status === 'loading' && <p role="status" style={{ margin: 0, color: 'var(--dsw-alias-label-tertiary)' }}>{t('workspaceLoading')}</p>}
        {state.status === 'error' && <p role="alert" style={{ margin: 0, color: 'var(--dsw-alias-state-error-primary, #d92d20)' }}>{state.message}</p>}
        {state.status !== 'loading' && state.directories.length === 0 && (
          <p style={{ margin: 0, color: 'var(--dsw-alias-label-tertiary)' }}>{t('workspaceEmpty')}</p>
        )}
        {state.directories.length > 0 && visibleDirectories.length === 0 && (
          <p style={{ margin: 0, color: 'var(--dsw-alias-label-tertiary)' }}>{t('workspaceNoMatch')}</p>
        )}
        {visibleDirectories.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', padding: 1 }}>
            {visibleDirectories.map(directory => (
              <WorkspaceDirectoryRow key={directory.path} directory={directory} disabled={busy || pickerBusy} onPick={pickPath} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
