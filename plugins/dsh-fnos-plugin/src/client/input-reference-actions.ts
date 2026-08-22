/** Insert fnOS references through DSH's scoped input-machine events. */

import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ReferenceInsert, TokenSpan } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { FNOS_REFERENCE_SOURCE, type FnosInputReference, type InputSnapshotForReference } from './input-references.ts'

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
  const value: ReferenceInsert = {
    source: FNOS_REFERENCE_SOURCE,
    ref: reference.ref,
    // Keep the native DSH draft free of both the full NAS path and the
    // display name and its native file/folder icon. DSH retains the
    // reference token for serialization while the fnOS reference rail
    // renders the selected name and icon as a block inside the composer
    // card. Supplying appearance here would make DSH render a second,
    // wrapping file/folder decoration in the input.
    label: '',
    clipboardText: reference.semanticPath,
  }
  return actx.bail(actx, 'slash/input-insert-reference', { reference: value, span }) === true
}

/** Append selected references while preserving DSH's native chip/serializer path. */
export function insertFnosReferences(
  ctx: ClientContext,
  sessionId: SessionId,
  references: readonly FnosInputReference[],
  input: InputSnapshotForReference,
): boolean {
  if (references.length === 0) return false

  let offset = input.draft.length
  let draftRev = input.draftRev
  let inserted = false

  const appendText = (text: string): boolean => {
    const span: TokenSpan = { start: offset, end: offset, draftRev }
    if (!insertText(ctx, sessionId, text, span)) return false
    offset += text.length
    draftRev += 1
    return true
  }

  for (const [index, reference] of references.entries()) {
    if (index === 0 ? offset > 0 && !/\s/u.test(input.draft.at(-1) ?? '') : true) {
      if (!appendText(' ')) return inserted
    }
    if (index > 0 && !appendText(' ')) return inserted

    const span: TokenSpan = { start: offset, end: offset, draftRev }
    if (!insertReference(ctx, sessionId, reference, span)) return inserted
    // The input machine replaces the insertion point with one U+FFFC.
    offset += 1
    draftRev += 1
    inserted = true
  }
  return inserted
}
