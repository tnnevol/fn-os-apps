/** Host routes for fnOS application shared-directory ACLs. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { constants as fsConstants, createWriteStream, type Stats } from 'node:fs'
import { access, readdir, realpath, stat, unlink } from 'node:fs/promises'
import { posix } from 'node:path'
import { Writable } from 'node:stream'
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
import { FNOS_SETTINGS_DOCUMENT_PATH } from './settings-document-contract.ts'
import { FNOS_SESSION_LOG_EXPORT_PATH, type FnosSessionLogExportRequest } from './session-log-export-contract.ts'

const BODY_LIMIT = 64 * 1024

type FnosApiProxy = {
  downloads: {
    sessionLog: (request: { sessionId: string, includeDescendants?: boolean }, signal: AbortSignal) => Promise<Response>
  }
}

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

interface UserAclEntry {
  path?: unknown
  readable?: unknown
}

export interface UserAclResult {
  /** Whether fnOS returned a usable ACL response for the current user. */
  available: boolean
  /** Paths that fnOS says the current user can read. */
  readable: Set<string>
}

/** Injectable ACL checker used by the path validation tests. */
export type UserAclChecker = (
  req: IncomingMessage | undefined,
  paths: readonly string[],
) => Promise<UserAclResult>

export interface PathValidationOptions {
  /** Override the application roots when validating in isolation. */
  roots?: readonly string[]
  /** Override the current-user ACL lookup when validating in isolation. */
  checkUserAcl?: UserAclChecker
}

export type PathValidationFailure =
  | 'fnos-path-not-authorized'
  | 'fnos-path-not-found'
  | 'fnos-path-not-readable'
  | 'fnos-user-permission-denied'
  | 'fnos-user-permission-unavailable'

