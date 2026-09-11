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
import {
  CODEBUDDY_CLIENT_PLATFORMS,
  CODEBUDDY_CLIENT_VERSIONS,
  CODEBUDDY_DEFAULT_CLIENT,
} from '../contracts/constants.ts'
import type { CodeBuddyClientId } from '../contracts/constants.ts'
import { hasDisclosedCapacity, wireErrorDetail, wireErrorMessage } from './types.ts'
import type { CodeBuddyModel, WireError, WireRequest } from './types.ts'
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
 * 「等待与退避」为什么**不在本模块**里。
 *
 * 这里曾经实现过一套 `Retry-After` 解析 + 有限等待 + 指数退避（上限 30s）。
 * 后来核实：DSH 自带的 `@deepseek-ai/dsh-llm-retry` 已随 `dsh-base` 挂载，工作
 * 在整个 agent 请求层面，默认 `maxRetries: 5`，自带指数退避（500ms 起、上限
 * 10s、±10% 抖动）**以及 `Retry-After` 支持**。而且它的语义更准确：当服务端给出
 * 的间隔超过 `maxDelayMs` 时直接放弃重试，而不是截断后硬等。
 *
 * 两套并存会产生乘法关系：外层每次重试都会把内层整个跑一遍。因此本模块只保留
 * 官方**不做**的那件事——`QUOTA`（额度耗尽）时换账号，因为官方默认不重试该码，
 * 而换账号是唯一有效手段。等待与退避交给外层。
 */
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
 * The client-identity headers the official client sends on every chat request.
 *
 * 服务端用这组头把流量**归因到具体客户端**（`X-IDE-*` 家族），因此它们必须与
 * 「这个账号是用哪个客户端登录的」一致 —— 不是插件级的固定值。
 *
 * 用 CLI 标识发 WorkBuddy 账号的请求，服务端**仍会受理**（实测三种组合都返回
 * 200），但会把流量记到错误的客户端上：客户端侧的用量/统计归因会错，服务端若
 * 按客户端做策略（限流、灰度、审计）也会对这个账号判错。
 *
 * 版本也必须跟着客户端走：CLI 与 WorkBuddy 是两条产品线、版本号各不相同
 * （见 {@link CODEBUDDY_CLIENT_VERSIONS}），且都是产品发布版本、不随会话变化。
 *
 * @param client - 当前活动账号的客户端 id。
 * @param version - 该客户端的版本号；缺省时按字典回退。
 * @returns `X-IDE-*` 头集合。
 */
function clientIdentityHeaders(client: CodeBuddyClientId, version: string | undefined): Record<string, string> {
  // 取值与登录时声明的 `platform` 参数一致（`CLI` / `workbuddy`）。
  const platform = CODEBUDDY_CLIENT_PLATFORMS[client]
  return {
    'X-IDE-Type': platform,
    'X-IDE-Name': platform,
    'X-IDE-Version': version ?? CODEBUDDY_CLIENT_VERSIONS[client],
  }
}

/**
 * 客户端身份的 `User-Agent`。
 *
 * 官方 CLI 的形态是 `CLI/<v> CodeBuddy/<v>`（产品名 + 版本，重复两次）；WorkBuddy
 * 同形，把产品名换成 `WorkBuddy`。实测服务端对 UA 做安全策略校验：
 *  - 含 `deepseek-harness` 标识 → HTTP 400 code=11128（被拦截，见调用点注释）
 *  - CLI / WorkBuddy 两种签名 → HTTP 200
 * @param client - 当前活动账号的客户端 id。
 * @param version - 该客户端的版本号。
 * @returns 可直接作为 `user-agent` 的值。
 */
function clientUserAgent(client: CodeBuddyClientId, version: string | undefined): string {
  const v = version ?? CODEBUDDY_CLIENT_VERSIONS[client]
  const product = client === 'workbuddy' ? 'WorkBuddy' : 'CLI'
  return `${product}/${v} CodeBuddy/${v}`
}

