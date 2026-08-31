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

export async function readCodexSignedInStatus(): Promise<boolean> {
  const status = await readJson<CodexAuthStatus>(CODEX_AUTH_STATUS_PATH)
  return status?.status === 'signed-in'
}

export async function readCodexUsage(): Promise<CodexUsage> {
  const usage = await readJson<CodexUsage>(CODEX_USAGE_PATH)
  if (usage === undefined) throw new Error('Codex usage is unavailable')
  return usage
}

/** Read one coherent snapshot so quota is never shown for a signed-out account. */
export async function readSignedInUsage(): Promise<CodexUsage | undefined> {
  if (!await readCodexSignedInStatus()) return undefined
  return await readCodexUsage()
}
