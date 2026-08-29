import { readFile, watch, type FSWatcher } from 'node:fs'
import { dirname } from 'node:path'

export const PATH_ALLOWLIST_EVENTS_PATH = '/__fnos-gateway/path-allowlist/events'
export interface PathAllowlistSnapshot { version: 1, paths: string[] }

export function normalizeProxyPaths(value: unknown): string[] | undefined {
  if (typeof value !== 'object' || value === null || (value as { version?: unknown }).version !== 1) return undefined
  const paths = (value as { paths?: unknown }).paths
  if (!Array.isArray(paths)) return undefined
  const normalized = paths.flatMap(item => {
    if (typeof item !== 'string') return []
    const path = item.trim().replace(/\/+$/u, '') || '/'
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\0') || path.includes('?') || path.includes('#') || path === '/' || /%2f|%5c/iu.test(path)) return []
    if (path.split('/').some(segment => segment === '.' || segment === '..')) return []
    if (path === '/api' || path.startsWith('/api/') || path === '/plugins' || path.startsWith('/plugins/')) return []
    if (path === '/__fnos-gateway' || path.startsWith('/__fnos-gateway/')) return []
    return [path]
  })
  return [...new Set(normalized)].sort()
}

export class PathAllowlistStore {
  private paths: string[] = []
  private watcher?: FSWatcher
  private timer?: NodeJS.Timeout
  private readonly listeners = new Set<(snapshot: PathAllowlistSnapshot) => void>()
  constructor(readonly filePath: string) {}
  snapshot(): PathAllowlistSnapshot { return { version: 1, paths: [...this.paths] } }
  subscribe(listener: (snapshot: PathAllowlistSnapshot) => void): () => void { this.listeners.add(listener); listener(this.snapshot()); return () => { this.listeners.delete(listener) } }
  async reload(): Promise<boolean> {
    let value: unknown
    try { value = JSON.parse(await new Promise<string>((resolve, reject) => readFile(this.filePath, 'utf8', (error, data) => error ? reject(error) : resolve(data)))) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error('[fnos-gateway] invalid path allowlist; retaining last snapshot', error); return false }
    const paths = normalizeProxyPaths(value)
    if (paths === undefined) return false
    if (JSON.stringify(paths) === JSON.stringify(this.paths)) return true
    this.paths = paths
    for (const listener of this.listeners) listener(this.snapshot())
    return true
  }
  async start(): Promise<void> {
    await this.reload()
    this.watcher = watch(dirname(this.filePath), () => { if (this.timer !== undefined) clearTimeout(this.timer); this.timer = setTimeout(() => { void this.reload() }, 80) })
  }
  close(): void { if (this.timer !== undefined) clearTimeout(this.timer); this.watcher?.close(); this.listeners.clear() }
}
