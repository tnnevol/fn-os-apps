/** Bridge the plugin-owned OAuth credential into dsh's generic LLM seam. */

import { createModels } from '@earendil-works/pi-ai'
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import type { CodexCredentialStore } from './store.ts'
import { CODEX_PROVIDER } from './store.ts'

/** Credential reference exposed to the official `llm-pi-ai` model settings UI. */
export const CODEX_API_KEY_ENV = 'OPENAI_CODEX_AUTH_TOKEN'
export const CODEX_API_KEY_REF = credentialRef(CODEX_API_KEY_ENV)

/**
 * Makes the plugin-owned OAuth token visible to the generic dsh adapter.
 *
 * `llm-pi-ai` deliberately resolves named credentials through `ctx.credentials`
 * on every request. The OAuth document remains the source of truth; this class
 * only mirrors the short-lived access token so the official Models page can
 * show its configured state and the generic adapter can send Codex requests.
 */
export class CodexCredentialMirror {
  private readonly models
  private operation: Promise<void> | undefined

  constructor(
    private readonly credentials: CredentialProvider,
    private readonly store: CodexCredentialStore,
  ) {
    this.models = createModels({ credentials: this.store })
    this.models.setProvider(openaiCodexProvider())
  }

  /** Refresh OAuth when needed, then update the generic dsh credential seam. */
  async sync(): Promise<void> {
    if (this.operation !== undefined) return this.operation
    const operation = this.syncNow()
    this.operation = operation
    try {
      await operation
    } finally {
      if (this.operation === operation) this.operation = undefined
    }
  }

  /** Remove the mirrored token after the plugin-owned account signs out. */
  async clear(): Promise<void> {
    await this.operation?.catch(() => undefined)
    await this.credentials.unset(CODEX_API_KEY_REF)
  }

  private async syncNow(): Promise<void> {
    const resolved = await this.models.getAuth(CODEX_PROVIDER)
    const accessToken = resolved?.auth.apiKey
    if (accessToken !== undefined && accessToken.length > 0) {
      await this.credentials.set(CODEX_API_KEY_REF, accessToken)
      return
    }
    await this.credentials.unset(CODEX_API_KEY_REF)
  }
}
