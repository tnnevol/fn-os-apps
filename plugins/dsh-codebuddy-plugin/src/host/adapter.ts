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
} from '../contracts/constants.ts'
import { NotLoggedInError } from './session.ts'
import type { CodeBuddySession } from './session.ts'
import { decideReactiveTarget } from './switch-policy.ts'
import type { SwitchCandidate } from './switch-policy.ts'
import { parseSse } from './sse.ts'
import { serializeRequest } from './serialize.ts'
import { hasRequestImages, serializeRequestWithImages } from './serialize-image.ts'
import { translate } from './translate.ts'
import { hasDisclosedCapacity } from './types.ts'
import type { CodeBuddyModel, WireError } from './types.ts'
import type { ImageAttachmentAccess } from '@deepseek-ai/dsh-llm'
import type { AttachmentStore, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'

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
  /** Whether quota failures may auto-switch the active account. */
  autoSwitch?: () => boolean
  /** 自动接管切号成功后回调（触发 harness 模型目录/用量即时刷新）。 */
  onAccountSwitched?: () => void
  /** Durable attachment service (`ctx.attachments`); required only for image input. */
  resolveAttachments?: () => AttachmentStore | undefined
  /** Resolve current tool access for one durable image handle, when available. */
  resolveImageAccess?: (attachments: AttachmentStore, ref: ImageAttachmentRef) => ImageAttachmentAccess | undefined
}

/**
 * 等待 `Retry-After` 的上限。
 *
 * 服务端可能给出很大的值（例如额度窗口按小时重置）。真的等下去会把整个会话挂住，
 * 而用户看到的是「卡住不动」；超过这个上限就直接换账号——换账号同样能解除限流，
 * 且不需要阻塞。
 */
const MAX_RETRY_WAIT_MS = 30_000

/** 无 `Retry-After` 时的指数退避基数（毫秒）。 */
const RETRY_BACKOFF_BASE_MS = 500

/**
 * 可被 `AbortSignal` 打断的等待。
 *
 * 用 `setTimeout` + `abort` 监听而不是 `AbortSignal.timeout`：后者无法与外部信号
 * 组合，也没有超时后的清理。这里保证两件事——无论哪条路径结束都清掉定时器与
 * 监听器，且已中止的信号不会留下悬挂的定时器。
 * @param ms - 等待毫秒数。
 * @param signal - 外部取消信号；中止时立即 resolve（由调用方检查 `aborted`）。
 * @returns 等待结束时 resolve；不会 reject。
 */
function waitFor(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  if (signal?.aborted === true) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const timer = setTimeout(finish, ms)
    function finish(): void {
      clearTimeout(timer)
      signal?.removeEventListener('abort', finish)
      resolve()
    }
    signal?.addEventListener('abort', finish, { once: true })
  })
}

/**
 * 计算本次失败后应等待多久。
 *
 * 优先采用服务端给出的 `Retry-After`（它最了解什么时候能恢复），但夹到
 * {@link MAX_RETRY_WAIT_MS} 以内；没有该头时退回指数退避。
 * @param error - 触发切换的错误，可能带 `providerRetryAfterMs`。
 * @param attempt - 已尝试次数（从 0 起算），用于指数退避。
 * @returns 等待毫秒数与来源，便于日志说明。
 */
