/** Collapsible native DSH reference chips for selected fnOS files/directories. */

import { useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconBrowseOutline16, IconFolderOpen16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { decodeFnosReference, FNOS_REFERENCE_SOURCE } from './input-references.ts'

type InputReferencesDockProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'settings.dsh-fnos'>

export function FnosInputReferencesDock({ input, inputActions, t }: InputReferencesDockProps) {
  const [expanded, setExpanded] = useState(false)
  const occurrences = input.occurrences.filter(occurrence => occurrence.source === FNOS_REFERENCE_SOURCE)
  if (occurrences.length === 0) return null

  return (
    <div
      aria-label={t('selectedReferences')}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false)
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: expanded ? 6 : 0,
        maxWidth: '100%',
        maxHeight: expanded ? 40 : 28,
        overflowX: expanded ? 'auto' : 'hidden',
        overflowY: 'hidden',
        padding: expanded ? '3px 2px' : '2px 0',
        whiteSpace: 'nowrap',
        transition: 'max-height 120ms ease, gap 120ms ease',
      }}
    >
      {occurrences.map((occurrence, index) => {
        const decoded = decodeFnosReference(occurrence.ref)
        const isDirectory = decoded?.kind === 'directory'
        return (
          <div
            key={occurrence.occurrenceId}
            title={occurrence.label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              flex: '0 0 auto',
              gap: 5,
              maxWidth: expanded ? 320 : 210,
              minHeight: 24,
              padding: '2px 5px 2px 7px',
              marginLeft: expanded || index === 0 ? 0 : -5,
              border: '1px solid var(--dsw-alias-border-l2)',
              borderRadius: 7,
              background: 'var(--dsw-alias-interactive-bg-hover)',
              color: 'var(--dsw-alias-label-secondary)',
              fontSize: 12,
              lineHeight: '18px',
            }}
          >
            {isDirectory ? <IconFolderOpen16 size={14} /> : <IconBrowseOutline16 size={14} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{occurrence.label}</span>
            <button
              type="button"
              aria-label={`${t('removeReference')}: ${occurrence.label}`}
              title={t('removeReference')}
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                inputActions.setDraft(input.draft.slice(0, occurrence.offset) + input.draft.slice(occurrence.offset + 1))
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                padding: 0,
                border: 0,
                borderRadius: 5,
                background: 'transparent',
                color: 'var(--dsw-alias-label-tertiary)',
                cursor: 'pointer',
                fontSize: 15,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
