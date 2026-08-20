/** Host routes for fnOS application shared-directory ACLs. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { readdir, realpath, stat } from 'node:fs/promises'
import { posix } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { callFnOsApi, FnOsApiError } from './fnos-api.ts'
import {
  FNOS_AUTHORIZED_DIRECTORIES_DELETE_PATH,
  FNOS_AUTHORIZED_ENTRIES_PATH,
  FNOS_AUTHORIZED_DIRECTORIES_PATH,
  FNOS_PATH_CONVERSION_PATH,
  FNOS_PATH_OPEN_VALIDATION_PATH,
  type AuthorizedDirectory,
  type AuthorizedEntry,
  type AuthorizedEntriesResponse,
  type ReadablePath,
} from './authorized-directories-contract.ts'

const BODY_LIMIT = 64 * 1024

/** Paths removed during this process must not be reintroduced from a stale env snapshot. */
const removedAccessiblePaths = new Set<string>()

/** fnOS supplies user-authorized application paths through this variable. */
export const FNOS_ACCESSIBLE_PATHS_ENV = 'TRIM_DATA_ACCESSIBLE_PATHS'

/** fnOS supplies the application's declared shared data paths through this variable. */
export const FNOS_DATA_SHARE_PATHS_ENV = 'TRIM_DATA_SHARE_PATHS'

interface SharedAccessibleFolders {
  paths?: unknown
}

interface SharedAccessibleFolderDeleteResult {
  suc?: unknown
}

interface ConvertedPath {
  path?: unknown
  semanticPath?: unknown
}

interface ConvertedPaths {
  status?: unknown
  result?: unknown
}

interface ConvertedPathsEnvelope {
  data?: unknown
  result?: unknown
}

const AUTHORIZED_ENTRIES_LIMIT = 500

class AuthorizedEntriesError extends Error {
  constructor(readonly code: string, readonly status: number, message = code) {
    super(message)
    this.name = 'AuthorizedEntriesError'
  }
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] : value
}

function firstForwarded(value: string | undefined): string | undefined {
  return value?.split(',')[0]?.trim() || undefined
}

function requestOrigin(req: IncomingMessage): string | undefined {
  const host = firstForwarded(header(req, 'x-forwarded-host')) ?? header(req, 'host')
  if (host === undefined) return undefined
  const proto = firstForwarded(header(req, 'x-forwarded-proto'))
    ?? ((req.socket as IncomingMessage['socket'] & { encrypted?: boolean }).encrypted === true ? 'https' : 'http')
  try {
    return new URL(`${proto}://${host}`).origin
  } catch {
    return undefined
  }
}

function normalizeOrigin(raw: string): string | undefined {
  try {
    return new URL(raw).origin
  } catch {
    return undefined
  }
}

function localPeer(req: IncomingMessage): boolean {
  const remote = req.socket.remoteAddress
  return remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1'
}

/** Accept the NAS gateway's same-origin requests, but reject cross-site calls. */
function trustedRequest(req: IncomingMessage): boolean {
  const fetchSite = header(req, 'sec-fetch-site')?.trim().toLowerCase()
  if (fetchSite === 'cross-site') return false
  const origin = header(req, 'origin')
  if (origin !== undefined) return requestOrigin(req) === normalizeOrigin(origin)
  return localPeer(req)
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(value))
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ''
    let size = 0
    let finished = false
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      if (finished) return
      size += Buffer.byteLength(chunk)
      if (size > BODY_LIMIT) {
        finished = true
        reject(new Error('request body is too large'))
        return
      }
      body += chunk
    })
    req.on('end', () => {
      if (finished) return
      finished = true
      try {
        resolve(JSON.parse(body) as unknown)
      } catch {
        reject(new Error('request body is not valid JSON'))
      }
    })
    req.on('error', error => {
      if (finished) return
      finished = true
      reject(error)
    })
  })
}

/** Normalize one fnOS volume path for display and exact delete matching. */
export function normalizeAuthorizedPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const path = value.trim()
  if (path.length === 0 || !path.startsWith('/') || path.includes('\0')) return undefined
  if (path === '/') return path
  return path.replace(/\/+$/u, '')
}

/** Normalize a path used for the open authorization boundary. */
export function normalizePathForAuthorization(value: unknown): string | undefined {
  const path = normalizeAuthorizedPath(value)
  if (path === undefined) return undefined
  return normalizeAuthorizedPath(posix.normalize(path))
}

