/** Browser-side API helpers for the fnOS authorized-directory route. */

import {
  FNOS_AUTHORIZED_DIRECTORIES_PATH,
  FNOS_PATH_CONVERSION_PATH,
  type AuthorizedDirectory,
  type ReadablePath,
} from '../authorized-directories-contract.ts'

export interface AuthorizedDirectoriesResponse {
  directories?: unknown
  paths?: unknown
}

export interface ReadablePathsResponse {
  paths?: unknown
}

export class DirectoryRequestError extends Error {
  constructor(readonly code: string, message = code) {
    super(message)
    this.name = 'DirectoryRequestError'
  }
}

function requestHeaders(): HeadersInit {
  const headers: HeadersInit = { accept: 'application/json' }
  if (typeof navigator === 'object' && typeof navigator.language === 'string' && navigator.language.length > 0) {
    headers['accept-language'] = navigator.language
  }
  return headers
}

/** De-duplicate paths while keeping the Host response order. */
export function directoriesFromResponse(value: AuthorizedDirectoriesResponse): AuthorizedDirectory[] {
  const entries = Array.isArray(value.directories)
    ? value.directories
    : Array.isArray(value.paths) ? value.paths : []
  const seen = new Set<string>()
  return entries.flatMap(entry => {
    if (typeof entry === 'object' && entry !== null && !Array.isArray(entry)) {
      const path = typeof entry.path === 'string' ? entry.path : ''
      const semanticPath = typeof entry.semanticPath === 'string' ? entry.semanticPath : path
      const removable = entry.removable !== false
      if (path.length === 0 || semanticPath.length === 0 || seen.has(path)) return []
      seen.add(path)
      return [{ path, semanticPath, removable }]
    }
    if (typeof entry !== 'string' || entry.length === 0 || seen.has(entry)) return []
    seen.add(entry)
    return [{ path: entry, semanticPath: entry, removable: true }]
  })
}

export async function requestAuthorizedDirectories(): Promise<AuthorizedDirectory[]> {
  const response = await fetch(FNOS_AUTHORIZED_DIRECTORIES_PATH, {
    headers: requestHeaders(),
    credentials: 'same-origin',
  })
  const value: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const code = typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
      ? value.error
      : `HTTP ${response.status}`
    throw new DirectoryRequestError(code)
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return []
  return directoriesFromResponse(value as AuthorizedDirectoriesResponse)
}

export function readablePathsFromResponse(value: ReadablePathsResponse): ReadablePath[] {
  if (!Array.isArray(value.paths)) return []
  const seen = new Set<string>()
  return value.paths.flatMap(entry => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return []
    const path = typeof entry.path === 'string' ? entry.path : ''
    const semanticPath = typeof entry.semanticPath === 'string' ? entry.semanticPath : path
    if (path.length === 0 || semanticPath.length === 0 || seen.has(path)) return []
    seen.add(path)
    return [{ path, semanticPath }]
  })
}

export async function requestReadablePaths(paths: readonly string[]): Promise<ReadablePath[]> {
  const response = await fetch(FNOS_PATH_CONVERSION_PATH, {
    method: 'POST',
    headers: { ...requestHeaders(), 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ paths }),
  })
  const value: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const code = typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
      ? value.error
      : `HTTP ${response.status}`
    throw new DirectoryRequestError(code)
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return []
  return readablePathsFromResponse(value as ReadablePathsResponse)
}
