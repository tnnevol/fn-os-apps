/**
 * `CodeBuddyAdapter`: fetch + SSE against CodeBuddy's OpenAI-compatible chat
 * route, with identity and the model catalog resolved from the OAuth session.
 *
 * The split matters: the chat plane is OpenAI-compatible, but the catalog plane
 * is not, so models are described from CodeBuddy's own `/v3/config` reply — that
 * is where per-model tool-call, reasoning, image, and size facts come from. No
 * API key exists anywhere in this class; every request is authorized by the
 * browser-minted bearer token the session refreshes.
 *
 * @module dsh-codebuddy/adapter
 */

import {
  CONTEXT_WINDOW_EXCEEDED_CODE,
  isContextWindowExceededError,
  isQuotaExceededError,
  LlmAdapter,
  LlmError,
  ProviderRequestId,
  QUOTA_EXCEEDED_CODE,
  ReasoningEffortId,
} from '@deepseek-ai/dsh-llm'
import type {
  GenerateOptions,
  LlmModelInfo,
  LlmModelReasoningInfo,
  LlmProviderInfo,
  LlmReasoningEffortInfo,
  LlmResolvedModelInfo,
  PreparedAdapterCall,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
import {
  CODEBUDDY_CLI_VERSION,
  CODEBUDDY_DISPLAY_NAME,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
} from './constants.ts'
import { NotLoggedInError } from './session.ts'
import type { CodeBuddySession } from './session.ts'
import { parseSse } from './sse.ts'
import { serializeRequest } from './serialize.ts'
import { translate } from './translate.ts'
import { hasDisclosedCapacity } from './types.ts'
import type { CodeBuddyModel, WireError } from './types.ts'

/** Connection facts the registering plugin resolves and the adapter trusts. */
export interface CodeBuddyConnectionOptions {
  /** Chat endpoint base; `/chat/completions` is appended. */
  baseURL: string
  /** Context capacity used when the catalog does not size a model. */
  defaultContextWindow: number
  /** Per-request output cap used when the catalog does not cap a model. */
  defaultMaxTokens: number
  /** Maximum provider idle time while one stream read is outstanding. */
  streamIdleTimeoutMs: number
}

/** Constructor options: the session plus the per-operation connection thunk. */
export interface CodeBuddyAdapterOptions {
  session: CodeBuddySession
  options: () => CodeBuddyConnectionOptions
}

/** Parse a `retry-after` header into milliseconds, when it carries a usable delay. */
function providerRetryAfterMs(value: string | null): number | undefined {
  if (value === null) return undefined
  if (/^\d+$/.test(value)) {
    const delay = Number(value) * 1_000
    return Number.isFinite(delay) && delay > 0 ? delay : undefined
  }
  const delay = Date.parse(value) - Date.now()
  return Number.isFinite(delay) && delay > 0 ? delay : undefined
}

function requestId(headers: Headers): ReturnType<typeof ProviderRequestId> | undefined {
  const value = headers.get('x-request-id') ?? headers.get('x-requestid')
  return value === null || value.length === 0 ? undefined : ProviderRequestId(value)
}

/**
 * Map an HTTP status onto a stable harness error code.
 * @param status - the non-2xx status.
 * @param error - the parsed provider error body, when readable.
 * @returns the normalized code.
 */
export function httpErrorCode(status: number, error?: WireError['error']): string {
  if (status === 401 || status === 403) return 'AUTH'
  const detail = [error?.code, error?.type, error?.message].filter(Boolean).join(' ')
  if (isQuotaExceededError(detail)) return QUOTA_EXCEEDED_CODE
  if (status === 429) return 'RATE_LIMIT'
  if (status === 400) {
    if (isContextWindowExceededError(detail)) return CONTEXT_WINDOW_EXCEEDED_CODE
    return 'INVALID_REQUEST'
  }
  if (status >= 500) return 'SERVER'
  return `HTTP_${status}`
}

/** Build the harness model descriptor for one catalog entry. */
function modelInfo(provider: string, model: CodeBuddyModel): LlmModelInfo {
  // The credit label goes in `description` — "user-facing distinction from
  // otherwise similar models" — rather than being spliced into `name`. Keeping
  // `name` as CodeBuddy's own name means a credit change (which CodeBuddy can
  // make at any time) no longer looks like the model was renamed. Note this is
  // display metadata only: the harness does not route or budget on it.
  //
  // The wire value is already a formatted multiplier ("x3.33", "x0.05"), so it
  // is shown bare: it is the whole point of the field here, and the selector
  // renders `description` on one nowrap line with an ellipsis, so every extra
  // word costs visible information. `x0.00` is kept rather than hidden — a
  // zero-rate model is a fact worth showing, and suppressing it would make the
  // field look broken.
  const credits = model.credits?.trim()
  return {
    provider,
    id: model.id,
    name: model.name,
    ...credits === undefined || credits.length === 0 ? {} : { description: credits },
    inputModalities: model.supportsImages === true ? ['text', 'image'] : ['text'],
  }
}

/** Human-readable names for CodeBuddy's effort vocabulary. */
const EFFORT_NAMES: Readonly<Record<string, string>> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
}

