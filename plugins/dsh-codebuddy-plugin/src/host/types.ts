/**
 * 本插件读取的线缆形状，分属两个互不相关的协议。
 *
 * CodeBuddy 控制平面（`/v2/plugin/auth/*`、`/v3/config`）把每个响应包在
 * `{code, msg, requestId, data}` 里，且不与 OpenAI 兼容——这正是本插件存在、
 * 而不是直接用一条通用 OpenAI 兼容路由的原因。聊天平面（`/v2/chat/completions`）
 * 与 OpenAI 兼容，因此其块形状是熟悉的那一种。
 *
 * @module dsh-codebuddy/types
 */

/** 每个控制平面响应都携带的信封。 */
export interface ResponseBase {
  code: number
  msg: string
  requestId: string
}

/** 已发起的浏览器登录握手。 */
export interface AuthState {
  /** 不透明的握手 id；把浏览器会话与 token 轮询关联起来。 */
  state: string
  /** 用户打开以登录的 URL。 */
  authUrl: string
}

export interface AuthStateResponse extends ResponseBase {
  data?: AuthState
}

/**
 * 浏览器登录完成后签发的 token。
 *
 * 只有 `accessToken` 是必然存在的：服务端在不同客户端/网关下可能省略其余字段，
 * 或改用 snake_case 命名（`refresh_token` / `expires_in` / …）。字段因此标为可选，
 * 由 `normalizeAuthToken` 统一归一化后再使用——把类型写得比现实更严格，只会让
 * 解析层被迫做无意义的断言。
 */
export interface AuthToken {
  accessToken: string
  /** access token 的有效期（秒）。 */
  expiresIn?: number
  refreshToken?: string
  /** refresh token 的有效期（秒）。 */
  refreshExpiresIn?: number
  /**
   * 租户 domain，后续每个请求都必须原样带回。
   * 缺失时归一化为空串，避免把字符串 "undefined" 发进 `X-Domain`。
   */
  domain: string
}

export interface AuthTokenResponse extends ResponseBase {
  data?: AuthToken
}

/** 已登录身份；其字段会成为必备请求头。 */
export interface Account {
  uid: string
  nickname: string
  /** 腾讯用户身份号（例如 QQ openid），当账号披露时存在。 */
  uin?: string
  enterpriseId?: string
  /** 企业显示名，当账号属于企业租户时存在。 */
  enterpriseName?: string
  /** 企业用户名（账号在该租户内的名字）。 */
  enterpriseUserName?: string
  departmentFullName?: string
}

export interface AccountResponse extends ResponseBase {
  data?: Account
}

/**
 * CodeBuddy 为某个模型披露的推理元数据。effort id 是提供方自己的词表
 * （"low"、"high"、"xhigh"、"max"）；它们被原样透传而不是映射，因此目录日后
 * 新增的档位无需改代码。
 *
 * `supportedEfforts` 是真正可选的：`auto` 会返回一个声明了生效中 `effort` 但
 * 完全没有可选列表的推理块。
 */
export interface CodeBuddyReasoning {
  /** 该模型披露可选档位时的可选级别列表。 */
  supportedEfforts?: string[]
  /** 调用方不选择时应用的档位。 */
  defaultEffort?: string
  /** 服务端当前生效的档位；一种兜底默认值来源。 */
  effort?: string
  /** 思考能否被完全关闭。 */
  canDisableThinking?: boolean
  summary?: string
}

/**
 * CodeBuddy 所描述的单个模型。这是非 OpenAI 的目录形状：能力标志与容量在
 * 这里披露，而 OpenAI 的 `GET /models` 列表不会上报这些。
 */
export interface CodeBuddyModel {
  id: string
  name: string
  /** CodeBuddy 在模型名旁边显示的积分/额度标签。 */
  credits?: string
  /** 请求/响应合计的上下文容量。 */
  maxAllowedSize?: number
  maxOutputTokens?: number
  supportsImages?: boolean
  supportsToolCall?: boolean
  supportsReasoning?: boolean
  /** 披露时的可选思考档位。 */
  reasoning?: CodeBuddyReasoning
}

export interface CodeBuddyConfig {
  models: CodeBuddyModel[]
}

/**
 * 目录是否披露了 harness 所需的容量。
 *
 * harness 对其提供的每个模型都需要正的 `contextWindow` 与输出上限，而
 * CodeBuddy 在非聊天模型的条目上两者都省略（补全、改写/跳转、图像生成）。
 * 为这些条目编造数字，会让按猜测定容量的不可用模型混进选择器，因此调用方
 * 改为直接丢弃它们。此判断放在线缆类型旁边，让列表与解析路径对「哪些条目
 * 可提供」不可能产生分歧。
 * @param model - 一个目录条目。
 * @returns 两项容量都存在且为正时为 true。
 */
export function hasDisclosedCapacity(model: CodeBuddyModel): boolean {
  return model.maxAllowedSize !== undefined && model.maxAllowedSize > 0
    && model.maxOutputTokens !== undefined && model.maxOutputTokens > 0
}

export interface ConfigResponse extends ResponseBase {
  data?: CodeBuddyConfig
}

/**
 * 单个企业自定义模型，来自官方客户端使用的控制台模型端点
 * （`/console/enterprises/{enterpriseId}/config/models`）。
 *
 * 字段形状与个人 `/v3/config` 目录不同：容量披露为 `maxInputTokens`（而非
 * `maxAllowedSize`），而且根本没有 `maxAllowedSize`。模型带 `custom:` id 前缀。
 */
export interface CodeBuddyEnterpriseModel {
  id: string
  name: string
  /**请求上下文容量；控制台端点对 `maxAllowedSize` 的拼写。 */
  maxInputTokens?: number
  maxOutputTokens?: number
  supportsToolCall?: boolean
  supportsImages?: boolean
  /** 该模型是否被限制在多模型选择器之外。 */
  disabledMultiModel?: boolean
}

export interface CodeBuddyEnterpriseModelsResponse extends ResponseBase {
  data?: CodeBuddyEnterpriseModel[]
}

/**
 * 聊天端点在非 2xx 响应时返回的错误体。
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


/** OpenAI 兼容流的 usage 块。 */
export interface WireUsage {
  prompt_tokens: number
  completion_tokens: number
  prompt_cache_hit_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number }
  completion_tokens_details?: { reasoning_tokens?: number }
}

/** 单个流式工具调用分片。 */
export interface WireToolCall {
  index: number
  id?: string
  function?: {
    name?: string
    arguments?: string
  }
}

/** 单个 OpenAI 兼容流块。 */
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
   * 每个非最终块上都存在但显式为 `null`，因此消费方必须判 null，而不能只判
   * `undefined`。
   */
  usage?: WireUsage | null
}

/** 含图消息内部使用的单个 OpenAI 兼容内容分片。 */
export type WirePart =
  | { type: 'text', text: string }
  | { type: 'image_url', image_url: { url: string } }

/** user/system/tool 消息内容：紧凑字符串，或有序分片。 */
export type WireContent = string | WirePart[]

/** 发往聊天端点的单条线缆消息。 */
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

/** 发往聊天端点的单个 Tool schema。 */
export interface WireTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

/** chat-completions 请求体。 */
export interface WireRequest {
  model: string
  messages: WireMessage[]
  stream: true
  stream_options?: { include_usage: boolean }
  tools?: WireTool[]
  temperature?: number
  max_tokens?: number
  stop?: string[]
  /** OpenAI 兼容的思考档位；CodeBuddy 自己的 effort 词表。 */
  reasoning_effort?: string
}