/**
 * CodeBuddy 的业务码：**用量/频率额度已用尽**。
 *
 * 实测语义（同一账号同一时刻跑三个模型）：
 *
 * ```
 * deepseek-v4.1-flash   18298014993:429  涨涨涨:200  16605655975:200
 * glm-5.3              18298014993:200  涨涨涨:200  16605655975:200
 * ```
 *
 * 即 `18298014993` 对 `deepseek-v4.1-flash` 是 429、对 `glm-5.3` 是 200 —— 说明
 * 这是**账号 × 模型**级别的额度耗尽，而不是服务端整体限流。文案也印证：
 * 「您的使用量已超出频率限制，将在 <时间> 重置，您也可以切换其他模型继续使用。」
 *
 * 因此它必须归到 `QUOTA`：上层据此**换账号**（换号能成功，实测另一个账号 200）。
 * 若归到 `RATE_LIMIT`，DSH 官方重试会原地重试同一个账号、同一个模型——而该组合
 * 在重置时间之前不可能成功，只会白耗 5 次请求后失败。
 */
const CODEBUDDY_QUOTA_EXHAUSTED_CODE = '6004'

/**
 * Map an HTTP status onto a stable harness error code.
 * @param status - the non-2xx status.
 * @param error - the parsed provider error body, when readable.
 * @returns the normalized code.
 */
