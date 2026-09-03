/** Current-open fnOS picker occurrence reconciliation. */

import { decodeFnosReference, FNOS_REFERENCE_SOURCE } from './input-references.ts'

export interface InputOccurrenceIdentity {
  occurrenceId: number
  source: string
  ref: string
}

export interface PendingFnosOccurrence {
  path: string
  ref: string
  trailingSeparator: boolean
}

export interface TrackedFnosOccurrence extends PendingFnosOccurrence {}

export interface FnosOperationReconcileInput {
  baselineOccurrenceIds: ReadonlySet<number>
  pendingOccurrences: ReadonlyMap<string, PendingFnosOccurrence>
  trackedOccurrences: ReadonlyMap<number, TrackedFnosOccurrence>
  occurrences: readonly InputOccurrenceIdentity[]
  pendingRemovalPaths?: ReadonlySet<string>
}

export interface FnosOperationReconcileResult {
  pendingOccurrences: Map<string, PendingFnosOccurrence>
  trackedOccurrences: Map<number, TrackedFnosOccurrence>
  removedPaths: Set<string>
}

/**
 * Match newly minted DSH occurrence IDs to this picker opening only. Historical
 * references are excluded by the baseline, including references to the same path.
 */
export function reconcileFnosOperationOccurrences({
  baselineOccurrenceIds,
  pendingOccurrences,
  trackedOccurrences,
  occurrences,
  pendingRemovalPaths = new Set(),
}: FnosOperationReconcileInput): FnosOperationReconcileResult {
  const nextPending = new Map(pendingOccurrences)
  const nextTracked = new Map(trackedOccurrences)
  const currentIds = new Set(occurrences.map(item => item.occurrenceId))

  for (const occurrence of occurrences) {
    if (occurrence.source !== FNOS_REFERENCE_SOURCE
      || baselineOccurrenceIds.has(occurrence.occurrenceId)
      || nextTracked.has(occurrence.occurrenceId)) continue
    const decoded = decodeFnosReference(occurrence.ref)
    if (decoded === undefined) continue
    const pending = [...nextPending.entries()].find(([, item]) => item.ref === occurrence.ref)
    if (pending === undefined) continue
    nextPending.delete(pending[0])
    nextTracked.set(occurrence.occurrenceId, pending[1])
  }

  const removedPaths = new Set<string>()
  for (const [occurrenceId, tracked] of nextTracked) {
    if (currentIds.has(occurrenceId)) continue
    nextTracked.delete(occurrenceId)
    if (!pendingRemovalPaths.has(tracked.path)) removedPaths.add(tracked.path)
  }

  return { pendingOccurrences: nextPending, trackedOccurrences: nextTracked, removedPaths }
}
