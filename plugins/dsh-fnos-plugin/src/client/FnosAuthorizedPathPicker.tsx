/** Compact fnOS-authorized tree selector used by the DSH input toolbar. */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import TreeSelect from '@douyinfe/semi-ui/lib/es/treeSelect/index'
import Tooltip from '@douyinfe/semi-ui/lib/es/tooltip/index'
import IconFile from '@douyinfe/semi-icons/lib/es/icons/IconFile.js'
import IconFolder from '@douyinfe/semi-icons/lib/es/icons/IconFolder.js'
import { requestAuthorizedEntries, type AuthorizedEntriesResult } from './authorized-directories-client.ts'
import { FnosColorLogo } from './FnosLogo.tsx'
import { decodeFnosReference, type FnosInputReference, createFnosInputReference, uniqueFnosInputReferences, FNOS_REFERENCE_SOURCE } from './input-references.ts'
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

function nodeLabel(entry: AuthorizedEntry): ReactNode {
  const name = displayName(entry.semanticPath)
  const Icon = entry.kind === 'directory' ? IconFolder : IconFile
  const content = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
      <Icon size="small" />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    </span>
  )
  return <Tooltip content={entry.semanticPath} showArrow>{content}</Tooltip>
}

function toNode(entry: AuthorizedEntry): TreeNode {
  return {
    key: entry.path,
    value: entry.path,
    label: nodeLabel(entry),
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

function selectedPaths(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]
  return values.flatMap(item => typeof item === 'string' && item.startsWith('/') ? [item] : [])
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
  const busy = input.phase === 'adjudicating' || input.phase === 'submitting'
  const currentReferences = useMemo(() => referenceEntries(input), [input])
  const currentPaths = useMemo(() => currentReferences.map(reference => reference.path), [currentReferences])
  const value = desiredPaths ?? currentPaths

  const applyEntries = useCallback((result: AuthorizedEntriesResult, parent?: string) => {
    for (const entry of result.entries) entries.current.set(entry.path, entry)
    const children = result.entries.map(toNode)
    setTreeData(current => parent === undefined ? children : updateChildren(current, parent, children))
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
    const removed = input.occurrences
      .filter(occurrence => occurrence.source === FNOS_REFERENCE_SOURCE)
      .filter(occurrence => {
        const decoded = decodeFnosReference(occurrence.ref)
        return decoded !== undefined && !wanted.has(decoded.path)
      })
      .sort((left, right) => right.offset - left.offset)

    if (removed.length > 0) {
      let draft = input.draft
      for (const occurrence of removed) {
        draft = draft.slice(0, occurrence.offset) + draft.slice(occurrence.offset + occurrence.length)
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
    setDesiredPaths(undefined)
  }, [currentPaths, desiredPaths, input, inputActions, insertReferences])

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
      dropdownStyle={{ width: 260, maxHeight: 320 }}
      optionListStyle={{ maxHeight: 280 }}
      showLine={false}
      emptyContent={t('inputPickerEmpty')}
      searchPlaceholder={t('workspaceSearchPlaceholder')}
      placeholder=""
      prefix={null}
      triggerRender={() => (
        <span
          aria-label={t('inputPicker')}
          title={t('inputPicker')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 7,
            background: '#fff',
            color: '#111',
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
