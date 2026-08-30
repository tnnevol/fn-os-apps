/** Compact fnOS-authorized tree selector used by the DSH input toolbar. */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { DshIconFile as IconFile, DshIconFolder as IconFolder, DshTooltip as Tooltip, DshTreeSelect as TreeSelect } from '@tnnevol/dsh-semi-ui'
import { requestAuthorizedEntries, type AuthorizedEntriesResult } from './authorized-directories-client.ts'
import { FnosColorLogo } from './FnosLogo.tsx'
import { decodeFnosReference, FNOS_REFERENCE_SOURCE, type FnosInputReference, createFnosInputReference } from './input-references.ts'
import { draftWithoutFnosOccurrence } from './input-reference-actions.ts'
import { reconcileFnosOperationOccurrences, type PendingFnosOccurrence, type TrackedFnosOccurrence } from './input-reference-operation.ts'
import type { AuthorizedEntry } from '../authorized-directories-contract.ts'
import type { FnosLocaleKey } from './locales.ts'

type Translate = (key: FnosLocaleKey) => string
type InputProps = Pick<PropsRuntime<'conversation.input.left'>, 'input' | 'inputActions' | 'session'> & PropsLocale<'settings.dsh-fnos'>

interface TreeNode {
  key: string
  value: string
  label: ReactNode
  isLeaf: boolean
  children?: TreeNode[]
}

const EMPTY_TREE_VALUE: string[] = []

function displayName(value: string): string {
  const parts = value.split('/').filter(Boolean)
  return parts.at(-1) ?? value
}

function nodeLabel(entry: AuthorizedEntry, showFullPath = false): ReactNode {
  const name = showFullPath ? entry.semanticPath : displayName(entry.semanticPath)
  const Icon = entry.kind === 'directory' ? IconFolder : IconFile
  const content = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 'max-content' }}>
      <Icon size="small" />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    </span>
  )
  return <Tooltip content={entry.semanticPath} showArrow mouseEnterDelay={0.5}>{content}</Tooltip>
}

function toNode(entry: AuthorizedEntry, showFullPath = false): TreeNode {
  return {
    key: entry.path,
    value: entry.path,
    label: nodeLabel(entry, showFullPath),
    isLeaf: entry.kind === 'file',
  }
}

function updateChildren(nodes: readonly TreeNode[], key: string, children: TreeNode[]): TreeNode[] {
  return nodes.map(node => {
    if (node.key === key) return { ...node, children, isLeaf: false }
    if (node.children === undefined) return node
    return { ...node, children: updateChildren(node.children, key, children) }
  })
}

/**
 * Keep every checked path so a parent and child can both be selected.
 */
function selectedPaths(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]
  const paths = [...new Set(values.flatMap(item => typeof item === 'string' && item.startsWith('/') ? [item] : []))]
  return paths
}

export type FnosAuthorizedPathPickerProps = InputProps & {
  insertReferences: (input: { draft: string, draftRev: number }, references: readonly FnosInputReference[]) => readonly FnosInputReference[]
}

