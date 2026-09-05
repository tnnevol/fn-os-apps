/**
 * Refresh the OpenAI Codex route's model catalog from the signed-in
 * ChatGPT account instead of the pi-ai installed static table.
 *
 * pi-ai ships a build-time snapshot of Codex models (`gpt-5.3-codex-spark` …
 * `gpt-5.6-*`). The ChatGPT backend lists what the *signed-in account* can
 * actually use today (`chatgpt.com/backend-api/codex/models`), which drifts
 * from that snapshot — new models appear (e.g. `gpt-6-astra`) and retired
 * ones disappear. The harness model catalog, the in-conversation model
 * picker, and the plugin's own global-model Cascader all read the route's
 * model list from llm-pi-ai, which resolves the profile's `models` array
 * over the pi-ai catalog. Writing that array therefore updates every
 * selector at once, and writing it in the user settings layer *replaces*
 * the composition's static list (DSH settings merge arrays wholesale).
 *
 * Only the account's user-visible model rows are written: internal service
 * rows (`codex-auto-review`, `gpt-reserve`, anything the backend marks
 * `visibility: hide`) are skipped so pickers keep showing models a human
 * would choose.
 */

import { createModels } from '@earendil-works/pi-ai'
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'
import type { CodexCredentialStore } from './store.ts'
import { CODEX_PROVIDER } from './store.ts'

export const CODEX_MODELS_URL = 'https://chatgpt.com/backend-api/codex/models'
export const CODEX_MODELS_CLIENT_VERSION = '1.0.0'
export const CODEX_MODELS_TIMEOUT_MS = 15_000

/**
 * Thinking levels DSH's llm-pi-ai profile vocabulary can express. The ChatGPT
 * backend may advertise `ultra` (and more in future) which this vocabulary
 * cannot carry; such levels are dropped from the written profile, with the
 * model's remaining levels preserved.
 */
const LLM_PI_AI_THINKING_LEVELS = new Set(['minimal', 'low', 'medium', 'high', 'xhigh', 'max'])

/** Rows the account endpoint returns for machinery, not human selection. */
const INTERNAL_CODEX_MODEL_IDS = new Set(['codex-auto-review', 'gpt-reserve'])

interface ReasoningLevelRow {
  effort: string
  description?: string
}

interface UpstreamCodexModel {
  slug: string
  display_name?: string
  visibility?: string
  input_modalities?: readonly string[]
  context_window?: number
  max_context_window?: number
  supported_reasoning_levels?: readonly ReasoningLevelRow[]
  default_reasoning_level?: string
}

/** Parsed account model-catalog payload. */
export interface CodexModelCatalogResponse {
  readonly models?: readonly UpstreamCodexModel[]
}

/** One normalized model entry ready to write into the llm-pi-ai profile. */
export interface CodexProfileModel {
  id: string
  name: string
  contextWindow: number
  maxTokens: number
  input: readonly string[]
  reasoningEfforts: Record<string, string> | false
}

