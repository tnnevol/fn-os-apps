/** Mark fnOS references so DSH renders them as link-like input content. */

import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useLayoutEffect } from 'react'
import { decodeFnosReference, FNOS_REFERENCE_SOURCE } from './input-references.ts'

type InputReferencesDockProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'settings.dsh-fnos'>

/** This slot renders no separate rail; it decorates the native DSH input occurrences. */
export function FnosInputReferencesDock({ input }: InputReferencesDockProps): null {
  useLayoutEffect(() => {
    const applyMarks = (): void => {
      const occurrences = input.occurrences.filter(occurrence => occurrence.source === FNOS_REFERENCE_SOURCE)
      const occurrenceById = new Map(occurrences.map(occurrence => [String(occurrence.occurrenceId), occurrence]))
      const chips = [...document.querySelectorAll<HTMLElement>('[data-decoration="chip"][data-occurrence]')]
      for (const chip of chips) {
        const occurrence = occurrenceById.get(chip.dataset.occurrence ?? '')
        if (occurrence === undefined) {
          chip.removeAttribute('data-dsh-fnos-link')
          continue
        }
        chip.setAttribute('data-dsh-fnos-link', '')
        chip.setAttribute('title', occurrence.clipboardText || decodeFnosReference(occurrence.ref)?.path || occurrence.label)
      }
    }

    applyMarks()
    const observer = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(applyMarks)
    observer?.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer?.disconnect()
      for (const chip of [...document.querySelectorAll<HTMLElement>('[data-dsh-fnos-link]')]) {
        chip.removeAttribute('data-dsh-fnos-link')
      }
    }
  }, [input.occurrences])

  return null
}
