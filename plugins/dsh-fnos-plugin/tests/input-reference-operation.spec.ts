import { describe, expect, it } from 'vitest'
import { fnosInsertionPrefix, draftWithoutFnosOccurrence } from '../src/client/input-reference-actions.ts'
import { reconcileFnosOperationOccurrences } from '../src/client/input-reference-operation.ts'
import { FNOS_REFERENCE_SOURCE, fnosReferenceId } from '../src/client/input-references.ts'

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
  })
})

describe('fnOS picker operation occurrence identity', () => {
  const path = '/vol4/1000/Documents'
  const historical = { occurrenceId: 1, source: FNOS_REFERENCE_SOURCE, ref: fnosReferenceId('directory', path) }
  const current = { occurrenceId: 2, source: FNOS_REFERENCE_SOURCE, ref: fnosReferenceId('directory', path) }

  it('tracks only a newly inserted occurrence even when the path already existed', () => {
    const result = reconcileFnosOperationOccurrences({
      baselineOccurrenceIds: new Set([historical.occurrenceId]),
      pendingPaths: new Set([path]),
      trackedOccurrences: new Map(),
      occurrences: [historical, current],
    })
    expect([...result.trackedOccurrences]).toEqual([[2, path]])
    expect(result.pendingPaths.size).toBe(0)
  })

  it('reports a current-operation deletion without treating history as its replacement', () => {
    const result = reconcileFnosOperationOccurrences({
      baselineOccurrenceIds: new Set([historical.occurrenceId]),
      pendingPaths: new Set(),
      trackedOccurrences: new Map([[current.occurrenceId, path]]),
      occurrences: [historical],
    })
    expect([...result.removedPaths]).toEqual([path])
    expect(result.trackedOccurrences.size).toBe(0)
  })

  it('does not reverse-sync a removal initiated by unchecking the tree', () => {
    const result = reconcileFnosOperationOccurrences({
      baselineOccurrenceIds: new Set(),
      pendingPaths: new Set(),
      trackedOccurrences: new Map([[current.occurrenceId, path]]),
      occurrences: [],
      pendingRemovalPaths: new Set([path]),
    })
    expect(result.removedPaths.size).toBe(0)
  })
})