/** Selection is immediate; closing the TreeSelect never discards a choice. */
export function FnosAuthorizedPathPicker({ input, inputActions, insertReferences, t }: FnosAuthorizedPathPickerProps) {
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [desiredPaths, setDesiredPaths] = useState<string[] | undefined>()
  const entries = useRef(new Map<string, AuthorizedEntry>())
  const operationBaselineOccurrenceIds = useRef(new Set<number>())
  const insertedTreePaths = useRef(new Set<string>())
  const pendingInsertedOccurrences = useRef(new Map<string, PendingFnosOccurrence>())
  const currentOperationOccurrences = useRef(new Map<number, TrackedFnosOccurrence>())
  const pendingRemovalPaths = useRef(new Set<string>())
  const busy = input.phase === 'adjudicating' || input.phase === 'submitting'
  const value = desiredPaths ?? EMPTY_TREE_VALUE
  const treePanelWidth = useMemo(() => {
    const longestPath = [...entries.current.values()].reduce((longest, entry) => Math.max(longest, entry.semanticPath.length), 0)
    return `${Math.max(20, longestPath + 8)}ch`
  }, [treeData])

  const applyEntries = useCallback((result: AuthorizedEntriesResult, parent?: string) => {
    for (const entry of result.entries) entries.current.set(entry.path, entry)
    const children = result.entries.map(entry => toNode(entry))
    setTreeData(current => parent === undefined
      ? result.entries.map(entry => toNode(entry, true))
      : updateChildren(current, parent, children))
  }, [])

  useEffect(() => {
    let cancelled = false
    void requestAuthorizedEntries().then(result => {
      if (!cancelled) applyEntries(result)
    }).catch(() => {
      if (!cancelled) setTreeData([])
    })
    return () => { cancelled = true }
  }, [applyEntries])

  useEffect(() => {
    if (desiredPaths === undefined) return
    const pending = desiredPaths
      .filter(path => !insertedTreePaths.current.has(path))
      .map(path => ({ path, entry: entries.current.get(path) }))
      .flatMap(item => {
        if (item.entry === undefined) return []
        const reference = createFnosInputReference(item.entry.kind, item.entry.path, item.entry.semanticPath)
        return reference === undefined ? [] : [{ path: item.path, reference }]
      })
    if (pending.length === 0) return
    const inserted = insertReferences(
      { draft: input.draft, draftRev: input.draftRev },
      pending.map(item => item.reference),
    )
    const insertedRefs = new Set(inserted.map(reference => reference.ref))
    for (const item of pending) {
      if (!insertedRefs.has(item.reference.ref)) continue
      insertedTreePaths.current.add(item.path)
      pendingInsertedOccurrences.current.set(item.reference.ref, {
        path: item.path,
        ref: item.reference.ref,
        // The picker inserts at the end of the draft, so DSH owns the gap.
        trailingSeparator: true,
      })
    }
  }, [desiredPaths, input.draft, input.draftRev, insertReferences, treeData])

  useEffect(() => {
    if (desiredPaths === undefined) return
    const result = reconcileFnosOperationOccurrences({
      baselineOccurrenceIds: operationBaselineOccurrenceIds.current,
      pendingOccurrences: pendingInsertedOccurrences.current,
      trackedOccurrences: currentOperationOccurrences.current,
      occurrences: input.occurrences,
      pendingRemovalPaths: pendingRemovalPaths.current,
    })
    pendingInsertedOccurrences.current = result.pendingOccurrences
    currentOperationOccurrences.current = result.trackedOccurrences
    if (result.removedPaths.size === 0) return
    for (const path of result.removedPaths) insertedTreePaths.current.delete(path)
    setDesiredPaths(current => current?.filter(path => !result.removedPaths.has(path)))
  }, [desiredPaths, input.occurrences])

  useEffect(() => {
    if (pendingRemovalPaths.current.size === 0) return
    const fnosOccurrences = input.occurrences.filter(occurrence => occurrence.source === FNOS_REFERENCE_SOURCE)
    const removableIds = new Set([...currentOperationOccurrences.current]
      .filter(([, occurrence]) => pendingRemovalPaths.current.has(occurrence.path))
      .map(([occurrenceId]) => occurrenceId))
    const removable = fnosOccurrences
      .filter(occurrence => removableIds.has(occurrence.occurrenceId))
      .sort((left, right) => right.offset - left.offset)
    if (removable.length === 0) return

    let draft = input.draft
    for (const occurrence of removable) {
      const decoded = decodeFnosReference(occurrence.ref)
      const tracked = currentOperationOccurrences.current.get(occurrence.occurrenceId)
      if (decoded !== undefined) {
        pendingRemovalPaths.current.delete(decoded.path)
        currentOperationOccurrences.current.delete(occurrence.occurrenceId)
      }
      draft = draftWithoutFnosOccurrence(draft, occurrence, fnosOccurrences, {
        removeTrailingSeparator: tracked?.trailingSeparator ?? true,
      })
    }
    inputActions.setDraft(draft)
  }, [desiredPaths, input.draft, input.occurrences, inputActions])

  const handleTreeChange = useCallback((next: unknown) => {
    const nextPaths = selectedPaths(next)
    for (const path of insertedTreePaths.current) {
      if (!nextPaths.includes(path)) {
        insertedTreePaths.current.delete(path)
        pendingRemovalPaths.current.add(path)
      }
    }
    setDesiredPaths(nextPaths)
  }, [])

  const loadData = useCallback(async (node: unknown) => {
    const key = typeof node === 'object' && node !== null && 'key' in node && typeof node.key === 'string'
      ? node.key
      : undefined
    if (key === undefined) return
    const result = await requestAuthorizedEntries(key)
    applyEntries(result, key)
  }, [applyEntries])

  return (
    <TreeSelect
      aria-label={t('inputPicker')}
      multiple
      treeCheckable
      checkRelation="unRelated"
      treeData={treeData}
      value={value}
      loadData={loadData}
       onVisibleChange={(visible: boolean) => {
         if (visible) {
           operationBaselineOccurrenceIds.current = new Set(
             input.occurrences
               .filter(occurrence => occurrence.source === FNOS_REFERENCE_SOURCE)
               .map(occurrence => occurrence.occurrenceId),
           )
           insertedTreePaths.current.clear()
           pendingInsertedOccurrences.current.clear()
           currentOperationOccurrences.current.clear()
           pendingRemovalPaths.current.clear()
           setDesiredPaths(EMPTY_TREE_VALUE)
           return
         }
         operationBaselineOccurrenceIds.current.clear()
         insertedTreePaths.current.clear()
         pendingInsertedOccurrences.current.clear()
         currentOperationOccurrences.current.clear()
         pendingRemovalPaths.current.clear()
         setDesiredPaths(undefined)
       }}
       onChange={handleTreeChange}
      disabled={busy}
      size="small"
      borderless
      showClear={false}
      maxTagCount={0}
      dropdownMatchSelectWidth={false}
      dropdownStyle={{ width: treePanelWidth, maxWidth: 'min(560px, calc(100vw - 32px))', maxHeight: 320 }}
      optionListStyle={{ width: '100%', maxWidth: '100%', maxHeight: 280, overflowX: 'auto', overflowY: 'auto' }}
      showLine={false}
      emptyContent={t('inputPickerEmpty')}
      searchPlaceholder={t('workspaceSearchPlaceholder')}
      placeholder=""
      prefix={null}
      triggerRender={() => (
        <span
          aria-label={t('inputPicker')}
          title={t('inputPicker')}
          className="dsh-fnos-input-picker-trigger"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 7,
            background: 'var(--dsw-alias-bg-layer-1)',
            border: '1px solid var(--dsw-alias-border-l2)',
            boxSizing: 'border-box',
            color: 'var(--dsw-alias-label-primary)',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.45 : 1,
          }}
        >
          <FnosColorLogo size={17} />
        </span>
      )}
      style={{ width: 30, height: 30, padding: 0, background: 'transparent' }}
    />
  )
}
