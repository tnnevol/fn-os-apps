/** Insert fnOS selections as structured, official DSH references. */

import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ReferenceInsert, TokenSpan } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { FNOS_REFERENCE_SOURCE, fnosReferenceDisplayText, type FnosInputReference, type InputSnapshotForReference } from './input-references.ts'

function displayName(value: string): string {
  const parts = value.split('/').filter(Boolean)
  return parts.at(-1) ?? value
}

function referenceLabel(value: string): string {
  return displayName(value)
}

/**
 * Keep the local draft projection aligned with DSH's input machine. The
 * leading replacement character is rendered as the reference icon by DSH;
 * it is not the literal `@` text shown in the composer.
 */
export function fnosReferenceDraftText(label: string): string {
  return `\uFFFC${label}`
}

export function draftWithoutFnosOccurrence(
  draft: string,
  occurrence: { offset: number, length: number },
  _occurrences: readonly { offset: number, length: number }[],
  options: { removeTrailingSeparator?: boolean } = {},
): string {
  const start = occurrence.offset
  const end = occurrence.offset + occurrence.length
  // DSH appends one separator after an inserted structured reference. Remove
  // only that separator; whitespace owned by the user's existing draft stays.
  let after = end
  if (options.removeTrailingSeparator !== false && draft[after] === ' ') after += 1
  return draft.slice(0, start) + draft.slice(after)
}

/** Add exactly one separator only when existing text touches the insertion. */
export function fnosInsertionPrefix(draft: string, offset = draft.length): '' | ' ' {
  if (offset <= 0 || /\s/u.test(draft[offset - 1] ?? '')) return ''
  return ' '
}

/** Move the native textarea caret after React commits the inserted reference. */
export function restoreFnosInputCaret(position: number, expectedDraft: string): void {
  if (typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') return
  const restore = (): void => {
    const textareas = [...document.querySelectorAll<HTMLTextAreaElement>('textarea[data-phase]:not([disabled])')]
    const textarea = textareas.find(candidate => candidate.value === expectedDraft)
      ?? textareas.find(candidate => candidate.value.length >= position)
    if (textarea === undefined) return
    const caret = Math.min(position, textarea.value.length)
    textarea.focus({ preventScroll: true })
    textarea.setSelectionRange(caret, caret)
  }
  requestAnimationFrame(() => {
    restore()
    requestAnimationFrame(restore)
  })
}

function insertText(ctx: ClientContext, sessionId: SessionId, text: string, span: TokenSpan): boolean {
  const actx = ctx.sessions.scope(sessionId)
  if (actx === undefined) return false
  return actx.bail(actx, 'slash/input-insert-text', { text, span }) === true
}

function insertReference(
  ctx: ClientContext,
  sessionId: SessionId,
  reference: FnosInputReference,
  span: TokenSpan,
): boolean {
  const actx = ctx.sessions.scope(sessionId)
  if (actx === undefined) return false
  const label = referenceLabel(reference.semanticPath)
  const value: ReferenceInsert = {
    source: FNOS_REFERENCE_SOURCE,
    ref: reference.ref,
    label,
    appearance: reference.kind === 'directory' ? 'folder' : 'file',
    clipboardText: fnosReferenceDisplayText(reference),
  }
  return actx.bail(actx, 'slash/input-insert-reference', { reference: value, span }) === true
}

/** Append selected files and folders using DSH's official chip placeholder. */
export function insertFnosReferences(
  ctx: ClientContext,
  sessionId: SessionId,
  references: readonly FnosInputReference[],
  input: InputSnapshotForReference,
): FnosInputReference[] {
  if (references.length === 0) return []

  let draft = input.draft
  let offset = draft.length
  let draftRev = input.draftRev
  const inserted: FnosInputReference[] = []

  const prefix = fnosInsertionPrefix(draft, offset)
  if (prefix !== '') {
    const span: TokenSpan = { start: offset, end: offset, draftRev }
    if (!insertText(ctx, sessionId, prefix, span)) return []
    draft += prefix
    offset += prefix.length
    draftRev += 1
  }

  // DSH's native insertion transaction owns the trailing separator. Keep the
  // same display projection and offset math locally so the next CAS span is
  // based on the actual machine draft, not the clipboard/model projection.
  for (const reference of references) {
    const label = referenceLabel(reference.semanticPath)
    const span: TokenSpan = { start: offset, end: offset, draftRev }
    if (!insertReference(ctx, sessionId, reference, span)) break
    const displayText = fnosReferenceDraftText(label)
    const tail = draft.slice(offset)
    const gap = tail.length === 0 || tail[0] !== ' ' ? ' ' : ''
    draft += displayText + gap
    offset += displayText.length + gap.length
    draftRev += 1
    inserted.push(reference)
  }
  if (inserted.length > 0) restoreFnosInputCaret(draft.length, draft)
  return inserted
}
