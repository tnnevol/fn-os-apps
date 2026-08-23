/** Compact fnOS-authorized tree selector used by the DSH input toolbar. */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { DshIconFile as IconFile, DshIconFolder as IconFolder, DshTooltip as Tooltip, DshTreeSelect as TreeSelect } from '@tnnevol/dsh-semi-ui'
import { requestAuthorizedEntries, type AuthorizedEntriesResult } from './authorized-directories-client.ts'
import { FnosColorLogo } from './FnosLogo.tsx'
import { type FnosInputReference, createFnosInputReference } from './input-references.ts'
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
  insertReferences: (input: { draft: string, draftRev: number }, references: readonly FnosInputReference[]) => boolean
}

/** Selection is immediate; closing the TreeSelect never discards a choice. */
export function FnosAuthorizedPathPicker({ input, insertReferences, t }: FnosAuthorizedPathPickerProps) {
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [desiredPaths, setDesiredPaths] = useState<string[] | undefined>()
  const entries = useRef(new Map<string, AuthorizedEntry>())
  const insertedTreePaths = useRef(new Set<string>())
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
    if (insertReferences(
      { draft: input.draft, draftRev: input.draftRev },
      pending.map(item => item.reference),
    )) {
      for (const item of pending) insertedTreePaths.current.add(item.path)
    }
  }, [desiredPaths])

  const handleTreeChange = useCallback((next: unknown) => {
    const nextPaths = selectedPaths(next)
    for (const path of insertedTreePaths.current) {
      if (!nextPaths.includes(path)) insertedTreePaths.current.delete(path)
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
         if (!visible) {
           insertedTreePaths.current.clear()
           setDesiredPaths(undefined)
         }
       }}
       onChange={handleTreeChange}
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
