/** DSH-style multi-select browser limited to fnOS-authorized paths. */

import { useEffect, useMemo, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { Button, IconBrowseOutline16, IconFolderOpen16, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  DirectoryRequestError,
  requestAuthorizedEntries,
  type AuthorizedEntriesResult,
} from './authorized-directories-client.ts'
import type { AuthorizedEntry } from '../authorized-directories-contract.ts'
import type { FnosLocaleKey } from './locales.ts'

type Translate = (key: FnosLocaleKey) => string

export type FnosAuthorizedPathPickerProps = PropsLocale<'settings.dsh-fnos'> & {
  open: boolean
  busy: boolean
  onClose: () => void
  onConfirm: (entries: readonly AuthorizedEntry[]) => boolean
}

type ListingState =
  | { status: 'idle'; value: AuthorizedEntriesResult }
  | { status: 'loading'; value: AuthorizedEntriesResult }
  | { status: 'ready'; value: AuthorizedEntriesResult }
  | { status: 'error'; value: AuthorizedEntriesResult; message: string }

function errorMessage(error: unknown, t: Translate): string {
  if (error instanceof DirectoryRequestError && error.code === 'remote-web-origin-not-trusted') {
    return t('originNotTrusted')
  }
  return t('inputPickerFailed')
}

function EntryRow({ entry, selected, busy, onToggle, onOpen, t }: {
  entry: AuthorizedEntry
  selected: boolean
  busy: boolean
  onToggle: () => void
  onOpen: () => void
  t: Translate
}) {
  const directory = entry.kind === 'directory'
  return (
    <div
      role="listitem"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 42,
        padding: '4px 8px',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 9,
        background: selected ? 'var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover))' : 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
      }}
    >
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, cursor: busy ? 'not-allowed' : 'pointer' }}>
        <input
          type="checkbox"
          checked={selected}
          disabled={busy}
          onChange={onToggle}
          style={{ accentColor: 'var(--dsw-alias-button-primary-fill)', flex: '0 0 auto' }}
        />
        <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--dsw-alias-label-secondary)', flex: '0 0 auto' }}>
          {directory ? <IconFolderOpen16 size={16} /> : <IconBrowseOutline16 size={16} />}
        </span>
        <span title={entry.semanticPath} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
          {entry.semanticPath}
        </span>
      </label>
      {directory && (
        <button
          type="button"
          aria-label={`${t('inputPickerOpenDirectory')}: ${entry.semanticPath}`}
          title={t('inputPickerOpenDirectory')}
          disabled={busy}
          onMouseDown={event => event.preventDefault()}
          onClick={onOpen}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            padding: 0,
            border: 0,
            borderRadius: 7,
            background: 'transparent',
            color: 'var(--dsw-alias-label-tertiary)',
            cursor: busy ? 'not-allowed' : 'pointer',
            fontSize: 20,
            lineHeight: 1,
          }}
        >
          ›
        </button>
      )}
    </div>
  )
}

export function FnosAuthorizedPathPicker({ open, busy, onClose, onConfirm, t }: FnosAuthorizedPathPickerProps) {
  const [path, setPath] = useState<string | undefined>()
  const [history, setHistory] = useState<(string | undefined)[]>([])
  const [selected, setSelected] = useState<Map<string, AuthorizedEntry>>(new Map())
  const [state, setState] = useState<ListingState>({ status: 'idle', value: { entries: [], truncated: false } })

  useEffect(() => {
    if (!open) return
    setPath(undefined)
    setHistory([])
    setSelected(new Map())
    setState({ status: 'idle', value: { entries: [], truncated: false } })
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const previous = state.value
    setState({ status: 'loading', value: previous })
    void requestAuthorizedEntries(path).then(
      value => {
        if (!cancelled) setState({ status: 'ready', value })
      },
      error => {
        if (!cancelled) setState({ status: 'error', value: previous, message: errorMessage(error, t) })
      },
    )
    return () => { cancelled = true }
    // `state.value` is intentionally excluded: changing the response must
    // not reissue the same directory request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, path, t])

  const currentLabel = state.value.directory?.semanticPath ?? t('inputPickerRoots')
  const selectedEntries = useMemo(() => [...selected.values()], [selected])
  const navigate = (nextPath: string): void => {
    setHistory(value => [...value, path])
    setPath(nextPath)
  }
  const goBack = (): void => {
    const previous = history.at(-1)
    if (history.length === 0) return
    setHistory(value => value.slice(0, -1))
    setPath(previous)
  }
  const toggle = (entry: AuthorizedEntry): void => {
    setSelected(current => {
      const next = new Map(current)
      if (next.has(entry.path)) next.delete(entry.path)
      else next.set(entry.path, entry)
      return next
    })
  }
  const confirm = (): void => {
    if (selectedEntries.length === 0 || busy) return
    if (onConfirm(selectedEntries)) onClose()
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose() }}
      title={t('inputPickerTitle')}
      description={t('inputPickerDescription')}
      closeLabel={t('cancel')}
      footer={(
        <>
          <Button variant="outline" size="sm" disabled={busy} onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" size="sm" disabled={busy || selectedEntries.length === 0} onClick={confirm}>{t('inputPickerConfirm')}</Button>
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <button
            type="button"
            disabled={busy || history.length === 0}
            onClick={goBack}
            style={{
              flex: '0 0 auto',
              minWidth: 30,
              height: 30,
              padding: '0 8px',
              border: '1px solid var(--dsw-alias-border-l2)',
              borderRadius: 8,
              background: 'var(--dsw-alias-bg-layer-1)',
              color: 'var(--dsw-alias-label-primary)',
              cursor: busy || history.length === 0 ? 'not-allowed' : 'pointer',
              opacity: busy || history.length === 0 ? 0.45 : 1,
            }}
          >
            ‹
          </button>
          <div title={currentLabel} style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '6px 10px', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-secondary)', fontSize: 13 }}>
            {currentLabel}
          </div>
          <span style={{ flex: '0 0 auto', color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 }}>{selectedEntries.length} {t('inputPickerSelectedSuffix')}</span>
        </div>
        {state.status === 'loading' && <p role="status" style={{ margin: 0, color: 'var(--dsw-alias-label-tertiary)' }}>{t('inputPickerLoading')}</p>}
        {state.status === 'error' && <p role="alert" style={{ margin: 0, color: 'var(--dsw-alias-state-error-primary, #d92d20)' }}>{state.message}</p>}
        {state.status !== 'loading' && state.value.entries.length === 0 && <p style={{ margin: 0, color: 'var(--dsw-alias-label-tertiary)' }}>{t('inputPickerEmpty')}</p>}
        {state.value.entries.length > 0 && (
          <div role="list" aria-label={t('inputPickerTitle')} style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 360, overflowY: 'auto', padding: 1 }}>
            {state.value.entries.map(entry => (
              <EntryRow
                key={entry.path}
                entry={entry}
                selected={selected.has(entry.path)}
                busy={busy || state.status === 'loading'}
                onToggle={() => { toggle(entry) }}
                onOpen={() => { navigate(entry.path) }}
                t={t}
              />
            ))}
          </div>
        )}
        {state.value.truncated && <p style={{ margin: 0, color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 }}>{t('inputPickerTruncated')}</p>}
      </div>
    </Modal>
  )
}