/** Check a target path against authorized roots without confusing path prefixes. */
export function isPathWithinAuthorizedDirectory(pathValue: unknown, rootsValue: unknown): boolean {
  const path = normalizePathForAuthorization(pathValue)
  if (path === undefined) return false
  const roots = normalizeAuthorizedPaths(rootsValue).map(normalizePathForAuthorization).filter(
    (root): root is string => root !== undefined,
  )
  return roots.some(root => root === '/' || path === root || path.startsWith(`${root}/`))
}

/** Keep API order while removing malformed and duplicate paths. */
export function normalizeAuthorizedPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const paths: string[] = []
  const seen = new Set<string>()
  for (const entry of value) {
    const path = normalizeAuthorizedPath(entry)
    if (path === undefined || seen.has(path)) continue
    seen.add(path)
    paths.push(path)
  }
  return paths
}

/** Parse a fnOS colon-separated path environment variable. */
export function splitPathEnvironment(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value.split(':').map(value => value.trim()).filter(value => value.length > 0)
}

/** Read user-authorized paths from the lifecycle environment and de-duplicate them. */
export function accessiblePathsFromEnvironment(env: NodeJS.ProcessEnv = process.env): string[] {
  return normalizeAuthorizedPaths(splitPathEnvironment(env[FNOS_ACCESSIBLE_PATHS_ENV]))
}

/** Read declared application data shares for display and de-duplicate them. */
export function dataSharePathsFromEnvironment(env: NodeJS.ProcessEnv = process.env): string[] {
  return normalizeAuthorizedPaths(splitPathEnvironment(env[FNOS_DATA_SHARE_PATHS_ENV]))
}

/** Combine path sources without changing the first-seen order. */
export function mergeAuthorizedPaths(...values: unknown[]): string[] {
  return normalizeAuthorizedPaths(values.flatMap(value => Array.isArray(value) ? value : splitPathEnvironment(value)))
}

/** Keep a just-removed ACL out of the process-local merged configuration. */
export function markAuthorizedPathRemoved(value: unknown): void {
  const path = normalizeAuthorizedPath(value)
  if (path !== undefined) removedAccessiblePaths.add(path)
}

function requestLanguage(req: IncomingMessage): string {
  const value = header(req, 'accept-language')?.split(',')[0]?.trim().replace(/_/gu, '-')
  if (value !== undefined && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/u.test(value)) return value
  return 'en-US'
}

export function readableFallbackPath(path: string, language: string): string {
  const volume = /^\/vol(\d+)(?:\/(.*))?$/u.exec(path)
  if (volume !== null) {
    const prefix = language.toLowerCase().startsWith('zh') ? `存储空间${volume[1]}` : `Storage ${volume[1]}`
    return volume[2] === undefined || volume[2].length === 0 ? prefix : `${prefix}/${volume[2]}`
  }
  if (path === '/') return language.toLowerCase().startsWith('zh') ? '根目录' : 'Root'
  return path
}

function convertedPathMap(value: unknown): Map<string, string> {
  const result = new Map<string, string>()
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return result
  const envelope = value as ConvertedPathsEnvelope
  const nested = typeof envelope.data === 'object' && envelope.data !== null && !Array.isArray(envelope.data)
    ? envelope.data as ConvertedPaths
    : undefined
  const entries = Array.isArray(envelope.result) ? envelope.result : nested?.result
  if (!Array.isArray(entries)) return result
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue
    const path = normalizeAuthorizedPath((entry as ConvertedPath).path)
    const rawSemanticPath = (entry as ConvertedPath).semanticPath
    const semanticPath = typeof rawSemanticPath === 'string' ? rawSemanticPath.trim() : ''
    // A few older fnOS builds echo the internal path when the path scope is
    // missing. Do not treat that echo as a successful human-readable value.
    if (path !== undefined && semanticPath.length > 0 && semanticPath !== path) result.set(path, semanticPath)
  }
  return result
}

