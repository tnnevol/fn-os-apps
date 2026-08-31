import { CODEX_AUTH_STATUS_PATH, CODEX_USAGE_PATH } from '../auth-paths.ts'
import type { CodexUsageWindow } from './usage-windows.ts'

export interface CodexUsage {
  secondaryWindow?: CodexUsageWindow
  primaryWindow?: CodexUsageWindow
}

interface CodexAuthStatus {
  status?: string
}

async function readJson<T>(path: string): Promise<T | undefined> {
  const response = await fetch(path, {
    method: 'GET',
    headers: { accept: 'application/json' },
    credentials: 'same-origin',
  })
  if (response.status === 401) return undefined
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
  return await response.json() as T
}

/** Read one coherent snapshot so quota is never shown for a signed-out account. */
export async function readSignedInUsage(): Promise<CodexUsage | undefined> {
  const status = await readJson<CodexAuthStatus>(CODEX_AUTH_STATUS_PATH)
  if (status?.status !== 'signed-in') return undefined
  return await readJson<CodexUsage>(CODEX_USAGE_PATH)
}
