/** Compact fnOS-authorized tree selector used by the DSH input toolbar. */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { DshIconFile as IconFile, DshIconFolder as IconFolder, DshTooltip as Tooltip, DshTreeSelect as TreeSelect } from '@tnnevol/dsh-semi-ui'
import { requestAuthorizedEntries, type AuthorizedEntriesResult } from './authorized-directories-client.ts'
import { FnosColorLogo } from './FnosLogo.tsx'
import { decodeFnosReference, type FnosInputReference, createFnosInputReference, uniqueFnosInputReferences, FNOS_REFERENCE_SOURCE } from './input-references.ts'
import { draftWithoutFnosOccurrence, trimFnosTrailingWhitespace } from './input-reference-actions.ts'
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

function isSameOrDescendantPath(path: string, ancestor: string): boolean {
  if (path === ancestor) return true
  const prefix = ancestor === '/' ? '/' : `${ancestor}/`
  return path.startsWith(prefix)
}

/**
 * Semi's related tree selection can report a checked ancestor together with
 * its checked descendant. Keep the deepest selected path so choosing
 * `fn-os-apps` never inserts its authorized parent `projects` as well.
 */
function selectedPaths(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]
  const paths = [...new Set(values.flatMap(item => typeof item === 'string' && item.startsWith('/') ? [item] : []))]
  return paths.filter(path => !paths.some(candidate => candidate !== path && isSameOrDescendantPath(candidate, path)))
}

function referenceEntries(input: InputProps['input']): FnosInputReference[] {
  return uniqueFnosInputReferences(input.occurrences
    .filter(occurrence => occurrence.source === FNOS_REFERENCE_SOURCE)
    .flatMap(occurrence => {
      const decoded = decodeFnosReference(occurrence.ref)
      if (decoded === undefined) return []
      const reference = createFnosInputReference(decoded.kind, decoded.path, decoded.path)
      return reference === undefined ? [] : [reference]
    }))
}

export type FnosAuthorizedPathPickerProps = InputProps & {
  insertReferences: (input: { draft: string, draftRev: number }, references: readonly FnosInputReference[]) => boolean
}

/** Selection is immediate; closing the TreeSelect never discards a choice. */
export function FnosAuthorizedPathPicker({ input, inputActions, insertReferences, t }: FnosAuthorizedPathPickerProps) {
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [desiredPaths, setDesiredPaths] = useState<string[] | undefined>()
  const entries = useRef(new Map<string, AuthorizedEntry>())
  const trailingSpaceRepairDraft = useRef<string>()
  const busy = input.phase === 'adjudicating' || input.phase === 'submitting'
  const currentReferences = useMemo(() => referenceEntries(input), [input])
  const currentPaths = useMemo(() => currentReferences.map(reference => reference.path), [currentReferences])
  const value = desiredPaths ?? currentPaths
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
    const wanted = new Set(desiredPaths)
    const current = new Set(currentPaths)
    const fnosOccurrences = input.occurrences.filter(occurrence => occurrence.source === FNOS_REFERENCE_SOURCE)
    const removed = fnosOccurrences
      .filter(occurrence => {
        const decoded = decodeFnosReference(occurrence.ref)
        return decoded !== undefined && !wanted.has(decoded.path)
      })
      .sort((left, right) => right.offset - left.offset)

    if (removed.length > 0) {
      let draft = input.draft
      for (const occurrence of removed) {
        draft = draftWithoutFnosOccurrence(draft, occurrence, fnosOccurrences)
      }
      inputActions.setDraft(draft)
      return
    }

    const additions = desiredPaths
      .filter(path => !current.has(path))
      .map(path => entries.current.get(path))
      .flatMap(entry => {
        if (entry === undefined) return []
        const reference = createFnosInputReference(entry.kind, entry.path, entry.semanticPath)
        return reference === undefined ? [] : [reference]
      })
    if (additions.length > 0) {
      insertReferences({ draft: input.draft, draftRev: input.draftRev }, additions)
      return
    }

    const cleanedDraft = trimFnosTrailingWhitespace(input.draft, fnosOccurrences)
    if (cleanedDraft !== input.draft) {
      inputActions.setDraft(cleanedDraft)
      return
    }
    setDesiredPaths(undefined)
  }, [currentPaths, desiredPaths, input, inputActions, insertReferences])

  useEffect(() => {
    const fnosOccurrences = input.occurrences.filter(occurrence => occurrence.source === FNOS_REFERENCE_SOURCE)
    if (fnosOccurrences.length === 0 || /\s$/u.test(input.draft)) {
      trailingSpaceRepairDraft.current = undefined
      return
    }
    const lastEnd = fnosOccurrences.reduce((end, occurrence) => Math.max(end, occurrence.offset + occurrence.length), 0)
    if (lastEnd !== input.draft.length || trailingSpaceRepairDraft.current === input.draft) return
    // Keep the official input transaction's trailing separator visible in the
    // textarea even when the host commit arrives without the final gap. The
    // guard prevents a rejected setDraft from causing an update loop.
    trailingSpaceRepairDraft.current = input.draft
    inputActions.setDraft(`${input.draft} `)
  }, [input.draft, input.occurrences, inputActions])

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
             onChange={(next: unknown) => { setDesiredPaths(selectedPaths(next)) }}
      disabled={busy}
      size="small"
      borderless
      showClear={false}
      maxTagCount={0}
      dropdownMatchSelectWidth={false}
      dropdownStyle={{ width: treePanelWidth, maxWidth: 'calc(100vw - 32px)', maxHeight: 320 }}
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