/** Pair internal paths with fnOS semantic paths, falling back per entry. */
export async function convertPathsForDisplay(pathsValue: unknown, language = 'en-US'): Promise<ReadablePath[]> {
  const paths = normalizeAuthorizedPaths(pathsValue)
  if (paths.length === 0) return []

  let convertedValue: unknown
  try {
    convertedValue = await callFnOsApi<ConvertedPaths>('trim.file.convertPath', {
      path: paths,
      language,
    })
  } catch (error: unknown) {
    // Keep file/dir insertion usable on older fnOS versions that do not expose
    // path conversion. The client can still retain the internal path safely.
    console.warn('[dsh-fnos] unable to convert selected fnOS paths', error)
  }

  const converted = convertedPathMap(convertedValue)
  return paths.map(path => ({
    path,
    semanticPath: converted.get(path) ?? readableFallbackPath(path, language),
  }))
}

/** Pair normalized internal paths with their fnOS user-facing semantic paths. */
export function buildAuthorizedDirectories(
  pathsValue: unknown,
  convertedValue: unknown,
  language = 'en-US',
  readOnlyPathsValue: unknown = [],
): AuthorizedDirectory[] {
  const paths = normalizeAuthorizedPaths(pathsValue)
  const readOnlyPaths = new Set(normalizeAuthorizedPaths(readOnlyPathsValue))
  const converted = convertedPathMap(convertedValue)
  return paths.map(path => ({
    path,
    semanticPath: converted.get(path) ?? readableFallbackPath(path, language),
    removable: !readOnlyPaths.has(path),
  }))
}

/**
 * Query the current ACL. The environment is a fallback for hosts that expose
 * the ACL to the app process but temporarily reject the read API; a successful
 * API response remains authoritative so a just-removed path is not resurrected
 * from a stale process environment.
 */
export async function loadAuthorizedDirectoryPaths(): Promise<string[]> {
  const environmentPaths = accessiblePathsFromEnvironment()
  try {
    const data = await callFnOsApi<SharedAccessibleFolders>('trim.file.getSharedAccessibleFolders')
    const apiPaths = normalizeAuthorizedPaths(data?.paths)
    for (const path of apiPaths) removedAccessiblePaths.delete(path)
    return mergeAuthorizedPaths(apiPaths, environmentPaths).filter(path => !removedAccessiblePaths.has(path))
  } catch (error: unknown) {
    if (environmentPaths.length === 0) throw error
    console.warn('[dsh-fnos] using TRIM_DATA_ACCESSIBLE_PATHS because the fnOS ACL query failed')
    return environmentPaths.filter(path => !removedAccessiblePaths.has(path))
  }
}

/**
 * Verify a DSH file/directory target against the current fnOS ACL and the
 * app-declared shared paths before the browser asks fnOS to open it.
 */
export async function isAuthorizedPathForOpen(pathValue: unknown): Promise<boolean> {
  if (normalizePathForAuthorization(pathValue) === undefined) return false
  const sharedPaths = dataSharePathsFromEnvironment()
  let roots: string[]
  try {
    roots = mergeAuthorizedPaths(await loadAuthorizedDirectoryPaths(), sharedPaths)
  } catch (error: unknown) {
    if (sharedPaths.length === 0) throw error
    console.warn('[dsh-fnos] using TRIM_DATA_SHARE_PATHS for path-open validation because the fnOS ACL query failed')
    roots = sharedPaths
  }
  return isPathWithinAuthorizedDirectory(pathValue, roots)
}

async function convertDirectories(paths: string[], language: string, readOnlyPaths: string[] = []): Promise<AuthorizedDirectory[]> {
  const readOnly = new Set(normalizeAuthorizedPaths(readOnlyPaths))
  const converted = await convertPathsForDisplay(paths, language)
  return converted.map(entry => ({ ...entry, removable: !readOnly.has(entry.path) }))
}

export async function loadAuthorizedDirectories(req: IncomingMessage): Promise<AuthorizedDirectory[]> {
  const readOnlyPaths = dataSharePathsFromEnvironment()
  let accessiblePaths: string[] = []
  try {
    accessiblePaths = await loadAuthorizedDirectoryPaths()
  } catch (error: unknown) {
    // The declared app share remains useful even when an older host does not
    // expose the live ACL query. Keep that display-only source available.
    if (readOnlyPaths.length === 0) throw error
    console.warn('[dsh-fnos] using TRIM_DATA_SHARE_PATHS because the fnOS ACL query failed', error)
  }
  const paths = mergeAuthorizedPaths(accessiblePaths, readOnlyPaths)
  return convertDirectories(paths, requestLanguage(req), readOnlyPaths)
}

