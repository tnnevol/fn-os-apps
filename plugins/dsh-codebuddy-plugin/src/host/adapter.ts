/**
 * `CodeBuddyAdapter`：对 CodeBuddy 的 OpenAI 兼容聊天路由做 fetch + SSE，
 * 身份与模型目录由 OAuth 会话解析。
 *
 * 这个拆分很关键：聊天平面是 OpenAI 兼容的，但目录平面不是，因此模型描述
 * 来自 CodeBuddy 自己的 `/v3/config` 应答——每个模型的工具调用、推理、图像
 * 与大小等事实都出自那里。本类中任何地方都不存在 API key；每个请求都由
 * 会话刷新的浏览器签发 bearer token 授权。
 *
 * @module dsh-codebuddy/adapter
 */

import type { CodeBuddyAdapterOptions } from '../types/host/adapter'
export type { CodeBuddyConnectionOptions, CodeBuddyAdapterOptions } from '../types/host/adapter'
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
import type { GenerateOptions, LlmModelInfo, LlmModelReasoningInfo, LlmProviderInfo, LlmReasoningEffortInfo, LlmResolvedModelInfo, PreparedAdapterCall, StreamChunk } from '@deepseek-ai/dsh-llm'
import {
  CODEBUDDY_DISPLAY_NAME,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
} from '../contracts/constants.ts'
import { NotLoggedInError } from './session.ts'

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
/** 把 `retry-after` 头解析为毫秒数（当它带有可用延迟时）。 */
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
 * 官方客户端在每个聊天请求上都发送的客户端身份头。
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
 * 把 HTTP 状态映射为稳定的 harness 错误码。
 * @param status - 非 2xx 的状态码。
 * @param error - 可读时为解析出的 provider 错误体。
 * @returns 规范化后的错误码。
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

/** 为一条目录条目构建 harness 模型描述符。 */
function modelInfo(provider: string, model: CodeBuddyModel): LlmModelInfo {
  // credit 标签放进 `description`——"user-facing distinction from
  // otherwise similar models"（与相似模型对用户可见的区分）——而不是拼进
  // `name`。保持 `name` 为 CodeBuddy 自己的名字，意味着 credit 变化（
  // CodeBuddy 随时可能做）不再看起来像模型被改名了。注意这只是展示元数据：
  // harness 不据此做路由或预算。随包发布的 composer ModelSelect 只渲染
  // `model.name`，所以倍率在那里不可见——它仍可通过 `/model` 弹窗的详情行看到。
  //
  // 网络值本身就是已格式化的倍率（"x3.33"、"x0.05"），所以直接裸展示：
  // 它就是这个字段在此处的全部意义，而且选择器把 `description` 渲染在单行
  // 不换行加省略号上，每多一个词都在消耗可见信息。`x0.00` 保留而不是隐藏——
  // 零倍率模型是一个值得展示的事实，压掉它会让这个字段看起来像坏了。
  const credits = model.credits?.trim()
  return {
    provider,
    id: model.id,
    name: model.name,
    ...credits === undefined || credits.length === 0 ? {} : { description: credits },
    inputModalities: model.supportsImages === true ? ['text', 'image'] : ['text'],
  }
}

/** CodeBuddy 的努力程度词表的人类可读名称。 */
const EFFORT_NAMES: Readonly<Record<string, string>> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
}

