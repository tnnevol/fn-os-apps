/** The fnOS `/fn` input-trigger source backed by the app's authorized paths. */

import type {
  CandidateRequest,
  HeaderRequest,
  InputTriggerCandidate,
  InputTriggerCrumb,
  InputTriggerPick,
  InputTriggerSource,
} from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { CommandContribution, SelectOption } from '@deepseek-ai/dsh-client-ui-commands/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { requestAuthorizedEntries, type AuthorizedEntriesResult } from '../services/authorized-directories-client.ts'
import type { AuthorizedEntry } from '../../contracts/authorized-directories-contract.ts'
import {
  createFnosInputReference,
  fnosReferencePromptText,
  normalizeFnosPath,
  FNOS_REFERENCE_SOURCE,
  type FnosInputReference,
} from './input-references.ts'

const FN_COMMAND = 'fn'
const ROOT_PATH = '/'
const COMMAND_OPTION_LIMIT = 2000
const COMMAND_LIST_CONCURRENCY = 6

export type FnosDirectoryTranslate = (key: 'fnDirectorySection' | 'fnDirectoryCommandDescription' | 'fnDirectoryRoot') => string
export type AuthorizedEntriesLister = (path?: string) => Promise<AuthorizedEntriesResult>
export type FnosCommandReferenceInserter = (sessionId: SessionId, reference: FnosInputReference) => boolean

/**
 * Load the complete authorized tree for the command popup in bounded batches.
 * The Host endpoint intentionally lists one level at a time, so the popup
 * must aggregate those levels before its local search can find descendants.
 */
export async function listFnosCommandEntries(
  listEntries: AuthorizedEntriesLister,
  signal: AbortSignal,
): Promise<readonly AuthorizedEntry[]> {
  const entries: AuthorizedEntry[] = []
  const seenEntries = new Set<string>()
  const queuedDirectories = new Set<string>()
  const pending: Array<string | undefined> = []
  const rootKey = '<authorized-roots>'

  const enqueue = (path: string | undefined): void => {
    const key = path ?? rootKey
    if (queuedDirectories.has(key)) return
    queuedDirectories.add(key)
    pending.push(path)
  }

  enqueue(undefined)
  while (pending.length > 0 && entries.length < COMMAND_OPTION_LIMIT) {
    if (signal.aborted) return []
    const batch = pending.splice(0, COMMAND_LIST_CONCURRENCY)
    const results = await Promise.all(batch.map(path => listEntries(path)))
    if (signal.aborted) return []
    for (const result of results) {
      for (const entry of result.entries) {
        if (seenEntries.has(entry.path)) continue
        seenEntries.add(entry.path)
        entries.push(entry)
        if (entry.kind === 'directory' && entries.length < COMMAND_OPTION_LIMIT) enqueue(entry.path)
      }
    }
  }
  return entries
}

interface FnosCandidateValue {
  readonly kind: AuthorizedEntry['kind']
  readonly path: string
  readonly semanticPath: string
  readonly commandText: string
}

/** Parse the part after `/` and claim only `/fn` (optionally followed by a path). */
export function parseFnosCommandQuery(query: string): { path: string } | undefined {
  const value = query.trim()
  const spaced = value.startsWith(`${FN_COMMAND} `)
  const compact = value.startsWith(`${FN_COMMAND}/`)
  if (value !== FN_COMMAND && !spaced && !compact) return undefined
  // DSH slash detection ends a token at whitespace. Drilled paths therefore
  // use `/fn/<path>` so the next query still belongs to this source.
  const pathText = value === FN_COMMAND
    ? ''
    : value.slice(FN_COMMAND.length + (spaced ? 1 : 0)).trim()
  if (pathText.length === 0) return { path: ROOT_PATH }
  const path = normalizeFnosPath(pathText)
  return path === undefined ? undefined : { path }
}

function displayName(value: string): string {
  const parts = value.split('/').filter(Boolean)
  return parts.at(-1) ?? value
}

function candidateValue(entry: Pick<AuthorizedEntry, 'kind' | 'path' | 'semanticPath'>): FnosCandidateValue {
  const path = normalizeFnosPath(entry.path) ?? ROOT_PATH
  return {
    kind: entry.kind,
    path,
    semanticPath: entry.semanticPath,
    commandText: path === ROOT_PATH ? `/${FN_COMMAND}` : `/${FN_COMMAND}${path}/`,
  }
}

function encodeCandidate(value: FnosCandidateValue): string {
  return JSON.stringify(value)
}

function decodeCandidate(value: string | undefined): FnosCandidateValue | undefined {
  if (value === undefined) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
    if (!('kind' in parsed) || (parsed.kind !== 'file' && parsed.kind !== 'directory')) return undefined
    if (!('path' in parsed) || typeof parsed.path !== 'string') return undefined
    if (!('semanticPath' in parsed) || typeof parsed.semanticPath !== 'string') return undefined
    if (!('commandText' in parsed) || typeof parsed.commandText !== 'string') return undefined
    const path = normalizeFnosPath(parsed.path)
    return path === undefined
      ? undefined
      : { kind: parsed.kind, path, semanticPath: parsed.semanticPath, commandText: parsed.commandText }
  } catch {
    return undefined
  }
}