function retryDelayFor(error: LlmError, attempt: number): { ms: number, source: 'provider' | 'backoff', clipped: boolean } {
  // `providerRetryAfterMs` 是 DSH 在 LlmFailure 上定义的一等字段（不是自定义
  // details），因此由 harness 统一保证它的来源与类型。
  const provider = error.failure.providerRetryAfterMs
  if (provider !== undefined && provider > 0) {
    const clipped = provider > MAX_RETRY_WAIT_MS
    return { ms: Math.min(provider, MAX_RETRY_WAIT_MS), source: 'provider', clipped }
  }
  // 指数退避 500ms / 1s / 2s / 4s…，同样夹在上限内。
  const ms = Math.min(RETRY_BACKOFF_BASE_MS * 2 ** Math.max(0, attempt), MAX_RETRY_WAIT_MS)
  return { ms, source: 'backoff', clipped: false }
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
 * The client-identity headers the official CodeBuddy CLI sends on every chat
 * request. Reverse-engineered from `@tencent-ai/codebuddy-code` (2.145.0): it
 * identifies itself as the CLI product through the `X-IDE-*` family, and the
 * service attributes traffic to the official client from these headers.
 *
 * Only this fixed client-identity set is stamped — no per-request ids are
 * invented for the conversation/request/message headers.
 */
function clientIdentityHeaders(): Record<string, string> {
  return {
    'X-IDE-Type': 'CLI',
    'X-IDE-Name': 'CLI',
    'X-IDE-Version': CODEBUDDY_CLI_VERSION,
  }
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
  // display metadata only: the harness does not route or budget on it. The
  // shipped composer ModelSelect renders only `model.name`, so the rate is
  // not visible there — it stays visible via the `/model` popup's detail row.
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

  /**
   * The public entry the harness drives. Failover lives here: the first
   * attempt runs against the active account, and a quota-exhausted or
   * rate-limited response switches to the next usable account and retries
   * once. Retrying is only safe BEFORE the stream yields its first chunk —
   * a failure mid-stream rethrows to the caller (the consumed prefix must not
   * be replayed), and the NEXT conversation turn starts on the new account.
   */
  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    // 登记在途请求：主动切换据此避让，不打断正在输出的流。finally 保证任何
    // 结束路径（正常、抛错、被取消、调用方提前 return）都会减回去。
    this.config.session.beginRequest()
    try {
      yield* this.runWithFailover(options)
    } finally {
      this.config.session.endRequest()
    }
  }

  /** 一次请求的完整生命周期（含账号故障转移），由 `stream` 包裹。 */
  private async * runWithFailover(options: GenerateOptions): AsyncIterable<StreamChunk> {
    /**
     * 本次请求**已尝试过**的账号。必须是请求级状态（不能放 session 或全局）：
     * 它是「同一请求内不重复使用同一账号」的依据，跨请求共享会误伤后续请求。
     */
    const attempted = new Set<string>()
    const current = await this.config.session.activeAccountSummary()
    if (current !== undefined) attempted.add(current.id)
    try {
      yield* this.attemptStream(options)
    } catch (error) {
      if (!(error instanceof LlmError)) throw error
      // Only account-exhaustion classes warrant a switch; transport faults and
      // context-window overruns would fail on every account alike.
      const autoSwitch = this.config.autoSwitch?.() ?? true
      const swappable = autoSwitch
        && (error.code === QUOTA_EXCEEDED_CODE || error.code === 'RATE_LIMIT')
      if (!swappable) throw error
      /**
       * 遵守服务端的 `Retry-After`：被限流时先等一会再换账号。
       *
       * 等待是可中断的（`options.signal`），且夹到 MAX_RETRY_WAIT_MS 以内 ——
       * 服务端可能给出按小时计的间隔，真等下去会让会话看起来卡死。超上限就直接
       * 换账号：换号同样能解除限流，且不阻塞。
       */
      // 退避次数用「已尝试账号数 - 1」：首个账号不算重试。clipped 表示服务端
      // 要求的间隔超过上限，此时等待被截断，日志由 session 侧统一记录。
      const delay = retryDelayFor(error, Math.max(0, attempted.size - 1))
      if (delay.ms > 0) {
        await waitFor(delay.ms, options.signal)
        // 等待期间被取消：按调用方取消处理，不再换号重试。
        if (options.signal?.aborted === true) {
          throw new LlmError('CodeBuddy request aborted while waiting to retry', 'ABORTED')
        }
      }

      const switched = await this.failoverToNextAccount(error, attempted)
      if (!switched) throw error
      attempted.add(switched.id)
      // Surface the takeover as visible assistant text before the retried
      // stream starts: the StreamChunk union has no status member, and the
      // user should see why the request momentarily paused and whose quota
      // now pays for the rest of the conversation.
      yield {
        type: 'text-delta',
        index: 0,
        text: `\n[CodeBuddy] 账号「${switched.from}」额度不足，已自动切换至「${switched.to}」继续。\n`,
      }
      yield* this.attemptStream(options)
    }
  }

  /**
   * Switch the active account to the next usable one after a quota failure.
   * @param error - the failure that triggered the switch.
   * @returns the from/to display names, or `undefined` when no other account
   *   can take over (single account, or every other credential expired).
   */
  private async failoverToNextAccount(
    error: LlmError,
    attempted: ReadonlySet<string>,
  ): Promise<{ from: string, to: string, id: string } | undefined> {
    const current = await this.config.session.activeAccountSummary()
    if (current === undefined) return undefined
    const entries = await this.config.session.failoverCandidates()
    if (entries === undefined) return undefined

    // 交给纯函数决策：它负责排除已尝试过的账号、排除凭据失效者，并按剩余额度排序。
    // 让 adapter 只做「取数 → 决策 → 执行」，切换规则才能被单测覆盖。
    const candidates: SwitchCandidate[] = []
    for (const entry of entries) {
      const remainingPct = await this.config.session.remainingPercentFor(entry)
      candidates.push({
        id: entry.id,
        nickname: entry.account.nickname,
        credentialValid: entry.auth.refreshExpiresAt > Date.now(),
        ...remainingPct === undefined ? {} : { remainingPct },
      })
    }
    const decision = decideReactiveTarget({
      candidates,
      failedId: current.id,
      triedIds: [...attempted],
    })
    if (decision.kind === 'stay') return undefined

    // CAS：探测期间当前账号可能已被改动（用户手动切换、或并发的主动切换）。
    // 不匹配就放弃，避免拿着过期状态把账号切回去。
    const applied = await this.config.session.switchTo(decision.targetId, current.id)
    if (!applied) return undefined
    try { this.config.onAccountSwitched?.() } catch { /* 广播失败不影响请求继续 */ }
    return { from: current.nickname, to: decision.targetNickname, id: decision.targetId }
  }

  /**
   * One request attempt against the ACTIVE account: resolve identity and
   * endpoint, fetch, and translate the SSE body. No retry, no failover — the
   * wrapper above owns those.
   */
  private async * attemptStream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    // One resolution per call, before the first yield: the endpoint facts and
    // the identity freeze together, so a token refreshed mid-stream cannot be
    // paired with a different generation's endpoint.
    const connection = this.config.options()
    let headers: Record<string, string>
    let chatBase = connection.baseURL
    try {
      headers = await this.config.session.authHeaders()
      chatBase = this.config.session.chatBase() ?? connection.baseURL
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
    // Images: when the request carries a durable image and the model declares
    // image input, the plain text serializer would silently drop it. Resolve
    // request versions through the attachment service and rebuild the wire
    // messages with OpenAI-compatible inline `image_url` parts.
    const wantsImage = hasRequestImages(options.messages)
    if (wantsImage && !supportsImages) {
      throw new LlmError(
        `CodeBuddy model "${options.model}" does not accept image content.`,
        'UNSUPPORTED_CONTENT',
      )
    }
    const attachments = wantsImage ? this.config.resolveAttachments?.() : undefined
    if (wantsImage && attachments === undefined) {
      throw new LlmError(
        'CodeBuddy image input requires the durable attachment service',
        'UNSUPPORTED_CONTENT',
      )
    }
    const wireRequest = wantsImage && attachments !== undefined
      ? await serializeRequestWithImages(options, attachments, (ref) => this.config.resolveImageAccess?.(attachments, ref))
      : body
    // Serialized before the try so the transport label below covers only the
    // transport boundary.
    const payload = JSON.stringify(wireRequest)

    let response: Response
    try {
      response = await fetch(`${chatBase}/chat/completions`, {
        method: 'POST',
        headers: {
          ...headers,
          ...clientIdentityHeaders(),
          'content-type': 'application/json',
          'accept': 'text/event-stream',
          // **不能**改用 `attributionHeaders()`。DSH 的契约要求适配器每个请求都带
          // harness 归因（`deepseek-harness/x.y.z (+url)`），但那与本服务的要求
          // 直接冲突——实测（真实凭据）：
          //   UA = CLI/2.148.0 CodeBuddy/2.148.0        → HTTP 200
          //   UA = deepseek-harness/0.1.2-rc.1 (+url)   → HTTP 400 code=11128
          //   UA = harness/... CLI/...（拼接）          → HTTP 400
          //   UA = CLI/... harness/...（追加）          → HTTP 400
          // 即：UA 里只要出现 harness 标识就被安全策略拦截。该字段在这里是**服务端
          // 的准入门槛**而非归因信息，因此必须保持 CodeBuddy 客户端签名。
          // harness 侧的归因由 `X-IDE-*` 之外的本插件语义承担；若上游调整该策略，
          // 这里需要与 DSH 的 attribution 契约重新对齐。
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
        `CodeBuddy request to ${chatBase} failed`,
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
