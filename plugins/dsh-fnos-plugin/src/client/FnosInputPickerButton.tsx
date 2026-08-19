/** fnOS picker affordance mounted in DSH's conversation input toolbar. */

import { useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconBrowseOutline16, IconFolderOpen16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { createTrimApp } from './sdk.ts'
import { isPickerCancellation } from './picker-result.ts'
import { requestReadablePaths } from './authorized-directories-client.ts'
import { FnosColorLogo } from './FnosLogo.tsx'
import {
  createFnosInputReference,
  uniqueFnosInputReferences,
  type FnosReferenceKind,
  type FnosInputReference,
  type InputSnapshotForReference,
} from './input-references.ts'

type InputPickerProps = PropsRuntime<'conversation.input.right'>
  & PropsLocale<'settings.dsh-fnos'>
  & {
    insertReferences: (input: InputSnapshotForReference, references: readonly FnosInputReference[]) => boolean
  }

function pickerPaths(value: unknown): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return []
  const data = (value as Record<string, unknown>).data
  return Array.isArray(data)
    ? data.filter((entry): entry is string => typeof entry === 'string')
    : []
}

function isSuccessfulResponse(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const code = (value as Record<string, unknown>).code
  return code === undefined || code === 0 || code === '0'
}

function responseMessage(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const message = (value as Record<string, unknown>).msg ?? (value as Record<string, unknown>).message
  return typeof message === 'string' && message.length > 0 ? message : undefined
}

function FnosPickerOption({ kind, label, onClick, disabled }: {
  kind: FnosReferenceKind
  label: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '8px 10px',
        border: 0,
        borderRadius: 8,
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {kind === 'directory' ? <IconFolderOpen16 size={16} /> : <IconBrowseOutline16 size={16} />}
      {label}
    </button>
  )
}

export function FnosInputPickerButton({ input, insertReferences, t }: InputPickerProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const disabled = input.phase === 'adjudicating' || input.phase === 'submitting'

  const choose = async (kind: FnosReferenceKind): Promise<void> => {
    setBusy(true)
    setError(undefined)
    try {
      const sdk = createTrimApp()
      await sdk.ready()
      if (sdk.isStandaloneWeb) {
        setError(t('inputPickerUnavailable'))
        return
      }
      const result = await sdk.pickUserFile({
        directory: kind === 'directory',
        multiple: kind === 'file',
      })
      if (isPickerCancellation(result)) {
        setOpen(false)
        return
      }
      if (!isSuccessfulResponse(result)) {
        setError(responseMessage(result) ?? t('inputPickerFailed'))
        return
      }
      const paths = pickerPaths(result)
      if (paths.length === 0) return

      let readable = [] as Awaited<ReturnType<typeof requestReadablePaths>>
      try {
        readable = await requestReadablePaths(paths)
      } catch (conversionError) {
        console.debug('[dsh-fnos] selected path conversion unavailable', conversionError)
      }
      const byPath = new Map(readable.map(entry => [entry.path, entry.semanticPath]))
      const references = uniqueFnosInputReferences(paths.map(path => createFnosInputReference(
        kind,
        path,
        byPath.get(path) ?? path,
      )))
      if (references.length > 0 && insertReferences({ draft: input.draft, draftRev: input.draftRev }, references)) {
        // fnOS directory mode is officially single-select. Keep the small
        // menu open so users can choose several directories successively;
        // file mode uses the SDK's native multi-select dialog.
        setOpen(kind === 'directory')
      } else {
        setError(t('inputPickerFailed'))
      }
    } catch (pickerError) {
      if (!isPickerCancellation(pickerError)) {
        setError(t('inputPickerFailed'))
      } else {
        setOpen(false)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-label={t('inputPicker')}
        aria-expanded={open}
        disabled={disabled || busy}
        title={t('inputPicker')}
        onMouseDown={event => event.preventDefault()}
        onClick={() => { setError(undefined); setOpen(value => !value) }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          padding: 0,
          border: 0,
          borderRadius: 8,
          background: 'var(--dsw-alias-button-tool-bar-fill)',
          cursor: disabled || busy ? 'not-allowed' : 'pointer',
          opacity: disabled || busy ? 0.45 : 1,
        }}
      >
        <FnosColorLogo />
      </button>
      {open && !disabled && (
        <div
          role="menu"
          aria-label={t('inputPicker')}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 'calc(100% + 8px)',
            zIndex: 20,
            minWidth: 150,
            padding: 5,
            border: '1px solid var(--dsw-alias-border-l2)',
            borderRadius: 10,
            background: 'var(--dsw-alias-surface-l1)',
            boxShadow: 'var(--dsw-alias-shadow-l2)',
          }}
        >
          <FnosPickerOption kind="file" label={t('selectFile')} disabled={busy} onClick={() => { void choose('file') }} />
          <FnosPickerOption kind="directory" label={t('selectDirectory')} disabled={busy} onClick={() => { void choose('directory') }} />
          {error !== undefined && (
            <div role="alert" style={{ padding: '6px 10px', color: 'var(--dsw-alias-label-danger)', fontSize: 12, lineHeight: 1.4 }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