/**
 * Translate CodeBuddy's disclosed thinking levels into harness reasoning
 * metadata, or `undefined` when the catalog gives nothing selectable.
 *
 * The levels are passed through as opaque ids rather than mapped onto a fixed
 * scale: they are exactly what the chat endpoint accepts as `reasoning_effort`,
 * so a level CodeBuddy adds later needs no code change here. An unrecognized id
 * still gets a readable name from its own spelling.
 *
 * `undefined` is returned rather than a partial value in three cases, because
 * the harness rejects each as INVALID_MODEL_REASONING and a rejected catalog is
 * worse than an absent capability:
 *   - no reasoning block at all;
 *   - a block with no `supportedEfforts` (`auto` declares an active `effort`
 *     but no list, so there is nothing for a user to choose between);
 *   - an empty or duplicate-only list.
 */
function reasoningInfo(model: CodeBuddyModel): LlmModelReasoningInfo | undefined {
  const supported = model.reasoning?.supportedEfforts
  if (supported === undefined) return undefined

  const seen = new Set<string>()
  const efforts: LlmReasoningEffortInfo[] = []
  for (const raw of supported) {
    const id = typeof raw === 'string' ? raw.trim() : ''
    if (id.length === 0 || seen.has(id)) continue
    seen.add(id)
    efforts.push({
      id: ReasoningEffortId(id),
      name: EFFORT_NAMES[id] ?? id,
    })
  }
  if (efforts.length === 0) return undefined

  // `defaultEffort` is preferred, falling back to the server-side active
  // `effort`. Either is only honoured if it appears in the selectable list —
  // the harness rejects a default it cannot find, and some catalog entries name
  // an `effort` outside their own list.
  const candidate = model.reasoning?.defaultEffort ?? model.reasoning?.effort
  const defaultEffort = candidate !== undefined && seen.has(candidate)
    ? ReasoningEffortId(candidate)
    : undefined

  return {
    efforts,
    ...defaultEffort === undefined ? {} : { defaultEffort },
  }
}

/**
 * The CodeBuddy adapter. One instance serves the single `codebuddy` route and
 * every model that route's catalog reports.
 */
export class CodeBuddyAdapter extends LlmAdapter {
  constructor(private readonly config: CodeBuddyAdapterOptions) {
    super()
  }