function errorResponse(res: ServerResponse, error: unknown): void {
  if (error instanceof FnOsApiError && error.apiCode === 1) {
    json(res, 403, { error: 'fnos-authorized-directory-permission-denied' })
    return
  }
  json(res, 502, { error: 'fnos-authorized-directory-request-failed' })
}

function deletePath(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  return normalizeAuthorizedPath((value as Record<string, unknown>).path)
}

function conversionPaths(value: unknown): string[] | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const valuePaths = (value as Record<string, unknown>).paths
  if (!Array.isArray(valuePaths)) return undefined
  return normalizeAuthorizedPaths(valuePaths)
}

function openPathValue(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  return normalizePathForAuthorization((value as Record<string, unknown>).path)
}

/** Read the optional directory field used by the authorized-entry listing. */
function listingPathValue(value: unknown): string | undefined | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const raw = (value as Record<string, unknown>).path
  if (raw === undefined) return undefined
  return normalizePathForAuthorization(raw) ?? null
}

async function resolvedAuthorizedRoots(): Promise<string[]> {
  let roots: string[]
  try {
    roots = mergeAuthorizedPaths(await loadAuthorizedDirectoryPaths(), dataSharePathsFromEnvironment())
  } catch (error: unknown) {
    const shares = dataSharePathsFromEnvironment()
    if (shares.length === 0) throw error
    roots = shares
  }
  const resolved = await Promise.all(roots.map(async root => {
    try {
      return normalizePathForAuthorization(await realpath(root))
    } catch {
      return normalizePathForAuthorization(root)
    }
  }))
  return resolved.filter((root): root is string => root !== undefined)
}

async function isResolvedPathWithinAuthorizedRoots(path: string, roots: readonly string[]): Promise<boolean> {
  if (!isPathWithinAuthorizedDirectory(path, roots)) return false
  try {
    const resolvedPath = normalizePathForAuthorization(await realpath(path))
    if (resolvedPath === undefined) return false
    return roots.some(root => root === '/' || resolvedPath === root || resolvedPath.startsWith(`${root}/`))
  } catch {
    return false
  }
}

function sortAuthorizedEntries(entries: AuthorizedEntry[]): AuthorizedEntry[] {
  return entries.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1
    return left.semanticPath.localeCompare(right.semanticPath, undefined, { numeric: true, sensitivity: 'base' })
  })
}

/**
 * List only the authorized roots or one authorized directory level. The
 * lexical boundary check prevents `share-archive` from matching `share`, and
 * the realpath check prevents a symlink inside an authorized root from
 * escaping that root.
 */
export async function loadAuthorizedEntries(
  req: IncomingMessage,
  pathValue?: string,
): Promise<AuthorizedEntriesResponse> {
  const roots = await resolvedAuthorizedRoots()
  if (pathValue === undefined) {
    const readable = await convertPathsForDisplay(roots, requestLanguage(req))
    return {
      entries: readable.map(entry => ({ ...entry, kind: 'directory' as const })),
    }
  }

  if (!isPathWithinAuthorizedDirectory(pathValue, roots)
    || !await isResolvedPathWithinAuthorizedRoots(pathValue, roots)) {
    throw new AuthorizedEntriesError('fnos-path-not-authorized', 403)
  }
  let directoryStat
  try {
    directoryStat = await stat(pathValue)
  } catch {
    throw new AuthorizedEntriesError('authorized-directory-not-found', 404)
  }
  if (!directoryStat.isDirectory()) {
    throw new AuthorizedEntriesError('authorized-path-not-directory', 400)
  }

  let children
  try {
    children = await readdir(pathValue, { withFileTypes: true })
  } catch {
    throw new AuthorizedEntriesError('authorized-directory-not-readable', 403)
  }

  const candidates: { path: string; kind: 'file' | 'directory'; size?: number; modifiedAt?: number }[] = []
  for (const child of children) {
    const childPath = normalizePathForAuthorization(posix.join(pathValue, child.name))
    if (childPath === undefined || !isPathWithinAuthorizedDirectory(childPath, roots)) continue
    try {
      const childStat = await stat(childPath)
      if (!await isResolvedPathWithinAuthorizedRoots(childPath, roots)) continue
      const candidate: { path: string; kind: 'file' | 'directory'; size?: number; modifiedAt?: number } = {
        path: childPath,
        kind: childStat.isDirectory() ? 'directory' : 'file',
        modifiedAt: childStat.mtimeMs,
      }
      if (childStat.isFile()) candidate.size = childStat.size
      candidates.push(candidate)
    } catch {
      // A disappearing or unreadable child should not make the whole picker
      // unusable; the next refresh will reconcile it.
    }
  }

  const truncated = candidates.length > AUTHORIZED_ENTRIES_LIMIT
  const selected = candidates.slice(0, AUTHORIZED_ENTRIES_LIMIT)
  const readable = await convertPathsForDisplay([pathValue, ...selected.map(entry => entry.path)], requestLanguage(req))
  const readableByPath = new Map(readable.map(entry => [entry.path, entry.semanticPath]))
  return {
    directory: {
      path: pathValue,
      semanticPath: readableByPath.get(pathValue) ?? readableFallbackPath(pathValue, requestLanguage(req)),
    },
    entries: sortAuthorizedEntries(selected.map(entry => ({
      ...entry,
      semanticPath: readableByPath.get(entry.path) ?? readableFallbackPath(entry.path, requestLanguage(req)),
    }))),
    truncated,
  }
}

