/** DSH-compatible workspace directory flow with an fnOS authorized-path shortcut. */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { DirectoryFlowOwnerProps } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { DirectoryEntry, DirectoryListing } from '@deepseek-ai/dsh-client-runtime/client'
import { Button, IconFolderOpen16, IconSearchOutline16, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { DirectoryRequestError, requestAuthorizedEntries } from './authorized-directories-client.ts'
import type { AuthorizedDirectory } from '../authorized-directories-contract.ts'
import type { FnosLocaleKey } from './locales.ts'
import { FnosMonoLogo } from './FnosLogo.tsx'

type Translate = (key: FnosLocaleKey) => string

type WorkspaceDirectoryFlowProps = DirectoryFlowOwnerProps & PropsLocale<'settings.dsh-fnos'> & {
  listDirectory: (path?: string, signal?: AbortSignal) => Promise<DirectoryListing>
}

type ListingState =
  | { status: 'idle'; listing: DirectoryListing | null; message?: undefined }
  | { status: 'loading'; listing: DirectoryListing | null; message?: undefined }
  | { status: 'ready'; listing: DirectoryListing; message?: undefined }
  | { status: 'error'; listing: DirectoryListing | null; message: string }

type AuthorizedState =
  | { status: 'idle'; directories: AuthorizedDirectory[]; message?: undefined }
  | { status: 'loading'; directories: AuthorizedDirectory[]; message?: undefined }
  | { status: 'ready'; directories: AuthorizedDirectory[]; message?: undefined }
  | { status: 'error'; directories: AuthorizedDirectory[]; message: string }

function failureText(error: unknown, t: Translate): string {
  if (error instanceof DirectoryRequestError && error.code === 'remote-web-origin-not-trusted') return t('originNotTrusted')
  return t('workspaceLoadFailed')
}

/** Workspace shortcuts only show roots that currently exist and are readable. */
async function requestUsableWorkspaceDirectories(): Promise<AuthorizedDirectory[]> {
  const response = await requestAuthorizedEntries()
  return response.entries
    .filter(entry => entry.kind === 'directory')
    .map(entry => ({ path: entry.path, semanticPath: entry.semanticPath, removable: false }))
}

function WorkspaceEntryRow({ entry, selected, disabled, onSelect, onOpen, t }: {
  entry: DirectoryEntry
  selected: boolean
  disabled: boolean
  onSelect: () => void
  onOpen: () => void
  t: Translate
}) {
  return (
    <div
      role="listitem"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 40,
        padding: '4px 8px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 9,
        background: selected ? 'var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover))' : 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
      }}
    >
      <button
        type="button"
        disabled={disabled}
        title={entry.path}
        onMouseDown={event => event.preventDefault()}
        onClick={onSelect}
        style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, padding: 0, border: 0, background: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--dsw-alias-label-secondary)', flex: '0 0 auto' }}><IconFolderOpen16 size={16} /></span>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{entry.name}</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label={t('workspaceOpenDirectory')}
        onMouseDown={event => event.preventDefault()}
        onClick={onOpen}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', width: 28, height: 28, padding: 0, border: 0, borderRadius: 7, background: 'transparent', color: 'var(--dsw-alias-label-tertiary)', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 20 }}
      >
        ›
      </button>
    </div>
  )
}

function AuthorizedPathRow({ directory, disabled, onPick }: {
  directory: AuthorizedDirectory
  disabled: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={directory.semanticPath}
      onMouseDown={event => event.preventDefault()}
      onClick={onPick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0, padding: '9px 10px', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 9, background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', font: 'inherit', textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--dsw-alias-label-secondary)', flex: '0 0 auto' }}><IconFolderOpen16 size={16} /></span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{directory.semanticPath}</span>
    </button>
  )
}

