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

/**
 * Tokens issued once the browser login completes.
 *
 * 只有 `accessToken` 是必然存在的：服务端在不同客户端/网关下可能省略其余字段，
 * 或改用 snake_case 命名（`refresh_token` / `expires_in` / …）。字段因此标为可选，
 * 由 `normalizeAuthToken` 统一归一化后再使用——把类型写得比现实更严格，只会让
 * 解析层被迫做无意义的断言。
 */
export interface AuthToken {
  accessToken: string
  /** Access-token lifetime in seconds. */
  expiresIn?: number
  refreshToken?: string
  /** Refresh-token lifetime in seconds. */
  refreshExpiresIn?: number
  /**
   * Tenant domain that must be echoed on every later request.
   * 缺失时归一化为空串，避免把字符串 "undefined" 发进 `X-Domain`。
   */
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

/**
 * Error body a chat endpoint returns on a non-2xx reply.
 *
 * CodeBuddy 实际用的是**产品自己的信封**，而不是 OpenAI 的 `{error:{message}}`。
 * 实测抓到两种形态（同一服务、不同账号/场景）：
 *
 * ```json
 * // ① 扁平（额度/频率限制常见）
 * {"code":6004,"msg":"您的使用量已超出频率限制，将在 … 重置，您也可以切换其他模型继续使用。","requestId":"…"}
 * // ② 嵌套（业务错误，如「体验版尚未激活」）
 * {"error":{"data":{"code":14017,"msg":"体验版尚未激活。…","requestId":"…"}}}
 * ```
 *
 * 只声明 OpenAI 形态会让 `msg` 被丢掉，用户只看到兜底的
 * `CodeBuddy API error (HTTP 429)` —— 而服务端那句「何时重置、可换哪个模型」
 * 正是排查所需。
 */
export interface WireError {
  /** OpenAI 兼容形态。 */
  error?: {
    message?: string
    type?: string
    code?: string
    /** CodeBuddy 业务信封：`{"error":{"data":{code,msg,requestId}}}`。 */
    data?: {
      message?: string
      msg?: string
      type?: string
      code?: string | number
      requestId?: string
    }
  }
  /** CodeBuddy 扁平形态：文案在顶层 `msg`（注意不是 OpenAI 的 `message`）。 */
  msg?: string
  /** 扁平形态的业务码（不是 HTTP 状态码）。 */
  code?: string | number
  /** 顶层请求 id，与 `error.data.requestId` 同义。 */
  requestId?: string
}

/**
 * 从任一错误信封里取出**能给人看的那句话**。
 *
 * 优先级：OpenAI 的 `error.message` → 嵌套的 `error.data.msg|message` → 顶层的
 * `msg`。取第一个非空值；都没有时返回 `undefined`，由调用方回退到带 HTTP 状态的
 * 兜底文案。
 * @param body - 已解析的错误响应体。
 * @returns 服务端原文，或 `undefined`。
 */
export function wireErrorMessage(body: WireError | undefined): string | undefined {
  if (body === undefined) return undefined
  const candidates: Array<string | undefined> = [
    body.error?.message,
    body.error?.data?.msg,
    body.error?.data?.message,
    body.msg,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate
  }
  return undefined
}

/**
 * 供**错误分类**使用的文本（业务 code + type + message 拼起来）。
 *
 * `httpErrorCode` 用它判断「额度耗尽 / 上下文超限」。注意 CodeBuddy 的文案是
 * **中文**，而 DSH 的判定正则是英文，因此中文文案本身匹配不上 —— 但业务 `code`
 * 能帮上忙，所以这里把 code 一并拼进去，让分类至少有据可依。
 * @param body - 已解析的错误响应体。
 * @returns 供正则匹配的文本（可能为空串）。
 */
export function wireErrorDetail(body: WireError | undefined): string {
  if (body === undefined) return ''
  const nested = body.error?.data
  return [
    body.code,
    body.error?.code,
    nested?.code,
    body.error?.type,
    nested?.type,
    wireErrorMessage(body),
  ]
    .filter(value => value !== undefined && value !== '')
    .map(String)
    .join(' ')
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

/** One OpenAI-compatible content part used inside image-bearing messages. */
export type WirePart =
  | { type: 'text', text: string }
  | { type: 'image_url', image_url: { url: string } }

/** User/system/tool message content: the compact string, or ordered parts. */
export type WireContent = string | WirePart[]

/** One wire message sent to the chat endpoint. */
export interface WireMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: WireContent
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
