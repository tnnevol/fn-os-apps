/** fnOS Session log menu: preserve DSH computer export and add NAS export. */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { DshButton, DshDropdown, DshIconDownload as IconDownload, DshIconFolder, DshModal, DshTree } from '@tnnevol/dsh-semi-ui'
import { requestAuthorizedEntries, type AuthorizedEntriesResult } from '../client/services/authorized-directories-client.ts'
import { exportSessionLogToNas } from '../client/services/session-log-export-client.ts'
import type { AuthorizedEntry } from '../contracts/authorized-directories-contract.ts'
import type { FnosLocaleKey } from '../client/locales.ts'

type Translate = (key: FnosLocaleKey) => string

interface SessionLogDownloadEntry {
  open: boolean
  status: 'downloading' | 'success' | 'error'
  error: string | null
}

interface SessionLogDownloadState {
  bySession: Record<string, SessionLogDownloadEntry | undefined>
}

type SessionLogDownloadSelector = <Selected>(
  selector: (state: SessionLogDownloadState) => Selected,
  equality?: (left: Selected, right: Selected) => boolean,
) => Selected

type HeaderProps = PropsRuntime<'conversation.session.header.utilities'> & PropsLocale<'settings.dsh-fnos'> & {
  sessionId: SessionId
  exportToComputer: (sessionId: SessionId) => Promise<void>
  useSessionLogDownload: SessionLogDownloadSelector
  dismissDownload: (sessionId: SessionId) => void
}

interface DirectoryTreeNode {
  key: string
  value: string
  label: ReactNode
  isLeaf: boolean
  children?: DirectoryTreeNode[]
}

function displayName(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts.at(-1) ?? path
}

function directoryNode(entry: AuthorizedEntry, showFullPath = false, isLeaf = false): DirectoryTreeNode {
  return {
    key: entry.path,
    value: entry.path,
    label: (
      <span className="dsh-fnos-session-log-tree-label">
        <DshIconFolder size="small" />
        <span>{showFullPath ? entry.semanticPath : displayName(entry.semanticPath)}</span>
      </span>
    ),
    isLeaf,
  }
}

function replaceChildren(nodes: readonly DirectoryTreeNode[], key: string, children: DirectoryTreeNode[]): DirectoryTreeNode[] {
  return nodes.map(node => {
    if (node.key === key) return { ...node, children, isLeaf: children.length === 0 }
    if (node.children === undefined) return node
    return { ...node, children: replaceChildren(node.children, key, children) }
  })
}

function directoryNodes(result: AuthorizedEntriesResult, showFullPath = false): DirectoryTreeNode[] {
  return result.entries
    .filter(entry => entry.kind === 'directory')
    .map(entry => directoryNode(entry, showFullPath))
}

export function FnosSessionLogHeaderAction({ sessionId, exportToComputer, useSessionLogDownload, dismissDownload, t }: HeaderProps) {
  const [nasDialogVisible, setNasDialogVisible] = useState(false)
  const [treeData, setTreeData] = useState<DirectoryTreeNode[]>([])
  const [selectedDirectory, setSelectedDirectory] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string>()
  const browserDownload = useSessionLogDownload(state => state.bySession[String(sessionId)])
  const browserStatus = browserDownload?.status
  const browserDialogTitle = browserStatus === 'downloading'
    ? t('sessionLogDialogPreparingTitle')
    : browserStatus === 'success' ? t('sessionLogDialogSuccessTitle') : t('sessionLogDialogErrorTitle')
  const browserDialogDescription = browserStatus === 'downloading'
    ? t('sessionLogDialogPreparingDescription')
    : browserStatus === 'success'
      ? t('sessionLogDialogSuccessDescription')
      : browserDownload?.error ?? t('sessionLogDialogCommandFailed')

  useEffect(() => {
    if (!nasDialogVisible) return
    let cancelled = false
    setLoading(true)
    setError(undefined)
    void requestAuthorizedEntries().then(result => {
      if (!cancelled) setTreeData(directoryNodes(result, true))
    }).catch(() => {
      if (!cancelled) {
        setTreeData([])
        setError(t('sessionLogNasLoadFailed'))
      }
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [nasDialogVisible, t])

  const loadData = useCallback(async (node: unknown) => {
    const key = typeof node === 'object' && node !== null && 'key' in node && typeof node.key === 'string'
      ? node.key
      : undefined
    if (key === undefined) return
    try {
      const result = await requestAuthorizedEntries(key)
      setTreeData(current => replaceChildren(current, key, directoryNodes(result)))
    } catch {
      setError(t('sessionLogNasLoadFailed'))
    }
  }, [t])

  const openNasDialog = useCallback(() => {
    setSelectedDirectory(undefined)
    setError(undefined)
    setNasDialogVisible(true)
  }, [])

  const closeNasDialog = useCallback(() => {
    if (exporting) return
    setNasDialogVisible(false)
    setSelectedDirectory(undefined)
    setError(undefined)
  }, [exporting])

  const confirmNasExport = useCallback(async () => {
    if (selectedDirectory === undefined) return
    setExporting(true)
    setError(undefined)
    try {
      await exportSessionLogToNas(sessionId, selectedDirectory)
      setNasDialogVisible(false)
      setSelectedDirectory(undefined)
    } catch {
      setError(t('sessionLogNasExportFailed'))
    } finally {
      setExporting(false)
    }
  }, [selectedDirectory, sessionId, t])

  const nasExportEnabled = selectedDirectory !== undefined && !loading

  return (
    <>
      <DshDropdown
        showTick={false}
        menu={[
          {
            node: 'item',
            name: t('sessionLogExportComputer'),
            onClick: () => { void exportToComputer(sessionId) },
          },
          {
            node: 'item',
            name: t('sessionLogExportNas'),
            onClick: openNasDialog,
          },
        ]}
      >
        <DshButton size="default" type="primary" theme="outline" className="dsh-fnos-session-log-button">
          {t('sessionLog')}
          <span className="dsh-fnos-session-log-button-icon">
            <IconDownload />
          </span>
        </DshButton>
      </DshDropdown>
      <DshModal
        visible={browserDownload?.open === true}
        title={browserDialogTitle}
        hasCancel={false}
        okText={t('sessionLogDialogClose')}
        onOk={() => { dismissDownload(sessionId) }}
        onCancel={() => { dismissDownload(sessionId) }}
        width={480}
      >
        <p>{browserDialogDescription}</p>
      </DshModal>
      <DshModal
        visible={nasDialogVisible}
        title={t('sessionLogNasTitle')}
        okText={t('sessionLogNasConfirm')}
        cancelText={t('sessionLogNasCancel')}
        confirmLoading={exporting}
        okButtonProps={{
          type: 'primary',
          disabled: !nasExportEnabled,
        }}
        onOk={() => { void confirmNasExport() }}
        onCancel={closeNasDialog}
        width={560}
      >
        <div className="dsh-fnos-session-log-dialog-body">
          {loading ? <p>{t('sessionLogNasLoading')}</p> : null}
          {error !== undefined ? <p className="dsh-fnos-session-log-error">{error}</p> : null}
          {!loading && error === undefined ? (
            <DshTree
              aria-label={t('sessionLogNasTreeLabel')}
              treeData={treeData}
              value={selectedDirectory}
              selectedKey={selectedDirectory}
              loadData={loadData}
              onSelect={(key: string, selected: boolean) => {
                if (selected) setSelectedDirectory(key)
              }}
              defaultExpandAll={false}
              className="dsh-fnos-session-log-tree"
              emptyContent={t('sessionLogNasEmpty')}
            />
          ) : null}
        </div>
      </DshModal>
    </>
  )
}
