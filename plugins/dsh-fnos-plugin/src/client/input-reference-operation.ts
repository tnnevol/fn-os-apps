/** Current-open fnOS picker occurrence reconciliation. */

import { decodeFnosReference, FNOS_REFERENCE_SOURCE } from './input-references.ts'

export interface InputOccurrenceIdentity {
  occurrenceId: number
  source: string
  ref: string
}

export interface FnosOperationReconcileInput {
  baselineOccurrenceIds: ReadonlySet<number>
  pendingPaths: ReadonlySet<string>
  trackedOccurrences: ReadonlyMap<number, string>
  occurrences: readonly InputOccurrenceIdentity[]
  pendingRemovalPaths?: ReadonlySet<string>
}

export interface FnosOperationReconcileResult {
  pendingPaths: Set<string>
  trackedOccurrences: Map<number, string>
  removedPaths: Set<string>
}

/**
 * Match newly minted DSH occurrence IDs to this picker opening only. Historical
 * references are excluded by the baseline, including references to the same path.
 */
export function reconcileFnosOperationOccurrences({
  baselineOccurrenceIds,
  pendingPaths,
  trackedOccurrences,
  occurrences,
  pendingRemovalPaths = new Set(),
}: FnosOperationReconcileInput): FnosOperationReconcileResult {
  const nextPending = new Set(pendingPaths)
  const nextTracked = new Map(trackedOccurrences)
  const currentIds = new Set(occurrences.map(item => item.occurrenceId))

  for (const occurrence of occurrences) {
    if (occurrence.source !== FNOS_REFERENCE_SOURCE
      || baselineOccurrenceIds.has(occurrence.occurrenceId)
      || nextTracked.has(occurrence.occurrenceId)) continue
    const decoded = decodeFnosReference(occurrence.ref)
    if (decoded === undefined || !nextPending.has(decoded.path)) continue
    nextPending.delete(decoded.path)
    nextTracked.set(occurrence.occurrenceId, decoded.path)
  }

  const removedPaths = new Set<string>()
  for (const [occurrenceId, path] of nextTracked) {
    if (currentIds.has(occurrenceId)) continue
    nextTracked.delete(occurrenceId)
    if (!pendingRemovalPaths.has(path)) removedPaths.add(path)
  }

  return { pendingPaths: nextPending, trackedOccurrences: nextTracked, removedPaths }
}