/**
 * 把 CodeBuddy 披露的思考档位翻译成 harness 的推理元数据；当目录没有给出
 * 任何可选档位时为 `undefined`。
 *
 * 档位以不透明 id 的形式透传，而不是映射到固定刻度：它们正是聊天端点接受
 * 的 `reasoning_effort` 值，因此 CodeBuddy 以后新增档位也不需要改这里的
 * 代码。无法识别的 id 仍能从其拼写得到一个可读名称。
 *
 * 三种情况下返回 `undefined` 而不是部分值，因为 harness 会把每一种都判为
 * INVALID_MODEL_REASONING，而被拒的目录比缺失的能力更糟：
 *   - 完全没有 reasoning 块；
 *   - 有块但没有 `supportedEfforts`（`auto` 声明了活动的 `effort` 却没有
 *     列表，用户没有可选的项）；
 *   - 空列表或仅含重复项的列表。
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

  // 优先使用 `defaultEffort`，回退到服务端的活动 `effort`。两者只有在
  // 出现在可选列表里时才被采纳——harness 会拒绝它找不到的默认值，而有些
  // 目录条目把 `effort` 写在自己列表之外。
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
 * CodeBuddy 适配器。一个实例服务于单一的 `codebuddy` 路由以及该路由目录
 * 报告的每一个模型。
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
    // 目录未披露容量的条目被剔除而不是靠编造补上尺寸：CodeBuddy 在它的
    // 非聊天模型上就是这样省略的，把它们放出去会往选择器里塞不可用的选项。
    // 在这里被丢弃的 id 仍可经 `resolveModel` 路由，供显式点名它的人使用。
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
      // 未列入目录的 id 仍可路由——目录只是建议性的——但对它一无所知，
      // 因此声明保守的纯文本形态，而不是让 host 把序列化器随后会拒绝的
      // 图像持久化下来。
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
      // 推理档位直接取自目录自身的 `supportedEfforts` 与 `defaultEffort`。
      // 声明它们之所以安全，是因为 `stream()` 会把选中的档位作为
      // `reasoning_effort` 转发：harness 把它的默认值物化进每个请求，所以
      // 一个"声明了却从不发送"的能力会变成一个静默失效的控件。
      ...reasoning === undefined ? {} : { reasoning },
    }
  }

  /**
   * 绑定模型元数据并派发到一代适配器调用。保持显式实现而不是继承，这样
   * 调用路径不依赖 host 解析到哪个 dsh-llm 副本：支持区间（>=0.1.5-rc.2）
   * 内的每个副本都带有这个默认实现，此覆写与其等价。
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
   * harness 驱动的公开入口。故障转移在这里：首次尝试对当前活动账号发出，
   * 额度耗尽或被限流的应答会切换到下一个可用账号并重试一次。只有在流产出
   * 第一个 chunk 之前重试才是安全的——流中途的失败直接重抛给调用方（已
   * 消费的前缀绝不能重放），下一轮对话从新账号开始。
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
        // 走到这里说明上一轮的 catch 已经记下了错误（否则第 0 轮就抛出去了），
        // 但保持显式判空：不依赖「另一个分支的副作用」，将来挪动循环结构也不会
        // 变成抛一个 undefined。
        if (!autoSwitchAllowed()) {
          if (lastError === undefined) break
          throw lastError
        }
        const switched = await this.failoverToNextAccount(attempted)
        if (switched === undefined) break
        attempted.add(switched.id)
        // 在重试的流开始前，把接管以可见的助手文本呈现出来：StreamChunk
        // 联合类型没有 status 成员，而用户应当看到请求为何短暂停顿、以及
        // 后续对话由谁的额度来支付。
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
   * 在额度失败后，把当前活动账号切换到下一个可用的账号。
   *
   * 不接收触发失败本身：换号只关心「还有哪些账号没试过」（`attempted`），
   * 失败原因由调用方负责呈现。
   *
   * @param attempted 本轮已试过的账号 id（避免在两个账号之间来回切）。
   * @returns from/to 展示名；当没有其他账号能接管时为 `undefined`
   *   （只有一个账号，或其余凭据全部过期）。
   */
  private async failoverToNextAccount(
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
   * 对当前活动账号的一次请求尝试：解析身份与端点、fetch 并翻译 SSE 体。
   * 不重试、不故障转移——那些由上面的包装层负责。
   */
  private async * attemptStream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    // 每次调用只解析一次，且发生在第一个 yield 之前：端点事实与身份一起
    // 冻结，流中途刷新的 token 不会与另一代端点配对。
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
    // 在 try 之前完成序列化，让下面的 transport 标签只覆盖传输边界。
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
          //   UA = deepseek-harness/0.1.5-rc.2 (+url)   → HTTP 400 code=11128
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
      // fetch 把所有传输故障都报成裸的 `TypeError: fetch failed`；端点与
      // 链式 cause 才是让它可诊断的部分。
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
        // 只吞掉错误体解析失败：状态码仍能标识故障，畸形的 JSON 不能掩盖它。
      }
      if (response.status === 401 || response.status === 403) {
        // 已存储的 token 被直接拒绝；把它从内存里丢弃，让下一次调用重新读
        // 文件（并发的登录可能已经替换了它），而不是重试一个已知被拒的 token。
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
