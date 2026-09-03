/** Read-only Codex account quota information for the local settings card. */

import { createModels } from '@earendil-works/pi-ai'
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'
import type { Credential } from '@earendil-works/pi-ai'
import type { CodexCredentialStore } from './store.ts'
import { CODEX_PROVIDER } from './store.ts'

const CODEX_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage'
const CODEX_USAGE_TIMEOUT_MS = 10_000

export interface CodexUsageWindow {
  remainingPercent?: number
  limitWindowSeconds?: number
  resetAfterSeconds?: number
  resetAt?: number
}

export interface CodexUsageCredits {
  hasCredits?: boolean
  unlimited?: boolean
  balance?: string
}

/** Deliberately excludes the OAuth token and other upstream response fields. */
export interface CodexUsage {
  planType?: string
  allowed?: boolean
  limitReached?: boolean
  primaryWindow?: CodexUsageWindow
  secondaryWindow?: CodexUsageWindow
  credits?: CodexUsageCredits
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function number(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function boolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function string(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

function percentage(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function window(value: unknown): CodexUsageWindow | undefined {
  const source = record(value)
  if (source === undefined) return undefined
  const result: CodexUsageWindow = {}
  const usedPercent = number(source['used_percent'])
  const explicitRemainingPercent = number(source['remaining_percent'])
  const limitWindowSeconds = number(source['limit_window_seconds'])
  const resetAfterSeconds = number(source['reset_after_seconds'])
  const resetAt = number(source['reset_at'])
  if (explicitRemainingPercent !== undefined) {
    result.remainingPercent = percentage(explicitRemainingPercent)
  } else if (usedPercent !== undefined) {
    result.remainingPercent = percentage(100 - usedPercent)
  }
  if (limitWindowSeconds !== undefined) result.limitWindowSeconds = limitWindowSeconds
  if (resetAfterSeconds !== undefined) result.resetAfterSeconds = resetAfterSeconds
  if (resetAt !== undefined) result.resetAt = resetAt
  return Object.keys(result).length > 0 ? result : undefined
}

function credits(value: unknown): CodexUsageCredits | undefined {
  const source = record(value)
  if (source === undefined) return undefined
  const result: CodexUsageCredits = {}
  const hasCredits = boolean(source['has_credits'])
  const unlimited = boolean(source['unlimited'])
  const balance = string(source['balance'])
  if (hasCredits !== undefined) result.hasCredits = hasCredits
  if (unlimited !== undefined) result.unlimited = unlimited
  if (balance !== undefined) result.balance = balance
  return Object.keys(result).length > 0 ? result : undefined
}

/** Normalize the evolving private WHAM response into a small UI-safe shape. */
export function normalizeCodexUsagePayload(value: unknown): CodexUsage {
  const source = record(value)
  if (source === undefined) throw new Error('Codex usage response was not an object')
  const rateLimit = record(source['rate_limit'])
  const result: CodexUsage = {}
  const planType = string(source['plan_type'])
  const allowed = boolean(rateLimit?.['allowed'])
  const limitReached = boolean(rateLimit?.['limit_reached'])
  const primaryWindow = window(rateLimit?.['primary_window'])
  const secondaryWindow = window(rateLimit?.['secondary_window'])
  const quota = credits(source['credits'])
  if (planType !== undefined) result.planType = planType
  if (allowed !== undefined) result.allowed = allowed
  if (limitReached !== undefined) result.limitReached = limitReached
  if (primaryWindow !== undefined) result.primaryWindow = primaryWindow
  if (secondaryWindow !== undefined) result.secondaryWindow = secondaryWindow
  if (quota !== undefined) result.credits = quota
  return result
}

function accessToken(auth: { apiKey?: string } | undefined): string | undefined {
  return typeof auth?.apiKey === 'string' && auth.apiKey.length > 0 ? auth.apiKey : undefined
}

function accountId(credential: Credential | undefined): string | undefined {
  if (credential?.type !== 'oauth') return undefined
  return typeof credential.accountId === 'string' && credential.accountId.length > 0
    ? credential.accountId
    : undefined
}

/** Resolves OAuth (including refresh) before making the quota request. */
export class CodexUsageService {
  private readonly models
  private operation: Promise<CodexUsage | undefined> | undefined

  constructor(private readonly store: CodexCredentialStore) {
    this.models = createModels({ credentials: store })
    this.models.setProvider(openaiCodexProvider())
  }

  async read(): Promise<CodexUsage | undefined> {
    if (this.operation !== undefined) return this.operation
    const operation = this.readNow()
    this.operation = operation
    try {
      return await operation
    } finally {
      if (this.operation === operation) this.operation = undefined
    }
  }

  private async readNow(): Promise<CodexUsage | undefined> {
    const resolved = await this.models.getAuth(CODEX_PROVIDER)
    const token = accessToken(resolved?.auth)
    if (token === undefined) return undefined
    const credential = await this.store.read(CODEX_PROVIDER)
    const account = accountId(credential)
    if (account === undefined) return undefined

    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort() }, CODEX_USAGE_TIMEOUT_MS)
    try {
      const response = await fetch(CODEX_USAGE_URL, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${token}`,
          'ChatGPT-Account-Id': account,
          'user-agent': 'dsh-codex-auth-plugin',
        },
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`Codex usage request failed with status ${String(response.status)}`)
      return normalizeCodexUsagePayload(await response.json())
    } finally {
      clearTimeout(timer)
    }
  }
}
