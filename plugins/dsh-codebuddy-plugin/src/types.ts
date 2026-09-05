/**
 * Wire shapes this plugin reads, on two unrelated protocols.
 *
 * The CodeBuddy control plane (`/v2/plugin/auth/*`, `/v3/config`) wraps every
 * reply in `{code, msg, requestId, data}` and is NOT OpenAI-compatible — which
 * is the reason this plugin exists rather than a plain OpenAI-compatible route.
 * The chat plane (`/v2/chat/completions`) is OpenAI-compatible, so its chunk
 * shape is the familiar one.
 *
 * @module dsh-codebuddy/types
 */

/** Envelope every CodeBuddy control-plane reply carries. */
export interface ResponseBase {
  code: number
  msg: string
  requestId: string
}

/** A started browser-login handshake. */
export interface AuthState {
  /** Opaque handshake id; correlates the browser session with the token poll. */
  state: string
  /** URL the user opens to sign in. */
  authUrl: string
}

export interface AuthStateResponse extends ResponseBase {
  data?: AuthState
}

/** Tokens issued once the browser login completes. */
export interface AuthToken {
  accessToken: string
  /** Access-token lifetime in seconds. */
  expiresIn: number
  refreshToken: string
  /** Refresh-token lifetime in seconds. */
  refreshExpiresIn: number
  /** Tenant domain that must be echoed on every later request. */
  domain: string
}

export interface AuthTokenResponse extends ResponseBase {
  data?: AuthToken
}

/** The signed-in identity; its fields become required request headers. */
export interface Account {
  uid: string
  nickname: string
  /** Tencent user identity number (e.g. QQ openid), when the account discloses one. */
  uin?: string
  enterpriseId?: string
  /** Enterprise display name, when the account is an enterprise tenant. */
  enterpriseName?: string
  /** Enterprise user name (the account's name within the tenant). */
  enterpriseUserName?: string
  departmentFullName?: string
}

export interface AccountResponse extends ResponseBase {
  data?: Account
}

/**
 * Reasoning metadata CodeBuddy discloses for one model. The effort ids are the
 * provider's own vocabulary ("low", "high", "xhigh", "max"); they are passed
 * through verbatim rather than mapped, so a level the catalog adds later needs
 * no code change.
 *
 * `supportedEfforts` is genuinely optional: `auto` ships a reasoning block that
 * declares an active `effort` but no selectable list at all.
 */
export interface CodeBuddyReasoning {
  /** Selectable levels, when this model discloses a choice. */
  supportedEfforts?: string[]
  /** Level applied when the caller picks none. */
  defaultEffort?: string
  /** Level currently active server-side; a fallback default source. */
  effort?: string
  /** Whether thinking can be turned off entirely. */
  canDisableThinking?: boolean
  summary?: string
}

/**
 * One model as CodeBuddy describes it. This is the non-OpenAI catalog shape:
 * capability flags and sizes are disclosed here, which an OpenAI `GET /models`
 * listing would not report.
 */
export interface CodeBuddyModel {
  id: string
  name: string
  /** Credit/quota label CodeBuddy shows beside the model name. */
  credits?: string
  /** Combined request/response context capacity. */
  maxAllowedSize?: number
  maxOutputTokens?: number
  supportsImages?: boolean
  supportsToolCall?: boolean
  supportsReasoning?: boolean
  /** Selectable thinking levels, when disclosed. */
  reasoning?: CodeBuddyReasoning
}

export interface CodeBuddyConfig {
  models: CodeBuddyModel[]
}

/**
 * Whether the catalog disclosed the capacities the harness requires.
 *
 * The harness needs a positive `contextWindow` and output cap for every model
 * it offers, and CodeBuddy omits both on entries that are not chat models
 * (completion, rewrite/jump, image generation). Inventing numbers for those
 * would put unusable models in the picker sized by guesswork, so callers drop
 * them instead. Kept here, beside the wire type, so the listing and the resolve
 * path cannot disagree about which entries are offerable.
 * @param model - one catalog entry.
 * @returns true when both capacities are present and positive.
 */
export function hasDisclosedCapacity(model: CodeBuddyModel): boolean {
  return model.maxAllowedSize !== undefined && model.maxAllowedSize > 0
    && model.maxOutputTokens !== undefined && model.maxOutputTokens > 0
}

export interface ConfigResponse extends ResponseBase {
  data?: CodeBuddyConfig
}

/**
 * One enterprise custom model, from the console models endpoint the official
 * client uses (`/console/enterprises/{enterpriseId}/config/models`).
 *
 * The field shape differs from the personal `/v3/config` catalog: capacity is
 * disclosed as `maxInputTokens` (not `maxAllowedSize`), and there is no
 * `maxAllowedSize` at all. Models carry an `custom:` id prefix.
 */
export interface CodeBuddyEnterpriseModel {
  id: string
  name: string
  /** Request context capacity; the console endpoint's spelling of `maxAllowedSize`. */
  maxInputTokens?: number
  maxOutputTokens?: number
  supportsToolCall?: boolean
  supportsImages?: boolean
  /** Whether the model is restricted from the multi-model selector. */
  disabledMultiModel?: boolean
}

export interface CodeBuddyEnterpriseModelsResponse extends ResponseBase {
  data?: CodeBuddyEnterpriseModel[]
}

/** Error body an OpenAI-compatible chat endpoint returns on a non-2xx reply. */
export interface WireError {
  error?: {
    message?: string
    type?: string
    code?: string
  }
}

/** Usage block of an OpenAI-compatible stream. */
export interface WireUsage {
  prompt_tokens: number
  completion_tokens: number
  prompt_cache_hit_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number }
  completion_tokens_details?: { reasoning_tokens?: number }
}

/** One streamed tool-call fragment. */
export interface WireToolCall {
  index: number
  id?: string
  function?: {
    name?: string
    arguments?: string
  }
}

/** One OpenAI-compatible stream chunk. */
export interface WireChunk {
  choices?: {
    delta?: {
      content?: string | null
      reasoning_content?: string | null
      reasoning?: string | null
      tool_calls?: WireToolCall[] | null
    } | null
    finish_reason?: string | null
  }[] | null
  /**
   * Present but explicitly `null` on every non-final chunk, so consumers must
   * test for null rather than only `undefined`.
   */
  usage?: WireUsage | null
}

/** One wire message sent to the chat endpoint. */
export interface WireMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  reasoning_content?: string
  tool_call_id?: string
  tool_calls?: {
    id: string
    type: 'function'
    function: { name: string, arguments: string }
  }[]
}

/** One tool schema sent to the chat endpoint. */
export interface WireTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

/** The chat-completions request body. */
export interface WireRequest {
  model: string
  messages: WireMessage[]
  stream: true
  stream_options?: { include_usage: boolean }
  tools?: WireTool[]
  temperature?: number
  max_tokens?: number
  stop?: string[]
  /** OpenAI-compatible thinking level; CodeBuddy's own effort vocabulary. */
  reasoning_effort?: string
}