/**
 * The flow keeps DSH's path input/list/open/cancel semantics. The only extra
 * control is the monochrome fnOS mark beside the path input; it opens a
 * plugin-owned authorized-path list and writes the selected real path back to
 * that input. No fnOS SDK picker is involved in this flow.
 */
export function FnosWorkspaceDirectoryFlow({ open, busy, onPicked, onCancel, listDirectory, t }: WorkspaceDirectoryFlowProps) {
  const [state, setState] = useState<ListingState>({ status: 'idle', listing: null })
  const [pathDraft, setPathDraft] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | undefined>()
  const [authorizedOpen, setAuthorizedOpen] = useState(false)
  const [authorizedQuery, setAuthorizedQuery] = useState('')
  const [authorizedState, setAuthorizedState] = useState<AuthorizedState>({ status: 'idle', directories: [] })
  const requestId = useRef(0)
  const settled = useRef(false)

  const navigate = (path?: string): void => {
    const id = ++requestId.current
    setState(current => ({ status: 'loading', listing: current.listing }))
    void listDirectory(path).then(
      listing => {
        if (id !== requestId.current) return
        setState({ status: 'ready', listing })
        setPathDraft(listing.path)
        setSelectedPath(listing.path)
      },
      error => {
        if (id !== requestId.current) return
        setState({ status: 'error', listing: state.listing, message: failureText(error, t) })
      },
    )
  }

  useEffect(() => {
    if (!open) {
      settled.current = false
      return
    }
    settled.current = false
    setAuthorizedOpen(false)
    setAuthorizedQuery('')
    setState(current => ({ status: 'loading', listing: current.listing }))
    navigate(undefined)
    // The flow owns the first listing request for each open edge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!authorizedOpen || authorizedState.status !== 'idle') return
    let cancelled = false
    setAuthorizedState(current => ({ status: 'loading', directories: current.directories }))
    void requestUsableWorkspaceDirectories().then(
      directories => { if (!cancelled) setAuthorizedState({ status: 'ready', directories }) },
      error => { if (!cancelled) setAuthorizedState({ status: 'error', directories: [], message: failureText(error, t) }) },
    )
    return () => { cancelled = true }
  }, [authorizedOpen, authorizedState.status, t])

  const listing = state.listing
  const visibleEntries = useMemo(() => listing?.entries.filter(entry => !entry.hidden) ?? [], [listing])
  const visibleAuthorized = useMemo(() => {
    const query = authorizedQuery.trim().toLocaleLowerCase()
    if (query.length === 0) return authorizedState.directories
    return authorizedState.directories.filter(directory => directory.semanticPath.toLocaleLowerCase().includes(query) || directory.path.toLocaleLowerCase().includes(query))
  }, [authorizedQuery, authorizedState.directories])
  const targetPath = selectedPath ?? (pathDraft.trim().length > 0 ? pathDraft.trim() : undefined)

  const pickAuthorizedPath = (directory: AuthorizedDirectory): void => {
    setPathDraft(directory.path)
    setSelectedPath(directory.path)
    setAuthorizedOpen(false)
  }
  const pick = (): void => {
    if (busy || settled.current || targetPath === undefined) return
    settled.current = true
    onPicked(targetPath)
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onCancel() }}
      title={t('workspaceTitle')}
      description={t('workspaceDescription')}
      closeLabel={t('cancel')}
      footer={(
        <>
          <Button variant="outline" size="sm" disabled={busy} onClick={onCancel}>{t('cancel')}</Button>
          <Button variant="primary" size="sm" disabled={busy || state.status === 'loading' || targetPath === undefined} onClick={pick}>{t('workspaceSelect')}</Button>
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Input
            value={pathDraft}
            aria-label={t('workspacePath')}
            placeholder={t('workspacePathPlaceholder')}
            disabled={busy}
            onChange={event => { setPathDraft(event.target.value); setSelectedPath(undefined) }}
            onKeyDown={event => {
              if (event.key !== 'Enter' || busy || pathDraft.trim().length === 0) return
              event.preventDefault()
              navigate(pathDraft.trim())
            }}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button
            type="button"
            aria-label={t('workspaceAuthorized')}
            aria-expanded={authorizedOpen}
            title={t('workspaceAuthorized')}
            disabled={busy}
            onMouseDown={event => event.preventDefault()}
            onClick={() => { setAuthorizedOpen(value => !value); setAuthorizedState({ status: 'idle', directories: [] }) }}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', width: 32, height: 32, padding: 0, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1 }}
          >
            <FnosMonoLogo size={19} />
          </button>
        </div>
        {authorizedOpen ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 10, background: 'var(--dsw-alias-bg-layer-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ flex: 1, color: 'var(--dsw-alias-label-primary)', fontSize: 13 }}>{t('workspaceAuthorized')}</strong>
              {authorizedState.directories.length > 10 && <Input value={authorizedQuery} aria-label={t('workspaceSearch')} placeholder={t('workspaceSearchPlaceholder')} icon={<IconSearchOutline16 size={16} />} onChange={event => { setAuthorizedQuery(event.target.value) }} style={{ width: 180 }} />}
            </div>
            {authorizedState.status === 'loading' && <p role="status" style={{ margin: 0, color: 'var(--dsw-alias-label-tertiary)' }}>{t('workspaceLoading')}</p>}
            {authorizedState.status === 'error' && <p role="alert" style={{ margin: 0, color: 'var(--dsw-alias-state-error-primary, #d92d20)' }}>{authorizedState.message}</p>}
            {authorizedState.status !== 'loading' && authorizedState.directories.length === 0 && <p style={{ margin: 0, color: 'var(--dsw-alias-label-tertiary)' }}>{t('workspaceEmpty')}</p>}
            {visibleAuthorized.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 230, overflowY: 'auto' }}>{visibleAuthorized.map(directory => <AuthorizedPathRow key={directory.path} directory={directory} disabled={busy} onPick={() => { pickAuthorizedPath(directory) }} />)}</div>}
            {authorizedState.directories.length > 0 && visibleAuthorized.length === 0 && <p style={{ margin: 0, color: 'var(--dsw-alias-label-tertiary)' }}>{t('workspaceNoMatch')}</p>}
          </div>
        ) : null}
        {state.status === 'loading' && <p role="status" style={{ margin: 0, color: 'var(--dsw-alias-label-tertiary)' }}>{t('workspaceLoading')}</p>}
        {state.status === 'error' && <p role="alert" style={{ margin: 0, color: 'var(--dsw-alias-state-error-primary, #d92d20)' }}>{state.message}</p>}
        {listing !== null && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflowX: 'auto', paddingBottom: 2 }}>
              {listing.crumbs.map(crumb => (
                <button key={crumb.path} type="button" disabled={busy} onClick={() => { navigate(crumb.path) }} style={{ flex: '0 0 auto', padding: '4px 7px', border: 0, borderRadius: 6, background: 'transparent', color: 'var(--dsw-alias-label-secondary)', font: 'inherit', fontSize: 12, cursor: busy ? 'not-allowed' : 'pointer' }}>{crumb.name}</button>
              ))}
            </div>
            {visibleEntries.length === 0 ? <p style={{ margin: 0, color: 'var(--dsw-alias-label-tertiary)' }}>{t('workspaceDirectoryEmpty')}</p> : <div role="list" aria-label={t('workspaceTitle')} style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 300, overflowY: 'auto', padding: 1 }}>{visibleEntries.map(entry => <WorkspaceEntryRow key={entry.path} entry={entry} selected={selectedPath === entry.path} disabled={busy || state.status === 'loading'} onSelect={() => { setSelectedPath(entry.path); setPathDraft(entry.path) }} onOpen={() => { navigate(entry.path) }} t={t} />)}</div>}
          </>
        )}
      </div>
    </Modal>
  )
}