/** Outcome of a refresh, safe for the Web route and the card to display. */
export interface CodexModelRefreshResult {
  /** Models written into the llm-pi-ai profile, in account order. */
  models: readonly CodexProfileModel[]
  /** Upstream rows skipped because they are not human-selectable. */
  skipped: readonly string[]
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function accessToken(auth: { apiKey?: string } | undefined): string | undefined {
  return typeof auth?.apiKey === 'string' && auth.apiKey.length > 0 ? auth.apiKey : undefined
}

function accountId(credential: unknown): string | undefined {
  const value = record(credential)?.['accountId']
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

/** Resolve the output-cap estimate for one account row. */
function outputCap(model: UpstreamCodexModel): number {
  const context = number(model.context_window)
  if (context === undefined) return 128_000
  // pi-ai's installed codex models cap output at 128k tokens.
  return Math.min(128_000, Math.max(32_768, context))
}

/** Map account modalities onto pi-ai's `input` vocabulary (text/image only). */
function inputModalities(model: UpstreamCodexModel): readonly string[] {
  const raw = model.input_modalities
  if (!Array.isArray(raw) || raw.length === 0) return ['text']
  const allowed = new Set(['text', 'image'])
  const values = raw.filter(value => typeof value === 'string' && allowed.has(value))
  return values.length > 0 ? values : ['text']
}

/**
 * Normalize the account's reasoning levels into llm-pi-ai's
 * `reasoningEfforts` dict (level → wire value) or `false`.
 *
 * The backend effort names double as the wire value the responses API
 * expects, so each supported level maps to itself. `ultra` and any future
 * level outside llm-pi-ai's vocabulary is dropped; a model whose only
 * declared level falls outside the vocabulary becomes `false` (no thinking).
 */
export function normalizeReasoningEfforts(
  model: UpstreamCodexModel,
): Record<string, string> | false {
  const rows = model.supported_reasoning_levels
  if (!Array.isArray(rows) || rows.length === 0) return false
  const efforts: Record<string, string> = {}
  for (const row of rows) {
    const effort = string(row.effort)
    if (effort === undefined || !LLM_PI_AI_THINKING_LEVELS.has(effort)) continue
    efforts[effort] = effort
  }
  return Object.keys(efforts).length > 0 ? efforts : false
}

function isSelectable(model: UpstreamCodexModel): boolean {
  if (model.slug === undefined) return false
  if (INTERNAL_CODEX_MODEL_IDS.has(model.slug)) return false
  return model.visibility !== 'hide'
}

/**
 * Normalize one raw account model row into a profile entry, or `undefined`
 * when the row is not human-selectable or lacks the identity/context facts a
 * profile entry requires.
 */
export function normalizeCodexModel(model: UpstreamCodexModel): CodexProfileModel | undefined {
  const id = string(model.slug)
  if (id === undefined || !isSelectable(model)) return undefined
  const name = string(model.display_name) ?? id
  const context = number(model.context_window)
  if (context === undefined) return undefined
  return {
    id,
    name,
    contextWindow: context,
    maxTokens: outputCap(model),
    input: inputModalities(model),
    reasoningEfforts: normalizeReasoningEfforts(model),
  }
}

/**
 * Normalize a full account catalog response into the list of profile model
 * entries and the skipped row slugs. The result is ready to write to the
 * llm-pi-ai `providers.openai-codex.models` array.
 */
export function normalizeCodexCatalog(
  payload: CodexModelCatalogResponse,
): { models: readonly CodexProfileModel[]; skipped: readonly string[] } {
  const rows = Array.isArray(payload.models) ? payload.models : []
  const models: CodexProfileModel[] = []
  const skipped: string[] = []
  for (const row of rows) {
    const entry = normalizeCodexModel(row)
    if (entry === undefined) {
      const slug = string(row.slug)
      if (slug !== undefined && row.visibility === 'hide') skipped.push(slug)
      continue
    }
    models.push(entry)
  }
  return { models, skipped }
}

/** Read the signed-in account's current Codex model catalog. */
export async function fetchCodexModelCatalog(
  store: CodexCredentialStore,
  fetchImpl: typeof fetch = fetch,
): Promise<CodexModelCatalogResponse> {
  const models = createModels({ credentials: store })
  models.setProvider(openaiCodexProvider())
  const resolved = await models.getAuth(CODEX_PROVIDER)
  const token = accessToken(resolved?.auth)
  if (token === undefined) {
    throw new Error('codex model refresh requires a signed-in ChatGPT account')
  }
  const account = accountId(await store.read(CODEX_PROVIDER))
  if (account === undefined) {
    throw new Error('codex model refresh requires the ChatGPT account id')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, CODEX_MODELS_TIMEOUT_MS)
  try {
    const url = new URL(CODEX_MODELS_URL)
    url.searchParams.set('client_version', CODEX_MODELS_CLIENT_VERSION)
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        'ChatGPT-Account-Id': account,
        'user-agent': 'dsh-codex-auth-plugin',
      },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`Codex model catalog request failed with status ${String(response.status)}`)
    }
    const payload: unknown = await response.json()
    const parsed = record(payload)
    if (parsed === undefined || !Array.isArray(parsed['models'])) {
      throw new Error('Codex model catalog response was not an object with a models array')
    }
    return { models: parsed['models'] as readonly UpstreamCodexModel[] }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch and normalize the account catalog. Returns the ready-to-write model
 * list plus skipped row slugs; throws a plain `Error` when the account is
 * signed out, the backend request fails, or the payload is unusable.
 */
export async function refreshCodexModelCatalog(
  store: CodexCredentialStore,
  fetchImpl: typeof fetch = fetch,
): Promise<CodexModelRefreshResult> {
  const payload = await fetchCodexModelCatalog(store, fetchImpl)
  const { models, skipped } = normalizeCodexCatalog(payload)
  if (models.length === 0) {
    throw new Error('Codex model catalog returned no selectable models')
  }
  return { models, skipped }
}