export interface PathValidationResult {
  ok: boolean
  failure?: PathValidationFailure
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

/**
 * Read the user identity supplied by the fnOS unified gateway.
 *
 * `TRIM_UID` is the application service user and must not be used here. The
 * current browser user is carried by `X-Trim-Userid` on gateway requests.
 */
export function gatewayUserId(req: IncomingMessage | undefined): number | undefined {
  const value = req === undefined ? undefined : header(req, 'x-trim-userid')?.trim()
  if (value === undefined || !/^\d+$/u.test(value)) return undefined
  const uid = Number(value)
  return Number.isSafeInteger(uid) && uid >= 0 ? uid : undefined
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

function userAclEntries(value: unknown): UserAclEntry[] {
  if (Array.isArray(value)) return value.filter(
    (entry): entry is UserAclEntry => typeof entry === 'object' && entry !== null && !Array.isArray(entry),
  )
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return []
  const record = value as Record<string, unknown>
  for (const key of ['result', 'paths', 'data']) {
    const entries = userAclEntries(record[key])
    if (entries.length > 0) return entries
  }
  return []
}

function userAclResult(value: unknown): UserAclResult {
  const readable = new Set<string>()
  for (const entry of userAclEntries(value)) {
    if (entry.readable !== true) continue
    const path = normalizePathForAuthorization(entry.path)
    if (path !== undefined) readable.add(path)
  }
  return { available: true, readable }
}

/**
 * Check the current gateway user instead of treating an application ACL root
 * as proof that every user can read every child path.
 *
 * Direct localhost development requests do not carry a NAS user header. In
 * that case the real process-level fs check remains the only meaningful check
 * and the fnOS `openFile()` bridge is still the final host-side operation.
 */
export const checkCurrentUserAcl: UserAclChecker = async (req, paths) => {
  const uid = gatewayUserId(req)
  const normalizedPaths = normalizeAuthorizedPaths(paths)
  if (uid === undefined || normalizedPaths.length === 0) {
    return { available: true, readable: new Set(normalizedPaths) }
  }
  try {
    const data = await callFnOsApi<unknown>('trim.file.checkUserACL', {
      uid,
      path: normalizedPaths.length === 1 ? normalizedPaths[0] : normalizedPaths,
    })
    return userAclResult(data)
  } catch (error: unknown) {
    console.warn('[dsh-fnos] unable to check current fnOS user ACL', error)
    return { available: false, readable: new Set() }
  }
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

/**
 * Resolve the fnOS application-owned data paths for this app. The @app
 * installation directory is intentionally excluded: it is an application
 * implementation path, not a user-facing authorization root. The remaining
 * app-managed data paths are read-only defaults, just like @appshare, and do
 * not depend on a user selecting them through the ACL management card first.
 */
export function defaultApplicationPathsFromEnvironment(env: NodeJS.ProcessEnv = process.env): string[] {
  const appName = (env.TRIM_APPNAME ?? env.APPNAME ?? 'fn-deepseek-harness').trim() || 'fn-deepseek-harness'
  const candidates: string[] = [env.TRIM_PKGHOME].filter((value): value is string => typeof value === 'string')
  let volume = typeof env.TRIM_APPDEST_VOL === 'string' ? env.TRIM_APPDEST_VOL.trim().replace(/\/+$/u, '') : ''
  const knownPath = [env.TRIM_APPDEST, ...candidates]
    .filter((value): value is string => typeof value === 'string')
    .find(value => /^\/[^/]+\/@app(?:center|home|share|data|conf)?\/[^/]+$/u.test(value))
  if (volume.length === 0 && knownPath !== undefined) volume = knownPath.slice(0, knownPath.indexOf('/@app'))
  if (volume.length > 0) {
    for (const prefix of ['@apphome', '@appshare', '@appdata', '@appconf']) {
      candidates.push(`${volume}/${prefix}/${appName}`)
    }
  }
  return normalizeAuthorizedPaths(candidates)
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

async function readablePathStat(path: string): Promise<Stats | undefined> {
  try {
    const pathStat = await stat(path)
    const mode = pathStat.isDirectory() ? fsConstants.R_OK | fsConstants.X_OK : fsConstants.R_OK
    await access(path, mode)
    return pathStat
  } catch {
    return undefined
  }
}

async function existingAuthorizedRoots(rootsValue: unknown): Promise<string[]> {
  const roots = normalizeAuthorizedPaths(rootsValue)
  const resolved = await Promise.all(roots.map(async root => {
    try {
      const resolvedRoot = normalizePathForAuthorization(await realpath(root))
      if (resolvedRoot === undefined) return undefined
      const rootStat = await readablePathStat(resolvedRoot)
      return rootStat?.isDirectory() === true ? resolvedRoot : undefined
    } catch {
      return undefined
    }
  }))
  return resolved.filter((root): root is string => root !== undefined)
}

async function currentAuthorizedRoots(options: PathValidationOptions = {}): Promise<string[]> {
  if (options.roots !== undefined) return existingAuthorizedRoots(options.roots)
  return resolvedAuthorizedRoots()
}

async function validateReadableAuthorizedPath(
  req: IncomingMessage | undefined,
  path: string,
  roots: readonly string[],
  checkUserAcl: UserAclChecker,
): Promise<PathValidationResult> {
  let pathStat: Stats
  try {
    pathStat = await stat(path)
  } catch {
    return { ok: false, failure: 'fnos-path-not-found' }
  }
  try {
    const mode = pathStat.isDirectory() ? fsConstants.R_OK | fsConstants.X_OK : fsConstants.R_OK
    await access(path, mode)
  } catch {
    return { ok: false, failure: 'fnos-path-not-readable' }
  }
  if (!await isResolvedPathWithinAuthorizedRoots(path, roots)) {
    return { ok: false, failure: 'fnos-path-not-authorized' }
  }

  const userAcl = await checkUserAcl(req, [path])
  if (!userAcl.available) return { ok: false, failure: 'fnos-user-permission-unavailable' }
  if (!userAcl.readable.has(path)) return { ok: false, failure: 'fnos-user-permission-denied' }
  return { ok: true }
}

/**
 * Validate a DSH file/directory target using all applicable permission layers:
 * the app's real shared roots, the process's actual fs access, and the
 * current NAS user ACL supplied by the unified gateway.
 */
export async function validatePathForOpen(
  pathValue: unknown,
  req?: IncomingMessage,
  options: PathValidationOptions = {},
): Promise<PathValidationResult> {
  const path = normalizePathForAuthorization(pathValue)
  if (path === undefined) return { ok: false, failure: 'fnos-path-not-authorized' }
  const roots = await currentAuthorizedRoots(options)
  return validateReadableAuthorizedPath(req, path, roots, options.checkUserAcl ?? checkCurrentUserAcl)
}

/** Backward-compatible boolean helper for callers that only need a verdict. */
export async function isAuthorizedPathForOpen(
  pathValue: unknown,
  req?: IncomingMessage,
): Promise<boolean> {
  return (await validatePathForOpen(pathValue, req)).ok
}

async function convertDirectories(paths: string[], language: string, readOnlyPaths: string[] = []): Promise<AuthorizedDirectory[]> {
  const readOnly = new Set(normalizeAuthorizedPaths(readOnlyPaths))
  const converted = await convertPathsForDisplay(paths, language)
  return converted.map(entry => ({ ...entry, removable: !readOnly.has(entry.path) }))
}

export async function loadAuthorizedDirectories(req: IncomingMessage): Promise<AuthorizedDirectory[]> {
  const readOnlyPaths = mergeAuthorizedPaths(dataSharePathsFromEnvironment(), defaultApplicationPathsFromEnvironment())
  let accessiblePaths: string[] = []
  try {
    accessiblePaths = await loadAuthorizedDirectoryPaths()
  } catch (error: unknown) {
    // The declared app share remains useful even when an older host does not
    // expose the live ACL query. Keep that display-only source available.
    if (readOnlyPaths.length === 0) throw error
    console.warn('[dsh-fnos] using TRIM_DATA_SHARE_PATHS because the fnOS ACL query failed', error)
  }
  // Keep configured shared paths visible in the management card even when a
  // volume is temporarily offline. Functional browsing/opening below still
  // requires the path to exist and be readable at the time of use.
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

function sessionLogExportRequest(value: unknown): FnosSessionLogExportRequest | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const sessionId = typeof record.sessionId === 'string' && record.sessionId.length > 0 && record.sessionId.length <= 256
    ? record.sessionId
    : undefined
  const directory = normalizePathForAuthorization(record.directory)
  return sessionId === undefined || directory === undefined ? undefined : { sessionId, directory }
}

function sessionLogExportFilename(sessionId: string): string {
  const safeId = sessionId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'session'
  return `dsh-session-${safeId}-${Date.now()}.zip`
}

async function writeSessionLogResponse(response: Response, target: string, signal: AbortSignal): Promise<void> {
  if (!response.ok || response.body === null) {
    throw new Error(`session log export returned HTTP ${response.status}`)
  }
  const stream = createWriteStream(target, { flags: 'wx', mode: 0o600 })
  let completed = false
  try {
    await response.body.pipeTo(Writable.toWeb(stream), { signal })
    completed = true
  } finally {
    if (!completed) {
      stream.destroy()
      await unlink(target).catch(() => undefined)
    }
  }
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
    roots = mergeAuthorizedPaths(await loadAuthorizedDirectoryPaths(), dataSharePathsFromEnvironment(), defaultApplicationPathsFromEnvironment())
  } catch (error: unknown) {
    const shares = mergeAuthorizedPaths(dataSharePathsFromEnvironment(), defaultApplicationPathsFromEnvironment())
    if (shares.length === 0) throw error
    roots = shares
  }
  return existingAuthorizedRoots(roots)
}

async function isResolvedPathWithinAuthorizedRoots(path: string, roots: readonly string[]): Promise<boolean> {
  try {
    const resolvedPath = normalizePathForAuthorization(await realpath(path))
    if (resolvedPath === undefined) return false
    return roots.some(root => root === '/' || resolvedPath === root || resolvedPath.startsWith(`${root}/`))
  } catch {
    return false
  }
}

function authorizedEntriesErrorForValidation(result: PathValidationResult): AuthorizedEntriesError {
  switch (result.failure) {
    case 'fnos-path-not-found':
      return new AuthorizedEntriesError('authorized-directory-not-found', 404)
    case 'fnos-path-not-readable':
    case 'fnos-user-permission-denied':
      return new AuthorizedEntriesError('authorized-directory-not-readable', 403)
    case 'fnos-user-permission-unavailable':
      return new AuthorizedEntriesError('fnos-user-permission-check-unavailable', 503)
    default:
      return new AuthorizedEntriesError('fnos-path-not-authorized', 403)
  }
}

function sortAuthorizedEntries(entries: AuthorizedEntry[]): AuthorizedEntry[] {
  return entries.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1
    return left.semanticPath.localeCompare(right.semanticPath, undefined, { numeric: true, sensitivity: 'base' })
  })
}

/**
 * List only existing, readable authorized roots or one authorized directory
 * level. The app ACL root is only the first boundary: every returned entry is
 * also checked with the real filesystem and, when the request came through
 * the fnOS gateway, the current user's ACL.
 */
export async function loadAuthorizedEntries(
  req: IncomingMessage,
  pathValue?: string,
): Promise<AuthorizedEntriesResponse> {
  const roots = await resolvedAuthorizedRoots()
  if (pathValue === undefined) {
    const userAcl = await checkCurrentUserAcl(req, roots)
    if (!userAcl.available) {
      throw new AuthorizedEntriesError('fnos-user-permission-check-unavailable', 503)
    }
    const readableRoots = roots.filter(root => userAcl.readable.has(root))
    const readable = await convertPathsForDisplay(readableRoots, requestLanguage(req))
    return {
      entries: readable.map(entry => ({ ...entry, kind: 'directory' as const })),
    }
  }

  const pathValidation = await validateReadableAuthorizedPath(req, pathValue, roots, checkCurrentUserAcl)
  if (!pathValidation.ok) throw authorizedEntriesErrorForValidation(pathValidation)
  const directoryStat = await stat(pathValue)
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
    if (childPath === undefined) continue
    try {
      const childStat = await readablePathStat(childPath)
      if (childStat === undefined) continue
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

  const userAcl = await checkCurrentUserAcl(req, candidates.map(entry => entry.path))
  if (!userAcl.available) {
    throw new AuthorizedEntriesError('fnos-user-permission-check-unavailable', 503)
  }
  const readableCandidates = candidates.filter(entry => userAcl.readable.has(entry.path))
  const truncated = readableCandidates.length > AUTHORIZED_ENTRIES_LIMIT
  const selected = readableCandidates.slice(0, AUTHORIZED_ENTRIES_LIMIT)
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

/**
 * Path conversion is a display helper, not an authorization bypass. Reject
 * arbitrary or stale paths before returning their semantic names.
 */
async function validatePathsForConversion(req: IncomingMessage, paths: readonly string[]): Promise<string[]> {
  const roots = await resolvedAuthorizedRoots()
  const userAcl = await checkCurrentUserAcl(req, paths)
  if (!userAcl.available) {
    throw new AuthorizedEntriesError('fnos-user-permission-check-unavailable', 503)
  }
  let failure: PathValidationFailure | undefined
  for (const path of paths) {
    let pathStat: Stats
    try {
      pathStat = await stat(path)
    } catch {
      failure ??= 'fnos-path-not-found'
      continue
    }
    try {
      const mode = pathStat.isDirectory() ? fsConstants.R_OK | fsConstants.X_OK : fsConstants.R_OK
      await access(path, mode)
    } catch {
      failure ??= 'fnos-path-not-readable'
      continue
    }
    if (!await isResolvedPathWithinAuthorizedRoots(path, roots)) {
      failure ??= 'fnos-path-not-authorized'
      continue
    }
    if (!userAcl.readable.has(path)) {
      failure ??= 'fnos-user-permission-denied'
    }
  }
  if (failure !== undefined) throw authorizedEntriesErrorForValidation({ ok: false, failure })
  return [...paths]
}

/** Register fnOS settings/document and authorized-directory routes on the DSH Web profile. */
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
        path: FNOS_SETTINGS_DOCUMENT_PATH,
        handler: async (req, res) => {
          if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' })
          if (!authorize(req, res)) return
          try {
            const path = await ctx.settings.prepareDocument()
            if (path === undefined) return json(res, 404, { error: 'fnos-settings-document-unavailable' })
            json(res, 200, { path })
          } catch (error: unknown) {
            errorResponse(res, error)
          }
        },
      }),
      ctx.webServer.register({
        kind: 'exact',
        path: FNOS_SESSION_LOG_EXPORT_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
          if (!authorize(req, res)) return
          const request = sessionLogExportRequest(await readJsonBody(req))
          if (request === undefined) return json(res, 400, { error: 'invalid-session-log-export-request' })

          const validation = await validatePathForOpen(request.directory, req)
          if (!validation.ok) {
            const status = validation.failure === 'fnos-path-not-found' ? 404
              : validation.failure === 'fnos-user-permission-unavailable' ? 503
                : 403
            return json(res, status, { error: validation.failure })
          }
          try {
            const directoryStat = await stat(request.directory)
            if (!directoryStat.isDirectory()) return json(res, 409, { error: 'fnos-session-log-target-not-directory' })
            await access(request.directory, fsConstants.W_OK | fsConstants.X_OK)
          } catch {
            return json(res, 403, { error: 'fnos-session-log-target-not-writable' })
          }

          const abortController = new AbortController()
          const abort = (): void => { abortController.abort() }
          req.once('close', abort)
          const target = posix.join(request.directory, sessionLogExportFilename(request.sessionId))
          try {
            const apiProxy = ctx.get('apiProxy') as FnosApiProxy | undefined
            if (apiProxy === undefined) return json(res, 503, { error: 'fnos-session-log-export-unavailable' })
            const response = await apiProxy.downloads.sessionLog(
              { sessionId: request.sessionId, includeDescendants: true },
              abortController.signal,
            )
            if (!response.ok) {
              return json(res, response.status >= 400 ? response.status : 500, { error: 'fnos-session-log-export-unavailable' })
            }
            await writeSessionLogResponse(response, target, abortController.signal)
            json(res, 201, { path: target })
          } catch (error: unknown) {
            if (!abortController.signal.aborted) {
              console.error('[dsh-fnos] session log NAS export failed', error)
              if (!res.writableEnded) json(res, 500, { error: 'fnos-session-log-export-failed' })
            }
          } finally {
            req.off('close', abort)
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
            const validPaths = await validatePathsForConversion(req, paths)
            json(res, 200, { paths: await convertPathsForDisplay(validPaths, requestLanguage(req)) })
          } catch (error: unknown) {
            if (error instanceof AuthorizedEntriesError) {
              json(res, error.status, { error: error.code })
              return
            }
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
            const validation = await validatePathForOpen(path, req)
            if (!validation.ok) {
              const status = validation.failure === 'fnos-path-not-found' ? 404
                : validation.failure === 'fnos-user-permission-unavailable' ? 503
                  : 403
              return json(res, status, { error: validation.failure })
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
