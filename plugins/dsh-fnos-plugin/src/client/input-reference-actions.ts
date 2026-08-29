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

export function trimFnosTrailingWhitespace(
  draft: string,
  occurrences: readonly { offset: number, length: number }[],
): string {
  const last = occurrences.reduce((end, occurrence) => Math.max(end, occurrence.offset + occurrence.length), 0)
  if (last === 0 || draft.slice(last).trim() !== '') return draft
  return draft.slice(0, last)
}

export function draftWithoutFnosOccurrence(
  draft: string,
  occurrence: { offset: number, length: number },
  _occurrences: readonly { offset: number, length: number }[],
): string {
  const start = occurrence.offset
  const end = occurrence.offset + occurrence.length
  // DSH appends one separator after an inserted structured reference. Remove
  // only that separator; whitespace owned by the user's existing draft stays.
  let after = end
  if (/\s/u.test(draft[after] ?? '')) after += 1
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
): boolean {
  if (references.length === 0) return false

  let draft = input.draft
  let offset = draft.length
  let draftRev = input.draftRev
  let inserted = false

  const prefix = fnosInsertionPrefix(draft, offset)
  if (prefix !== '') {
    const span: TokenSpan = { start: offset, end: offset, draftRev }
    if (!insertText(ctx, sessionId, prefix, span)) return false
    draft += prefix
    offset += prefix.length
    draftRev += 1
  }

  // DSH's native insertion transaction owns the trailing separator.
  for (const reference of references) {
    const label = referenceLabel(reference.semanticPath)
    const span: TokenSpan = { start: offset, end: offset, draftRev }
    if (!insertReference(ctx, sessionId, reference, span)) return inserted
    draft += `@${label} `
    offset += label.length + 2
    draftRev += 1
    inserted = true
  }
  if (inserted) restoreFnosInputCaret(draft.length, draft)
  return inserted
}