/** Register list/delete routes only on the DSH Web profile. */
export function registerAuthorizedDirectoryRoutes(ctx: Context): void {
  ctx.effect(() => {
    const authorize = (req: IncomingMessage, res: ServerResponse): boolean => {
      if (trustedRequest(req)) return true
      json(res, 403, { error: 'remote-web-origin-not-trusted' })
      return false
    }
    const routes = [
      ctx.webServer.register({
        kind: 'exact',
        path: FNOS_AUTHORIZED_DIRECTORIES_PATH,
        handler: async (req, res) => {
          if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' })
          if (!authorize(req, res)) return
          try {
            json(res, 200, { directories: await loadAuthorizedDirectories(req) })
          } catch (error: unknown) {
            errorResponse(res, error)
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: FNOS_AUTHORIZED_DIRECTORIES_DELETE_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
          if (!authorize(req, res)) return
          try {
            const path = deletePath(await readJsonBody(req))
            if (path === undefined) return json(res, 400, { error: 'invalid-authorized-directory-path' })
            const current = await loadAuthorizedDirectories(req)
            const directory = current.find(candidate => candidate.path === path)
            if (directory === undefined) {
              return json(res, 409, { error: 'authorized-directory-not-found' })
            }
            if (!directory.removable) return json(res, 409, { error: 'authorized-directory-not-removable' })
            const result = await callFnOsApi<SharedAccessibleFolderDeleteResult>(
              'trim.file.delSharedAccessibleFolder',
              { path },
            )
            if (result?.suc === false) return json(res, 502, { error: 'fnos-authorized-directory-request-failed' })
            markAuthorizedPathRemoved(path)
            json(res, 200, { ok: true })
          } catch (error: unknown) {
            errorResponse(res, error)
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: FNOS_PATH_CONVERSION_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
          if (!authorize(req, res)) return
          try {
            const paths = conversionPaths(await readJsonBody(req))
            if (paths === undefined) return json(res, 400, { error: 'invalid-fnos-paths' })
            json(res, 200, { paths: await convertPathsForDisplay(paths, requestLanguage(req)) })
          } catch (error: unknown) {
            errorResponse(res, error)
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: FNOS_PATH_OPEN_VALIDATION_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
          if (!authorize(req, res)) return
          try {
            const path = openPathValue(await readJsonBody(req))
            if (path === undefined) return json(res, 400, { error: 'invalid-fnos-path' })
            if (!await isAuthorizedPathForOpen(path)) {
              return json(res, 403, { error: 'fnos-path-not-authorized' })
            }
            json(res, 200, { ok: true })
          } catch (error: unknown) {
            errorResponse(res, error)
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: FNOS_AUTHORIZED_ENTRIES_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
          if (!authorize(req, res)) return
          try {
            const path = listingPathValue(await readJsonBody(req))
            if (path === null) return json(res, 400, { error: 'invalid-fnos-path' })
            json(res, 200, await loadAuthorizedEntries(req, path))
          } catch (error: unknown) {
            if (error instanceof AuthorizedEntriesError) {
              json(res, error.status, { error: error.code })
              return
            }
            errorResponse(res, error)
          }
        },
      }),
    ]
    return () => {
      for (const dispose of routes) dispose()
    }
  }, 'dsh-fnos: authorized directory routes')
}
