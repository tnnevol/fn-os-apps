import { describe, expect, it } from 'vitest'
import { fnosInsertionPrefix, draftWithoutFnosOccurrence, fnosReferenceDraftText, insertFnosReferences } from '../../src/client/input-references/input-reference-actions.ts'
import { reconcileFnosOperationOccurrences } from '../../src/client/input-references/input-reference-operation.ts'
import { createFnosInputReference, FNOS_REFERENCE_SOURCE, fnosReferenceId } from '../../src/client/input-references/input-references.ts'
import type { Context as ClientContext } from '@deepseek-ai/cordis'

describe('fnOS reference insertion spacing', () => {
  it('adds a separator only when existing text touches the insertion point', () => {
    expect(fnosInsertionPrefix('hello')).toBe(' ')
    expect(fnosInsertionPrefix('hello ')).toBe('')
    expect(fnosInsertionPrefix('hello\n')).toBe('')
    expect(fnosInsertionPrefix('')).toBe('')
  })

  it('removes only the structured occurrence and its generated trailing separator', () => {
    expect(draftWithoutFnosOccurrence('hello @file next', { offset: 6, length: 5 }, [])).toBe('hello next')
    expect(draftWithoutFnosOccurrence('hello  @file ', { offset: 7, length: 5 }, [])).toBe('hello  ')
    expect(draftWithoutFnosOccurrence('hello @file  next', { offset: 6, length: 5 }, [], {
      removeTrailingSeparator: false,
    })).toBe('hello   next')
  })

  it('uses DSH reference draft text instead of the clipboard projection for offsets', () => {
    expect(fnosReferenceDraftText('Documents')).toBe('\uFFFCDocuments')
  })

  it('uses the returned insertions and DSH draft offsets for a multi-selection', () => {
    const calls: Array<{ event: string, payload: any }> = []
    const ctx = {
      sessions: {
        scope: () => ({
          bail: (_ctx: unknown, event: string, payload: any) => {
            calls.push({ event, payload })
            return true
          },
        }),
      },
    } as unknown as ClientContext
    const first = createFnosInputReference('directory', '/vol4/Documents', 'Documents')!
    const second = createFnosInputReference('file', '/vol4/report.md', 'report.md')!

    const inserted = insertFnosReferences(ctx, 'session' as never, [first, second], {
      draft: 'hello',
      draftRev: 4,
    })

    expect(inserted).toEqual([first, second])
    expect(calls.map(call => call.event)).toEqual([
      'slash/input-insert-text',
      'slash/input-insert-reference',
      'slash/input-insert-reference',
    ])
    expect(calls[1]?.payload.span).toEqual({ start: 6, end: 6, draftRev: 5 })
    expect(calls[2]?.payload.span).toEqual({ start: 17, end: 17, draftRev: 6 })
    expect(calls[1]?.payload.reference.label).toBe('Documents')
    expect(calls[2]?.payload.reference.label).toBe('report.md')
  })
})

describe('fnOS picker operation occurrence identity', () => {
  const path = '/vol4/1000/Documents'
  const historical = { occurrenceId: 1, source: FNOS_REFERENCE_SOURCE, ref: fnosReferenceId('directory', path) }
  const current = { occurrenceId: 2, source: FNOS_REFERENCE_SOURCE, ref: fnosReferenceId('directory', path) }
  const pending = { path, ref: current.ref, trailingSeparator: true }

  it('tracks only a newly inserted occurrence even when the path already existed', () => {
    const result = reconcileFnosOperationOccurrences({
      baselineOccurrenceIds: new Set([historical.occurrenceId]),
      pendingOccurrences: new Map([[pending.ref, pending]]),
      trackedOccurrences: new Map(),
      occurrences: [historical, current],
    })
    expect([...result.trackedOccurrences]).toEqual([[2, pending]])
    expect(result.pendingOccurrences.size).toBe(0)
  })

  it('reports a current-operation deletion without treating history as its replacement', () => {
    const result = reconcileFnosOperationOccurrences({
      baselineOccurrenceIds: new Set([historical.occurrenceId]),
      pendingOccurrences: new Map(),
      trackedOccurrences: new Map([[current.occurrenceId, pending]]),
      occurrences: [historical],
    })
    expect([...result.removedPaths]).toEqual([path])
    expect(result.trackedOccurrences.size).toBe(0)
  })

  it('does not reverse-sync a removal initiated by unchecking the tree', () => {
    const result = reconcileFnosOperationOccurrences({
      baselineOccurrenceIds: new Set(),
      pendingOccurrences: new Map(),
      trackedOccurrences: new Map([[current.occurrenceId, pending]]),
      occurrences: [],
      pendingRemovalPaths: new Set([path]),
    })
    expect(result.removedPaths.size).toBe(0)
  })
})