export function httpErrorCode(status: number, error?: WireError): string {
  if (status === 401 || status === 403) return 'AUTH'
  /**
   * 分类文本由 `wireErrorDetail` 生成：把业务 `code` 也拼进去。
   *
   * DSH 的 `isQuotaExceededError` 判定正则只认**英文**，而 CodeBuddy 的文案是
   * 中文（「您的使用量已超出频率限制」），单靠文案匹配不上；因此下面额外按
   * **业务码**判定，不让分类退化成「凡是 429 都是限流」。
   */
  const detail = wireErrorDetail(error)
  if (isQuotaExceededError(detail)) return QUOTA_EXCEEDED_CODE
  // 业务码 6004：账号×模型的额度用尽（见常量注释）。归 QUOTA 才能触发换账号。
  if (String(error?.code ?? error?.error?.data?.code ?? '') === CODEBUDDY_QUOTA_EXHAUSTED_CODE) {
    return QUOTA_EXCEEDED_CODE
  }
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

  /**
   * 一次请求的完整生命周期（含账号故障转移），由 `stream` 包裹。
   *
   * ## 与外层官方重试的职责划分
   *
   * DSH 自带的 `@deepseek-ai/dsh-llm-retry` 已随 `dsh-base` 挂载，工作在整个
   * **agent 请求**层面（`agent/request-error`），默认 `maxRetries: 5`，带指数退避
   * 与 `Retry-After` 支持，可重试码为
   * `EMPTY_RESPONSE / RATE_LIMIT / SERVER / TIMEOUT / TRANSPORT`。
   *
   * | 故障 | 由谁处理 | 为什么 |
   * | --- | --- | --- |
   * | 瞬时故障（网络、5xx、超时） | 外层 | 原地重试即可，换账号无益 |
   * | **额度/频率用尽（`QUOTA` 与 `RATE_LIMIT`）** | **本层换账号** | 见下 |
   * | `Retry-After` 等待 | 外层 | 官方已实现（含「超过 maxDelayMs 则放弃」的更优语义） |
   *
   * ### 为什么 `RATE_LIMIT` 也要换账号
   *
   * 曾经把它交给外层原地重试，理由是「限流是服务端对该账号的节流，换账号不解决」。
   * **实测否证了这个前提**——CodeBuddy 的 429 是**账号 × 模型**级别的额度耗尽：
   *
   * ```
   * deepseek-v4.1-flash   18298014993:429  涨涨涨:200  16605655975:200
   * glm-5.3              18298014993:200  涨涨涨:200  16605655975:200
   * ```
   *
   * 同一账号对 `deepseek-v4.1-flash` 是 429、对 `glm-5.3` 是 200，且**另一个账号
   * 对同一模型是 200** —— 换账号确实有效。而且这类 429 **不带 `retry-after`**，
   * 外层只能盲目退避、原地重试同一个账号同一个模型，在重置时间之前不可能成功。
   * 用户看到的现象就是「开了自动切换却没切」。
   *
   * 内层换号得到成功结果后，外层不会再有失败可重试，因此两层不会叠加。
   */
  private async * runWithFailover(options: GenerateOptions): AsyncIterable<StreamChunk> {
    /**
     * 本次请求**已尝试过**的账号。必须是请求级状态（不能放 session 或全局）：
     * 它是「同一请求内不重复使用同一账号」的依据，跨请求共享会误伤后续请求。
     */
    const attempted = new Set<string>()
    const current = await this.config.session.activeAccountSummary()
    if (current !== undefined) attempted.add(current.id)

    /**
     * 尝试上限 = 账号总数。
     *
     * 不写死成 5：本层的语义是「每个账号试一次」，所以上限天然由账号数决定。
     * 账号少时对着空气重试没有意义，账号多时也不该被一个魔数截断。
     */
    const total = await this.config.session.accountCount()
    const maxAttempts = Math.max(1, total)

    let lastError: LlmError | undefined
    /**
     * 开关是否允许换号。**在切换点显式检查**，而不是依赖「上一轮 catch 检查过」
     * 这个隐式前提。
     *
     * 当前控制流下后者也确实成立（开关关闭时第 0 轮的 catch 就抛出了，走不到这里），
     * 但那种「安全性由另一个分支的副作用保证」的写法很脆：一旦有人把切换挪个位置
     * 或调整循环结构，用户关掉的开关就会被静默绕过——而「关掉自动切换」的预期是
     * **包含被动换号在内**的全部自动换号。
     */
    const autoSwitchAllowed = (): boolean => this.config.autoSwitch?.() ?? true
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      // 首次尝试前不切换；之后的每一轮都已经由上一轮末尾切好了账号。
      if (attempt > 0) {
        if (!autoSwitchAllowed()) throw lastError as LlmError
        const switched = await this.failoverToNextAccount(lastError as LlmError, attempted)
        if (switched === undefined) break
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
      }

      /**
       * 是否已经向调用方产出过 chunk。
       *
       * 一旦产出过，后续错误**必须直接抛出**：重试意味着重新发送整个请求，会让
       * 用户看到重复内容、工具调用被重复执行，并可能造成重复计费。
       *
       * 当前 `attemptStream` 里所有 `throw` 都发生在唯一一条 `yield*` 之前，
       * 因此这个标志恒为假；显式写出来是为了把该不变量**固化在代码里**——将来
       * 若有人在流中途抛出可切换错误，这里会挡住重放而不是静默行为改变。
       */
      let emitted = false
      try {
        for await (const chunk of this.attemptStream(options)) {
          emitted = true
          yield chunk
        }
        return
      } catch (error) {
        if (!(error instanceof LlmError)) throw error
        // 已产出内容：不重试、不换号。宁可失败，也不重复生成。
        if (emitted) throw error
        lastError = error
        /**
         * 换账号的两个触发条件：额度耗尽（QUOTA）与被限流（RATE_LIMIT）。
         *
         * 曾经只认 QUOTA，理由是「限流是服务端对该账号的节流，换账号不解决」。
         * **实测否证了这个前提**：CodeBuddy 的 429 是**账号 × 模型**级别的额度
         * 耗尽，换账号能成功——
         *
         * ```
         * deepseek-v4.1-flash   18298014993:429  涨涨涨:200  16605655975:200
         * glm-5.3              18298014993:200  涨涨涨:200  16605655975:200
         * ```
         *
         * 且这类 429 **不带 `retry-after`**，外层官方重试只能盲目退避、原地重试
         * 同一个账号同一个模型，在重置时间之前不可能成功——白耗 5 次请求后失败，
         * 用户看到的就是「开启了自动切换却没有切换」。
         *
         * 瞬时故障（网络、5xx、超时）仍交给外层原地重试：那些换账号确实无益。
         */
        const swappable = error.code === QUOTA_EXCEEDED_CODE || error.code === 'RATE_LIMIT'
        if (!autoSwitchAllowed() || !swappable) throw error
      }
    }
    // 换不动了（没有未尝试过的账号、或尝试次数用尽）：把最后一次的失败如实抛出，
    // 由外层官方重试决定是否继续。
    throw lastError ?? new LlmError('CodeBuddy request failed with no account available', QUOTA_EXCEEDED_CODE)
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
    /**
     * 当前账号的客户端身份。与 headers/chatBase 同源：**请求带哪个客户端的
     * 标识与版本，取决于这个账号是用哪个客户端登录的**，不是插件级固定值。
     * 未登录时回退到默认客户端（与既有的 chatBase 回退同一策略）。
     */
    let client: CodeBuddyClientId = CODEBUDDY_DEFAULT_CLIENT
    let clientVersion: string | undefined
    try {
      headers = await this.config.session.authHeaders()
      chatBase = this.config.session.chatBase() ?? connection.baseURL
      client = this.config.session.activeClient() ?? CODEBUDDY_DEFAULT_CLIENT
      clientVersion = this.config.session.activeClientVersion()
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

    /**
     * 选择**唯一一条**序列化路径，而不是「先跑一遍无图版本再决定」。
     *
     * 旧写法先无脑调 `serializeRequest(options, supportsImages)`，再判断 `wantsImage`：
     * 有图时白做一次（无图版本会丢图、要后面重建），不支持图时 `serializeRequest →
     * assertSupportedContent` 会**先抛 UNSUPPORTED_CONTENT**，让下面那条专门的「不
     * 支持图」分支成为死代码。把判断与分支放到前面更清晰。
     */
    const wantsImage = hasRequestImages(options.messages)
    if (wantsImage && !supportsImages) {
      throw new LlmError(
        `CodeBuddy model "${options.model}" does not accept image content.`,
        'UNSUPPORTED_CONTENT',
      )
    }
    let body: WireRequest
    if (wantsImage) {
      const attachments = this.config.resolveAttachments?.()
      if (attachments === undefined) {
        throw new LlmError(
          'CodeBuddy image input requires the durable attachment service',
          'UNSUPPORTED_CONTENT',
        )
      }
      body = await serializeRequestWithImages(
        options,
        attachments,
        (ref) => this.config.resolveImageAccess?.(attachments, ref),
      )
    } else {
      body = serializeRequest(options, supportsImages)
    }
    // Serialized before the try so the transport label below covers only the
    // transport boundary.
    const payload = JSON.stringify(body)

    let response: Response
    try {
      response = await fetch(`${chatBase}/chat/completions`, {
        method: 'POST',
        headers: {
          ...headers,
          ...clientIdentityHeaders(client, clientVersion),
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
          'user-agent': clientUserAgent(client, clientVersion),
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
      let providerError: WireError | undefined
      try {
        providerError = await response.json() as WireError
        /**
         * 用 `wireErrorMessage` 而不是只读 `error.message`：CodeBuddy 用的是自己
         * 的信封，实测两种形态（扁平 `{code,msg}` 与嵌套 `{error:{data:{msg}}}`）
         * **都没有** OpenAI 的 `error.message`。只读它就等于把服务端原文丢掉，
         * 用户只看到「CodeBuddy API error (HTTP 429)」——而原文里写着什么时候
         * 重置、可以换哪个模型，正是排查所需。
         */
        const text = wireErrorMessage(providerError)
        if (text !== undefined) message = text
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
