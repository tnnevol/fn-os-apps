/** Host-backed settings scope for browsers opened through the NAS app proxy. */

import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import { CODEX_AUTH_SETTINGS_PATH } from '../auth-paths.ts'
import { decodeCodexAuthSettings } from '../settings-contract.ts'
import type { CodexAuthSettingsConfig } from '../settings-contract.ts'

const INITIAL_SNAPSHOT: SettingsScopeSnapshot<CodexAuthSettingsConfig> = {
  status: 'loading',
  value: undefined,
  base: undefined,
  user: undefined,
  revision: undefined,
  writable: false,
  mode: 'host',
}

async function requestSettings(method: 'GET' | 'PUT', value?: CodexAuthSettingsConfig): Promise<CodexAuthSettingsConfig> {
  const response = await fetch(CODEX_AUTH_SETTINGS_PATH, {
    method,
    headers: {
      accept: 'application/json',
      ...(value === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    credentials: 'same-origin',
  })
  const payload: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const error = typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : `HTTP ${String(response.status)}`
    throw new Error(error)
  }
  const settings = decodeCodexAuthSettings(payload)
  if (settings === undefined) throw new Error('Host returned invalid Codex settings')
  return settings
}

/**
 * The official settings RPC is intentionally unavailable to non-loopback
 * browser authorities. This small scope talks only to the plugin-owned,
 * same-origin endpoint and carries no settings schema or credential data.
 */
export class CodexAuthRemoteSettingsScope implements SettingsScope<CodexAuthSettingsConfig> {
  private snapshot = INITIAL_SNAPSHOT
  private readonly listeners = new Set<() => void>()
  private tail: Promise<void> = Promise.resolve()
  private disposed = false

  getSnapshot(): SettingsScopeSnapshot<CodexAuthSettingsConfig> {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  load(): Promise<void> {
    return this.enqueue(async () => {
      try {
        const settings = await requestSettings('GET')
        if (this.disposed) return
        this.publish({ ...this.snapshot, status: 'ready', value: settings, writable: true })
      } catch {
        if (this.disposed) return
        this.publish({ ...this.snapshot, status: 'unavailable', writable: false })
      }
    })
  }

  set(field: string, value: unknown): Promise<void> {
    if (field !== 'enableImageTool' && field !== 'enableImageUpload') {
      return Promise.reject(new Error(`Unsupported Codex settings field: ${field}`))
    }
    if (typeof value !== 'boolean') return Promise.reject(new TypeError(`Codex setting ${field} must be boolean`))
    return this.enqueue(async () => {
      const current = this.getSnapshot().value
      if (current === undefined) throw new Error('Codex settings are not loaded')
      const next = { ...current, [field]: value } as CodexAuthSettingsConfig
      const accepted = await requestSettings('PUT', next)
      if (this.disposed) return
      this.publish({ ...this.snapshot, status: 'ready', value: accepted, writable: true })
    })
  }

  mutate(ops: readonly SettingsPathOpView[], _expectedRevision?: number): Promise<void> {
    return this.enqueue(async () => {
      const current = this.getSnapshot().value
      if (current === undefined) throw new Error('Codex settings are not loaded')
      const next = { ...current }
      for (const op of ops) {
        if (op.path.length !== 1 || (op.path[0] !== 'enableImageTool' && op.path[0] !== 'enableImageUpload')) {
          throw new Error(`Unsupported Codex settings path: ${op.path.join('.')}`)
        }
        const field = op.path[0]
        if (op.op === 'unset') {
          next[field] = false
        } else if (typeof op.value !== 'boolean') {
          throw new TypeError(`Codex setting ${field} must be boolean`)
        } else {
          next[field] = op.value
        }
      }
      const accepted = await requestSettings('PUT', next)
      if (this.disposed) return
      this.publish({ ...this.snapshot, status: 'ready', value: accepted, writable: true })
    })
  }

  unset(field: string): Promise<void> {
    return this.set(field, false)
  }

  async dispose(): Promise<void> {
    this.disposed = true
    await this.tail
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    if (this.disposed) return Promise.resolve()
    const task = this.tail.then(async () => {
      if (this.disposed) return
      await operation()
    })
    this.tail = task.catch(() => undefined)
    return task
  }

  private publish(next: SettingsScopeSnapshot<CodexAuthSettingsConfig>): void {
    this.snapshot = next
    for (const listener of [...this.listeners]) listener()
  }
}
