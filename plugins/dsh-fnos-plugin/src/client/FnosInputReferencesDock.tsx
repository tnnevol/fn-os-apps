/** Reference blocks rendered in the top row of the DSH composer card. */

import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { DshIconClose as IconClose, DshIconFile as IconFile, DshIconFolder as IconFolder, DshTooltip as Tooltip } from '@tnnevol/dsh-semi-ui'
import { decodeFnosReference, FNOS_REFERENCE_SOURCE } from './input-references.ts'

type InputReferencesDockProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'settings.dsh-fnos'>

function displayName(value: string): string {
  const parts = value.split('/').filter(Boolean)
  return parts.at(-1) ?? value
}

export function FnosInputReferencesDock({ input, inputActions, t }: InputReferencesDockProps) {
  const [composerCard, setComposerCard] = useState<HTMLElement | null>(null)
  const occurrences = input.occurrences.filter(occurrence => occurrence.source === FNOS_REFERENCE_SOURCE)

  useEffect(() => {
    const cards = [...document.querySelectorAll<HTMLElement>('[data-composer-card]')]
    setComposerCard(cards.find(card => card.offsetParent !== null) ?? cards[0] ?? null)
  }, [])

  if (occurrences.length === 0) return null

  const content = (
    <div
      aria-label={t('selectedReferences')}
      data-dsh-fnos-input-references
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        maxWidth: '100%',
        padding: '4px 44px 2px 2px',
        overflowX: 'auto',
        overflowY: 'hidden',
        flexWrap: 'nowrap',
        scrollbarWidth: 'none',
        position: 'absolute',
        top: 10,
        left: 12,
        right: 12,
        zIndex: 2,
      }}
    >
      {occurrences.map(occurrence => {
        const decoded = decodeFnosReference(occurrence.ref)
        const isDirectory = decoded?.kind === 'directory'
        const readablePath = decoded?.path || occurrence.clipboardText || occurrence.label
        const name = displayName(readablePath)
        const Icon = isDirectory ? IconFolder : IconFile
        return (
          <Tooltip key={occurrence.occurrenceId} content={readablePath} showArrow mouseEnterDelay={0.5}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minWidth: 0,
                maxWidth: 260,
                minHeight: 28,
                padding: '3px 6px 3px 8px',
                borderRadius: 8,
                background: 'var(--dsw-alias-interactive-bg-hover)',
                color: 'var(--dsw-alias-label-primary)',
                fontSize: 12,
                lineHeight: '18px',
              }}
            >
              <Icon size="small" />
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <button
                type="button"
                aria-label={`${t('removeReference')}: ${readablePath}`}
                title={t('removeReference')}
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  inputActions.setDraft(input.draft.slice(0, occurrence.offset) + input.draft.slice(occurrence.offset + occurrence.length))
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
                }}
              >
                <IconClose size="small" />
              </button>
            </span>
          </Tooltip>
        )
      })}
    </div>
  )

  return composerCard === null ? null : createPortal(content, composerCard)
}
