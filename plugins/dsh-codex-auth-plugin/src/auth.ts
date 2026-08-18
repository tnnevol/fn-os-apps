/** ChatGPT OAuth orchestration used by the Host routes and CLI consumers. */

import { createModels } from '@earendil-works/pi-ai'
import type { AuthInteraction } from '@earendil-works/pi-ai'
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'
import { CodexCredentialStore, CODEX_PROVIDER } from './store.ts'

export interface CodexAuthStatus {
  authenticated: boolean
  expiresAt?: Date
}

/** Start provider-native ChatGPT OAuth and persist its credential. */
export async function loginCodex(
  interaction: AuthInteraction,
  store: CodexCredentialStore = new CodexCredentialStore(),
): Promise<void> {
  const models = createModels({ credentials: store })
  models.setProvider(openaiCodexProvider())
  await models.login(CODEX_PROVIDER, 'oauth', interaction)
}

/** Delete the plugin-owned Codex credential. */
export async function logoutCodex(
  store: CodexCredentialStore = new CodexCredentialStore(),
): Promise<void> {
  await store.delete(CODEX_PROVIDER)
}

/** Read login state without refreshing the token. */
export async function codexAuthStatus(
  store: CodexCredentialStore = new CodexCredentialStore(),
): Promise<CodexAuthStatus> {
  const credential = await store.read(CODEX_PROVIDER)
  return credential?.type === 'oauth'
    ? { authenticated: true, expiresAt: new Date(credential.expires) }
    : { authenticated: false }
}
