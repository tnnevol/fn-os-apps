/** fnOS input action using the plugin's authorized-path picker. */

import { useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { AuthorizedEntry } from '../authorized-directories-contract.ts'
import { FnosAuthorizedPathPicker } from './FnosAuthorizedPathPicker.tsx'
import { FnosColorLogo } from './FnosLogo.tsx'
import {
  createFnosInputReference,
  uniqueFnosInputReferences,
  type FnosInputReference,
  type InputSnapshotForReference,
} from './input-references.ts'

type InputPickerProps = PropsRuntime<'conversation.input.right'>
  & PropsLocale<'settings.dsh-fnos'>
  & {
    insertReferences: (input: InputSnapshotForReference, references: readonly FnosInputReference[]) => boolean
  }

export function FnosInputPickerButton({ input, insertReferences, t }: InputPickerProps) {
  const [open, setOpen] = useState(false)
  const disabled = input.phase === 'adjudicating' || input.phase === 'submitting'

  const insertSelected = (entries: readonly AuthorizedEntry[]): boolean => {
    const references = uniqueFnosInputReferences(entries.map(entry => createFnosInputReference(
      entry.kind,
      entry.path,
      entry.semanticPath,
    )))
    return references.length > 0 && insertReferences(
      { draft: input.draft, draftRev: input.draftRev },
      references,
    )
  }

  return (
    <>
      <button
        type="button"
        aria-label={t('inputPicker')}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        title={t('inputPicker')}
        onMouseDown={event => event.preventDefault()}
        onClick={() => { setOpen(true) }}
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
          color: 'var(--dsw-alias-label-primary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <FnosColorLogo size={18} />
      </button>
      <FnosAuthorizedPathPicker
        open={open && !disabled}
        busy={disabled}
        onClose={() => { setOpen(false) }}
        onConfirm={insertSelected}
        t={t}
      />
    </>
  )
}