  override providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: CODEBUDDY_DISPLAY_NAME }
  }

  override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const models = await this.config.session.modelsOrEmpty()
    // Entries whose capacities the catalog withholds are left out rather than
    // sized by invention: CodeBuddy omits them on its non-chat models, so
    // offering them would put unusable choices in the picker. An id dropped
    // here stays routable through `resolveModel` for anyone who names it
    // explicitly.
    return models
      .filter(model => hasDisclosedCapacity(model))
      .map(model => modelInfo(provider, model))
  }

  override async resolveModel(
    provider: string,
    model: string,
    signal?: AbortSignal,
  ): Promise<LlmResolvedModelInfo> {
    const connection = this.config.options()
    const models = await this.config.session.modelsOrEmpty(signal)
    const entry = models.find(candidate => candidate.id === model)
    if (entry === undefined) {
      // An unlisted id is still routable — the catalog is advisory — but
      // nothing is known about it, so the conservative text-only shape is
      // declared rather than letting the host persist images the serializer
      // would then reject.
      return {
        provider,
        id: model,
        name: model,
        inputModalities: ['text'],
        context: { contextWindow: connection.defaultContextWindow },
        defaultMaxTokens: connection.defaultMaxTokens,
      }
    }
    const reasoning = reasoningInfo(entry)
    return {
      ...modelInfo(provider, entry),
      context: {
        contextWindow: entry.maxAllowedSize !== undefined && entry.maxAllowedSize > 0
          ? entry.maxAllowedSize
          : connection.defaultContextWindow,
      },
      defaultMaxTokens: entry.maxOutputTokens !== undefined && entry.maxOutputTokens > 0
        ? entry.maxOutputTokens
        : connection.defaultMaxTokens,
      // Reasoning levels come straight from the catalog's own `supportedEfforts`
      // and `defaultEffort`. Declaring them is only safe because `stream()`
      // forwards the selected level as `reasoning_effort`: the harness
      // materializes its default into every request, so a declared-but-unsent
      // capability would be a control that silently does nothing.
      ...reasoning === undefined ? {} : { reasoning },
    }
  }

  /**
   * Bind model metadata and dispatch to one adapter generation. Kept explicit
   * rather than inherited so the call path does not depend on which dsh-llm
   * copy the host resolves: every copy in the supported peer range
   * (>=0.1.2-rc.1) carries this default, and the override is its equivalent.
   */
  override async prepareCall(
    provider: string,
    model: string,
    signal?: AbortSignal,
  ): Promise<PreparedAdapterCall> {
    return {
      model: await this.resolveModel(provider, model, signal),
      stream: (options) => this.stream(options),
    }
  }

  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    // One resolution per call, before the first yield: the endpoint facts and
    // the identity freeze together, so a token refreshed mid-stream cannot be
    // paired with a different generation's endpoint.
    const connection = this.config.options()
    let headers: Record<string, string>
    try {
      headers = await this.config.session.authHeaders()
    } catch (error) {
      if (error instanceof NotLoggedInError) {
        throw new LlmError(error.message, 'MISSING_CREDENTIAL', { cause: error })
      }
      throw error
    }

    const models = await this.config.session.modelsOrEmpty(options.signal)
    const entry = models.find(candidate => candidate.id === options.model)
    const supportsImages = entry?.supportsImages === true

    if (options.tools !== undefined && options.tools.length > 0 && entry?.supportsToolCall === false) {
      throw new LlmError(
        `CodeBuddy model "${options.model}" does not support tool calls`,
        'UNSUPPORTED_OPTION',
      )
    }

    const body = serializeRequest(options, supportsImages)
    // Serialized before the try so the transport label below covers only the
    // transport boundary.
    const payload = JSON.stringify(body)

    let response: Response
    try {
      response = await fetch(`${connection.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          ...headers,
          'content-type': 'application/json',
          'accept': 'text/event-stream',
          'user-agent': `CLI/${CODEBUDDY_CLI_VERSION} CodeBuddy/${CODEBUDDY_CLI_VERSION}`,
        },
        body: payload,
        ...options.signal === undefined ? {} : { signal: options.signal },
      })
    } catch (error: unknown) {
      if (options.signal?.aborted) {
        throw new LlmError('CodeBuddy request aborted by caller', 'ABORTED', { cause: error })
      }
      // fetch reports every transport fault as a bare `TypeError: fetch
      // failed`; the endpoint and the chained cause are what make it
      // diagnosable.
      throw new LlmError(
        `CodeBuddy request to ${connection.baseURL} failed`,
        'TRANSPORT',
        { cause: error },
      )
    }

    if (!response.ok) {
      let message = `CodeBuddy API error (HTTP ${response.status})`
      let providerError: WireError['error']
      try {
        const parsed = await response.json() as WireError
        providerError = parsed.error
        if (providerError?.message !== undefined && providerError.message.length > 0) {
          message = providerError.message
        }
      } catch {
        // Only error-body parsing is swallowed: the status still identifies the
        // failure, so malformed JSON must not mask it.
      }
      if (response.status === 401 || response.status === 403) {
        // The stored token was rejected outright; drop it from memory so the
        // next call re-reads the file (a concurrent login may have replaced it)
        // instead of retrying a token already known to be refused.
        this.config.session.invalidate()
      }
      const delay = providerRetryAfterMs(response.headers.get('retry-after'))
      const id = requestId(response.headers)
      throw new LlmError(message, httpErrorCode(response.status, providerError), {
        status: response.status,
        ...delay === undefined ? {} : { providerRetryAfterMs: delay },
        ...id === undefined ? {} : { requestId: id },
      })
    }

    if (response.body === null) {
      throw new LlmError('CodeBuddy API returned no response body', 'EMPTY_RESPONSE')
    }

    yield* translate(parseSse(response.body), options.tools)
  }
}

export { DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_TOKENS }