function candidateForEntry(entry: AuthorizedEntry, section: string): InputTriggerCandidate {
  const value = candidateValue(entry)
  return {
    name: `${displayName(entry.semanticPath)}${entry.kind === 'directory' ? '/' : ''}`,
    description: entry.semanticPath,
    icon: entry.kind === 'directory' ? 'folder' : 'file',
    section,
    value: encodeCandidate(value),
    ...(entry.kind === 'directory' ? { drill: true } : {}),
  }
}

function rootValue(rootLabel: string): string {
  return encodeCandidate({
    kind: 'directory',
    path: ROOT_PATH,
    semanticPath: rootLabel,
    commandText: `/${FN_COMMAND}`,
  })
}

function crumbsFor(
  path: string,
  drilled: boolean,
  rootLabel: string,
  knownPaths: ReadonlyMap<string, string>,
): readonly InputTriggerCrumb[] | undefined {
  if (!drilled) return undefined
  const normalized = normalizeFnosPath(path)
  if (normalized === undefined) return undefined
  const crumbs: InputTriggerCrumb[] = [{ label: rootLabel, value: rootValue(rootLabel) }]
  if (normalized === ROOT_PATH) return crumbs

  const segments = normalized.split('/').filter(Boolean)
  for (const [index, segment] of segments.entries()) {
    const prefix = `/${segments.slice(0, index + 1).join('/')}`
    const semanticPath = knownPaths.get(prefix) ?? prefix
    crumbs.push({
      label: displayName(semanticPath),
      value: encodeCandidate({
        kind: 'directory',
        path: prefix,
        semanticPath,
        commandText: `/${FN_COMMAND}${prefix}/`,
      }),
      ...(index === segments.length - 1 ? { current: true } : {}),
    })
  }
  return crumbs
}

function pickOutcome(pick: InputTriggerPick): ReturnType<NonNullable<InputTriggerSource['onPick']>> {
  const value = decodeCandidate(pick.candidate.value)
  if (value === undefined) return undefined
  if (value.kind === 'directory' && pick.action === 'drill') {
    return { text: value.commandText, continue: true }
  }
  const reference = createFnosInputReference(value.kind, value.path, value.semanticPath)
  if (reference === undefined) return undefined
  return {
    insert: {
      source: FNOS_REFERENCE_SOURCE,
      ref: reference.ref,
      label: `${displayName(value.semanticPath)}${value.kind === 'directory' ? '/' : ''}`,
      appearance: value.kind === 'directory' ? 'folder' : 'file',
      clipboardText: fnosReferencePromptText(reference.ref),
    },
  }
}

/** Build the authorized `/fn` source; the lister is injectable for contract tests. */
export function createFnosDirectorySource(
  t: FnosDirectoryTranslate,
  listEntries: AuthorizedEntriesLister = requestAuthorizedEntries,
): InputTriggerSource {
  const knownPaths = new Map<string, string>()
  const section = t('fnDirectorySection')
  const rootLabel = t('fnDirectoryRoot')

  return {
    trigger: '/',
    name: 'fnos-directory',
    order: 1,
    async candidates(_session, req: CandidateRequest) {
      const parsed = parseFnosCommandQuery(req.query)
      if (parsed === undefined) return []
      const result = await listEntries(parsed.path === ROOT_PATH ? undefined : parsed.path)
      if (req.signal.aborted) return []
      if (result.directory !== undefined) knownPaths.set(result.directory.path, result.directory.semanticPath)
      for (const entry of result.entries) {
        if (entry.kind === 'directory') knownPaths.set(entry.path, entry.semanticPath)
      }
      return result.entries.map(entry => candidateForEntry(entry, section))
    },
    header(_session, req: HeaderRequest) {
      const parsed = parseFnosCommandQuery(req.query)
      return parsed === undefined ? undefined : crumbsFor(parsed.path, req.drilled, rootLabel, knownPaths)
    },
    onPick: pickOutcome,
    codec: {
      clipboardText: ref => fnosReferencePromptText(ref),
      serialize: async ref => fnosReferencePromptText(ref),
    },
  }
}

/** Register `/fn` in DSH's unified command directory without creating another command source group. */
export function createFnosCommandContribution(
  t: FnosDirectoryTranslate,
  insertReference: FnosCommandReferenceInserter,
  listEntries: AuthorizedEntriesLister = requestAuthorizedEntries,
): CommandContribution {
  return {
    name: FN_COMMAND,
    description: t('fnDirectoryCommandDescription'),
    available: () => true,
    ui: {
      kind: 'popupSelect',
      options: async (_session, signal): Promise<readonly SelectOption[]> => {
        const entries = await listFnosCommandEntries(listEntries, signal)
        return entries.map(entry => {
          const value = candidateValue(entry)
          return {
            id: encodeCandidate(value),
            label: `${displayName(entry.semanticPath)}${entry.kind === 'directory' ? '/' : ''}`,
            detail: entry.semanticPath,
          }
        })
      },
      onSelect: (option, session) => {
        const value = decodeCandidate(option.id)
        if (value === undefined) throw new Error('the selected fnOS path is no longer available')
        const reference = createFnosInputReference(value.kind, value.path, value.semanticPath)
        if (reference === undefined || !insertReference(session.sessionId, reference)) {
          throw new Error('unable to insert the selected fnOS path')
        }
      },
    },
  }
}
