/** fnOS file/directory selections carried by DSH structured references. */

export const FNOS_REFERENCE_SOURCE = 'fnos-file'

export type FnosReferenceKind = 'file' | 'directory'

export interface FnosInputReference {
  readonly kind: FnosReferenceKind
  readonly path: string
  readonly semanticPath: string
  readonly ref: string
  readonly clipboardText: string
}

export interface InputSnapshotForReference {
  readonly draft: string
  readonly draftRev: number
}

/** Keep only absolute, NUL-free paths that can be passed to the Host route. */
export function normalizeFnosPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const path = value.trim()
  if (path.length === 0 || !path.startsWith('/') || path.includes('\0')) return undefined
  if (path === '/') return path
  return path.replace(/\/+$/u, '')
}

/** Serialize an internal NAS path as a harmless file URL for clipboard/model text. */
export function fileUrlForPath(value: string): string {
  const path = normalizeFnosPath(value) ?? value
  const encoded = path.split('/').map(segment => encodeURIComponent(segment)).join('/')
  return `file://${encoded.startsWith('/') ? encoded : `/${encoded}`}`
}

export function fnosReferenceId(kind: FnosReferenceKind, path: string): string {
  return `${kind}:${encodeURIComponent(path)}`
}

/** Raw NAS @ token used by DSH's official message echo renderer. */
export function fnosReferenceDisplayText(reference: Pick<FnosInputReference, 'kind' | 'path' | 'semanticPath'>): string {
  const rawPath = reference.path.trim().replace(/^@/u, '')
  const path = reference.kind === 'directory' && !rawPath.endsWith('/') ? `${rawPath}/` : rawPath
  return `@${path}`
}

export function createFnosInputReference(
  kind: FnosReferenceKind,
  pathValue: unknown,
  semanticPathValue?: unknown,
): FnosInputReference | undefined {
  const path = normalizeFnosPath(pathValue)
  if (path === undefined) return undefined
  const semanticPath = typeof semanticPathValue === 'string' && semanticPathValue.trim().length > 0
    ? semanticPathValue.trim()
    : path
  const clipboardText = fileUrlForPath(path)
  return {
    kind,
    path,
    semanticPath,
    ref: fnosReferenceId(kind, path),
    clipboardText,
  }
}

/** Decode only references produced by this plugin. */
export function fnosReferencePromptText(ref: string): string {
  const decoded = decodeFnosReference(ref)
  if (decoded === undefined) return ref
  const path = decoded.kind === 'directory' && !decoded.path.endsWith('/') ? `${decoded.path}/` : decoded.path
  return `@${path}`
}

export function decodeFnosReference(ref: string): { kind: FnosReferenceKind, path: string } | undefined {
  const separator = ref.indexOf(':')
  if (separator <= 0) return undefined
  const kind = ref.slice(0, separator)
  if (kind !== 'file' && kind !== 'directory') return undefined
  let path: string
  try {
    path = decodeURIComponent(ref.slice(separator + 1))
  } catch {
    return undefined
  }
  const normalized = normalizeFnosPath(path)
  return normalized === undefined ? undefined : { kind, path: normalized }
}

/** De-duplicate picker output by normalized internal path, keeping first-seen order. */
export function uniqueFnosInputReferences(values: readonly (FnosInputReference | undefined)[]): FnosInputReference[] {
  const seen = new Set<string>()
  return values.flatMap(value => {
    if (value === undefined || seen.has(value.path)) return []
    seen.add(value.path)
    return [value]
  })
}
