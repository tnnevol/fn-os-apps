/** OpenAI Codex adapter assembled from dsh's public pi-ai extension seam. */

import { createModels, defaultProviderAuthContext } from '@earendil-works/pi-ai'
import type { MutableModels, Provider } from '@earendil-works/pi-ai'
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import { resolveRetryPolicy } from '@deepseek-ai/dsh-llm'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import type { ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import type { CodexCredentialStore } from './store.ts'
import { CODEX_PROVIDER } from './store.ts'

/** Keep the Codex stream open while the provider is still producing output. */
export const CODEX_STREAM_IDLE_TIMEOUT_MS = 300_000

/** Match DSH rc.2's default request-level image payload bound. */
export const CODEX_MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024

/** Match DSH rc.2's default per-image total-pixel budget. */
export const CODEX_REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048

/** Match DSH rc.2's default raw per-image byte budget. */
export const CODEX_REQUEST_IMAGE_MAX_BYTES = 1024 * 1024

/**
 * Give dsh's generic adapter the bearer token resolved by the plugin-owned
 * OAuth store. This keeps the provider-native login flow separate from model
 * requests while preserving pi-ai's Codex endpoint and model catalog.
 */
function requestProvider(provider: Provider): Provider {
  return {
    ...provider,
    auth: {
      ...provider.auth,
      apiKey: {
        name: 'OpenAI Codex OAuth bearer token',
        async resolve({ credential }) {
          const apiKey = credential?.key
          return apiKey === undefined || apiKey.length === 0
            ? undefined
            : { auth: { apiKey }, source: 'OAuth' }
        },
      },
    },
  }
}

/** Create the dsh LLM adapter for the provider-native OpenAI Codex catalog. */
export function createCodexAdapter(
  credentials: CodexCredentialStore,
  resolveAttachments: () => AttachmentStore | undefined,
): PiAiAdapter {
  const provider = openaiCodexProvider()
  const profiles = new Map<string, ResolvedPiAiProviderProfile>([[CODEX_PROVIDER, {
    provider: CODEX_PROVIDER,
    displayName: 'OpenAI Codex',
    streamIdleTimeoutMs: CODEX_STREAM_IDLE_TIMEOUT_MS,
    maxRequestImageBytes: CODEX_MAX_REQUEST_IMAGE_BYTES,
    requestImagePixelBudget: CODEX_REQUEST_IMAGE_PIXEL_BUDGET,
    requestImageMaxBytes: CODEX_REQUEST_IMAGE_MAX_BYTES,
    retryPolicy: resolveRetryPolicy(undefined, 'dsh-codex-auth-plugin retryPolicy'),
    configuredMaxTokens: new Map(),
    piProvider: requestProvider(provider),
  }]])
  const models: MutableModels = createModels({ credentials })
  models.setProvider(provider)
  return new PiAiAdapter({
    profiles: () => profiles,
    resolveApiKey: async () => (await models.getAuth(CODEX_PROVIDER))?.auth.apiKey,
    // DSH 0.1.1 requires every pi-ai adapter to provide an explicit auth
    // context. Codex credentials remain owned by this plugin's file-backed
    // store; the default context supplies only ambient env/file discovery.
    auth: {
      credentials,
      authContext: defaultProviderAuthContext(),
    },
    resolveAttachments,
  })
}
