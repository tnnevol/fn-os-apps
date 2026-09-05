/**
 * Tencent CodeBuddy provider plugin for DeepSeek Harness.
 *
 * Registers one `codebuddy` route on `ctx.llm`, authorized by a browser OAuth
 * login rather than an API key, and serving the models CodeBuddy's own
 * (non-OpenAI) catalog endpoint reports.
 *
 * Everything — sign in, sign out, account info, usage preferences — happens in
 * the Web UI: Settings → CodeBuddy. No API key is required, and the running
 * harness picks the credential up without a restart.
 *
 * @module dsh-codebuddy
 */

import type { Context } from '@deepseek-ai/cordis'
import { CodeBuddyAdapter } from './adapter.ts'
import type { CodeBuddyConnectionOptions } from './adapter.ts'
import { CodeBuddyAuthService } from './auth-service.ts'
import {
  CODEBUDDY_CHAT_BASE,
  CODEBUDDY_PROVIDER,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
} from './constants.ts'
import { CodeBuddySession } from './session.ts'

export { CodeBuddyAdapter, httpErrorCode } from './adapter.ts'
export type { CodeBuddyAdapterOptions, CodeBuddyConnectionOptions } from './adapter.ts'
export { CodeBuddyAuthService, CODEBUDDY_AUTH_CHANNEL } from './auth-service.ts'
export type {
  CodeBuddyAuthStatus,
  CodeBuddyLoginStart,
  CodeBuddyLoginPoll,
  CodeBuddyUsageResult,
  CodeBuddyUsageWindow,
} from './auth-service.ts'
export { CodeBuddySession, NotLoggedInError } from './session.ts'
export { buildStorage, clearStorage, getStoragePath, loadStorage, saveStorage } from './storage.ts'
export type { CodeBuddyStorage } from './storage.ts'
export { fetchUsage, fetchPersonalUsage, fetchEnterpriseUsage, parseUsage } from './usage.ts'
export type { UsageSnapshot, UsageWindow } from './usage.ts'
export * from './constants.ts'
export { hasDisclosedCapacity } from './types.ts'
export type * from './types.ts'

/** Cordis plugin name. */
export const name = 'llm-codebuddy'

/** This plugin needs the LLM seam to register its route on. */
export const inject = ['llm']

// The module is deliberately exported as named members only, with no default
// export. Cordis's loader collapses a module via `exports.default ?? exports`,
// so a `export default apply` would make the plugin a bare function and discard
// `inject` and `name` alongside it — the mount then fails with `cannot get
// property "llm" without inject`.

/**
 * Plugin config. Every field is optional: the shipped defaults reach the public
 * CodeBuddy service, and there is no credential field at all by design — the
 * only way in is the browser login.
 */
export interface Config {
  /** Chat endpoint base; defaults to CodeBuddy's OpenAI-compatible route. */
  baseURL?: string
  /** Context capacity for a model the catalog does not size. */
  defaultContextWindow?: number
  /** Per-request output cap for a model the catalog does not cap. */
  defaultMaxTokens?: number
  /** Maximum provider idle time while one stream read is outstanding. */
  streamIdleTimeoutMs?: number
}

/**
 * Validate and complete the raw config.
 *
 * Programmatic construction can bypass any schema, so bounds are judged here
 * and a bad value fails at load with the field named, rather than mid-request.
 * @param config - the raw entry config.
 * @returns the resolved connection facts.
 */
export function resolveConnectionOptions(config: Config = {}): CodeBuddyConnectionOptions {
  const positiveInteger = (value: number | undefined, field: string, fallback: number): number => {
    if (value === undefined) return fallback
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`dsh-codebuddy: ${field} must be a positive integer`)
    }
    return value
  }
  const streamIdleTimeoutMs = config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS
  if (!Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs <= 0) {
    throw new Error('dsh-codebuddy: streamIdleTimeoutMs must be a positive finite number')
  }
  const baseURL = config.baseURL ?? CODEBUDDY_CHAT_BASE
  if (baseURL.length === 0) {
    throw new Error('dsh-codebuddy: baseURL must not be empty')
  }
  return {
    // A trailing slash would produce `//chat/completions`, which some gateways
    // route differently.
    baseURL: baseURL.replace(/\/+$/, ''),
    defaultContextWindow: positiveInteger(
      config.defaultContextWindow,
      'defaultContextWindow',
      DEFAULT_CONTEXT_WINDOW,
    ),
    defaultMaxTokens: positiveInteger(config.defaultMaxTokens, 'defaultMaxTokens', DEFAULT_MAX_TOKENS),
    streamIdleTimeoutMs,
  }
}

/** Mount the plugin: resolve config, then register the route. */
export function apply(ctx: Context, config: Config = {}): void {
  // Resolved once at load so a bad entry config fails loudly here; the thunk
  // keeps the adapter reading it per operation.
  const resolved = resolveConnectionOptions(config)
  const session = new CodeBuddySession(ctx.logger)
  const adapter = new CodeBuddyAdapter({ session, options: () => resolved })

  ctx.llm.registerAdapter([CODEBUDDY_PROVIDER], adapter)

  new CodeBuddyAuthService(ctx, session)

  // A signed-out mount is legitimate: the route registers, and the first
  // request explains how to sign in. Saying so once at load keeps that from
  // being a surprise at the first prompt.
  void session.isLoggedIn().then((loggedIn) => {
    if (loggedIn) return
    ctx.logger.info(
      'llm-codebuddy: no CodeBuddy session stored; sign in through the Settings'
      + ' → CodeBuddy page in the Web UI (no API key needed).',
    )
  }).catch(() => {
    // Reporting login state is advisory and must never fail the mount.
  })
}
