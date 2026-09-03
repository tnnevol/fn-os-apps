import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ModelProviderGroup } from '@deepseek-ai/dsh-api-session-controller/types'

interface CatalogFailure {
  id: string
  name: string
  message: string
}

export interface CodexModelCatalog {
  groups: readonly ModelProviderGroup[]
  failures?: readonly CatalogFailure[]
}

interface LegacyConnection {
  api?: {
    llm?: {
      models?: (payload: Record<string, never>) => Promise<{
        result: {
          ok: true
          value: CodexModelCatalog
        } | {
          ok: false
          error: { message: string }
        }
      }>
    }
  }
}

interface ModernRemote {
  session?: {
    modelCatalog?: () => Promise<{
      ok: true
      value: CodexModelCatalog
    } | {
      ok: false
      error: { message: string }
    }>
  }
}

function errorMessage(error: { message: string } | undefined, fallback: string): string {
  return error?.message || fallback
}

/**
 * Read the host model catalog from the alpha.4 Remote API, with a guarded
 * legacy fallback for mixed deployments that still expose the old connection
 * API.
 */
export async function loadCodexModelCatalog(
  connection: ConnectionHandle,
  remote: unknown,
): Promise<CodexModelCatalog> {
  const modern = (remote as ModernRemote | undefined)?.session?.modelCatalog
  if (typeof modern === 'function') {
    const result = await modern()
    if (!result.ok) throw new Error(errorMessage(result.error, 'DSH model catalog request failed'))
    return result.value
  }

  const legacy = (connection as unknown as LegacyConnection).api?.llm?.models
  if (typeof legacy !== 'function') {
    throw new Error('DSH model catalog API is unavailable')
  }
  const response = await legacy({})
  if (!response.result.ok) throw new Error(errorMessage(response.result.error, 'DSH model catalog request failed'))
  return response.result.value
}
