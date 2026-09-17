/** 成长任务动作：覆盖可自动化的行为上报与真实对话链路。 */

import { randomUUID } from 'node:crypto'
import { CODEBUDDY_ENDPOINT } from '../contracts/constants.ts'
import type { CodeBuddyIdentity } from './codebuddy.ts'
import {
  accountRiskHeaders,
  growthThrottle,
  stableDeviceId,
  wait,
  DESKTOP_USER_AGENT,
  WEB_USER_AGENT,
} from './risk-headers.ts'

const REPORT_ENDPOINT = 'https://www.codebuddy.cn/v2/report'
const WEB_ENDPOINT = 'https://www.workbuddy.cn'

/**
 * 报告请求头：账号身份 + 账号级风控指纹。
 *
 * 这里刻意不掺入客户端身份（`X-IDE-*`）：行为上报的**判据**是事件本身，
 * 而客户端身份由各事件自带的桌面/web 指纹表达（见 {@link desktopEvent} 与
 * {@link reportWebEvent}）。混入会让「这是哪个端的行为」变得含糊。
 */
function reportHeaders(identity: CodeBuddyIdentity): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${identity.accessToken}`,
    'X-Domain': identity.domain,
    'X-User-Id': identity.uid,
    ...accountRiskHeaders(identity),
  }
}

/**
 * 发一条对话活跃上报（`chat_request_send`）。
 *
 * 供「领养前置」复用：该上报会**解锁 `first_buddy` 任务**，没有它时
 * `buddy/first` 会返回 400「门槛未达标」。
 *
 * @param identity - 已登录身份。
 * @param signal - 可选取消。
 */
export async function reportGrowthActivity(identity: CodeBuddyIdentity, signal?: AbortSignal): Promise<void> {
  await report(identity, 'chat_request_send', signal)
}

/**
 * 一条 `chat_request_send` 事件的完整形状。
 *
 * 用**全字段**而不是最小三字段（来源明确提醒：最小载荷能过一次，但上游后续
 * 加严就会静默失效）。`userId` 是必填——缺失时服务端 200 但静默丢弃该事件。
 */
async function report(
  identity: CodeBuddyIdentity,
  eventCode: string,
  signal?: AbortSignal,
  modelId = 'deepseek-v4-flash',
  modelName = 'DeepSeek V4 Flash',
): Promise<void> {
  const now = Date.now()
  const requestId = randomUUID()
  const event = {
    eventCode,
    timestamp: now,
    reportDelay: 0,
    mode: 'craft',
    conversationId: `dsh-growth-${requestId}`,
    requestId,
    inputLength: 12,
    requestModelId: modelId,
    requestModelName: modelName,
    isPlan: false,
    isAutoExecuteTerminal: false,
    isAutoModify: false,
    codebaseEnable: false,
    maxToken: 0,
    maxSteps: 0,
    temperature: 0,
    maxRetries: 0,
    mentionContexts: [],
    knowledgeId: [],
    knowledgeName: [],
    codebaseId: '',
    mentionContextCount: 0,
    command: '',
    expertId: '',
    recommendId: '',
    skillId: '',
    skillCount: 0,
    totalCount: 0,
    fileUri: '',
    presentAt: now,
    traceId: '',
    rootRequestId: requestId,
    parentConversationId: `dsh-growth-${requestId}`,
    agentName: 'default',
    agentType: 'conversation',
    userId: identity.uid,
  }
  await postReport(identity, REPORT_ENDPOINT, [event], signal)
}

/** 解析上报信封：非 2xx 或业务 code !== 0 都抛错。 */
async function postReport(
  identity: CodeBuddyIdentity,
  url: string,
  events: readonly Record<string, unknown>[],
  signal?: AbortSignal,
  headers: Record<string, string> = {},
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...reportHeaders(identity), ...headers },
    body: JSON.stringify(events),
    ...(signal === undefined ? {} : { signal }),
  })
  const text = await response.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error(`growth report response is not JSON (HTTP ${response.status})`)
  }
  if (!response.ok || body === null || typeof body !== 'object' || (typeof (body as { code?: unknown }).code === 'number' && (body as { code: number }).code !== 0)) {
    const message = body !== null && typeof body === 'object' && typeof (body as { msg?: unknown }).msg === 'string'
      ? (body as { msg: string }).msg
      : `HTTP ${response.status}`
    throw new Error(`growth report failed: ${message}`)
  }
}

type GrowthEvent = Record<string, unknown>

/**
 * 一条桌面端事件的公共指纹。
 *
 * 与 CLI 上报（billing 域的最小事件）不同，桌面链要**像桌面客户端**：
 * `ideName`/`ideType`/`extName` 三者共同决定上游把这条行为归到哪个端，
 * 缺一就会被判成「不是桌面端行为」而无法点亮「需电脑端」的任务。
 *
 * 设备标识按 uid 稳定派生（见 `risk-headers`），同一账号跨重启始终是同一台
 * 设备——上游按设备指纹漂移做关联风控，随机值会长期被判为异常。
 */
function desktopEvent(identity: CodeBuddyIdentity, eventCode: string, fields: GrowthEvent = {}): GrowthEvent {
  const now = Date.now()
  return {
    timezone: 'Asia/Shanghai',
    reportDelay: 2_000,
    userId: identity.uid,
    product: 'SaaS',
    ideName: 'WorkBuddy',
    ideType: 'WorkBuddy',
    ideVersion: '5.5.6',
    machineId: stableDeviceId(identity, 'machine'),
    sessionId: stableDeviceId(identity, 'session'),
    extName: 'workbuddy-desktop',
    extVersion: '5.5.6',
    os: 'win32',
    arch: 'x64',
    osVersion: '10.0.26220',
    cpuCores: 20,
    memorySize: 24,
    timestamp: now,
    presentAt: now,
    eventCode,
    ...fields,
  }
}

/**
 * 以桌面客户端指纹批量上报事件。
 *
 * 端点走 `copilot.tencent.com/v2/report`（chatBase），与 billing 域的
 * `codebuddy.cn/v2/report`（CLI 活跃上报）是**两条不同的通道**：同一个事件
 * 码发到错的域不会计数。
 */
async function reportDesktopEvents(identity: CodeBuddyIdentity, events: readonly GrowthEvent[], signal?: AbortSignal): Promise<void> {
  await postReport(
    identity,
    `${CODEBUDDY_ENDPOINT}/v2/report`,
    events.map(event => ({ ...desktopEvent(identity, String(event.eventCode ?? '')), ...event })),
    signal,
    {
      'X-Domain': 'copilot.tencent.com',
      'X-Product': 'SaaS',
      'User-Agent': DESKTOP_USER_AGENT,
      'X-Request-ID': `${stableDeviceId(identity, 'request')}${Date.now() % 1_000_000}`,
    },
  )
}

/**
 * 构造一次「桌面端成功对话」的完整事件链。
 *
 * 判据不是「有一条 chat 事件」而是**一条自洽的对话链**：任务创建 → 用户
 * 发消息 → 发起请求 → 收到成功回执 → 状态成功 → 请求成功。来源实测这一链
 * 能点亮 `RichMeow_Chat`；只发其中一两条则不计分。
 *
 * 字段用完整集合（含能力标志组与 token 计数）：上游对这些字段有一致性倾向
 * 校验，缺失字段的链会被判成不完整。
 */
function desktopChatEvents(conversationId: string, requestId: string, messageId: string, modelId = 'fast-model', modelName = 'fast-model'): GrowthEvent[] {
  const now = Date.now()
  return [
    {
      eventCode: 'agent_task_created',
      source: 'LOCAL',
      name: 'working',
      task_target: 'local',
      mode: 'craft',
      requestModelId: modelId,
      requestModelName: modelName,
      has_repo: false,
      repo_type: 'none',
      workspace_type: 'empty',
      has_connector: false,
      connector_types: [],
      has_mention: false,
      mention_types: [],
      has_template: false,
      action: '',
      template_name: '',
      has_expert: false,
      expert_id: '',
      expert_name: '',
      expert_industry_id: '',
      has_skill: false,
      skill_names: [],
      conversationId,
      messageId,
      buddyId: '',
      buddyName: '',
    },
    {
      eventCode: 'chat_message_send',
      messageId: `${messageId}-assistant`,
      historyCount: 0,
      isContextTruncated: false,
      currentStepCount: 1,
      traceId: requestId,
      rootRequestId: requestId,
      parentConversationId: conversationId,
      agentName: 'cli',
      agentType: 'main',
    },
    {
      eventCode: 'chat_request_send',
      inputLength: 24,
      isPlan: false,
      isAutoExecuteTerminal: false,
      isAutoModify: false,
      codebaseEnable: false,
      maxToken: 0,
      maxSteps: 500,
      temperature: 0,
      maxRetries: 0,
      mentionContexts: [],
      knowledgeId: [],
      knowledgeName: [],
      codebaseId: '',
      mentionContextCount: 0,
      command: '',
      recommendId: '',
      skillId: '',
      skillCount: 0,
      totalCount: 0,
      traceId: requestId,
      rootRequestId: requestId,
      parentConversationId: conversationId,
      agentName: 'cli',
      agentType: 'main',
      requestModelId: modelId,
      requestModelName: modelName,
      'codebuddy.session_id': conversationId,
      'codebuddy.conversation_request_id': requestId,
    },
    {
      eventCode: 'chat_message_response',
      messageId: `${messageId}-assistant`,
      responseModelId: modelId,
      inputToken: 120,
      outputToken: 80,
      totalToken: 200,
      cachedTokens: 0,
      cachedWriteTokens: 0,
      cachedMissTokens: 0,
      isSuccessful: true,
      messageErrorCode: '',
      finishReason: 'stop',
      firstTokenAt: now,
      traceId: requestId,
      conversationId,
      rootRequestId: requestId,
      parentConversationId: conversationId,
      agentName: 'cli',
      agentType: 'main',
      'codebuddy.session_id': conversationId,
      'codebuddy.conversation_request_id': requestId,
    },
    {
      eventCode: 'chat_message_status',
      messageId: `${messageId}-assistant`,
      messageErrorCode: '0',
      traceId: requestId,
      rootRequestId: requestId,
      parentConversationId: conversationId,
      agentName: 'cli',
      agentType: 'main',
    },
    {
      eventCode: 'chat_request_response',
      mode: 'craft',
      toolCallCount: 0,
      inputToken: 120,
      outputToken: 80,
      totalToken: 200,
      cachedTokens: 0,
      cachedWriteTokens: 0,
      cachedMissTokens: 0,
      isSuccessful: true,
      messageErrorCode: '',
      finishReason: 'stop',
      rootRequestId: requestId,
      parentConversationId: conversationId,
    },
  ]
}

/**
 * 以 web 端指纹向 `workbuddy.cn/v2/report` 上报单条页面行为事件。
 *
 * `Library_read` 这类任务认的是**浏览器**指纹（`pageURL` + `elementId` +
 * 浏览器 UA），与桌面链是不同判据；用桌面指纹发同一个事件码不会点亮。
 *
 * @param identity - 账号身份。
 * @param eventCode - 事件码。
 * @param pageURL - 事件发生的页面地址，是判据的一部分。
 * @param elementID - 被点击元素 id，是判据的一部分。
 * @param elementName - 元素展示名。
 * @param signal - 可选取消。
 */
async function reportWebEvent(
  identity: CodeBuddyIdentity,
  eventCode: string,
  pageURL: string,
  elementID: string,
  elementName: string,
  signal?: AbortSignal,
): Promise<void> {
  const event = {
    eventCode,
    timestamp: Date.now(),
    reportDelay: 0,
    pageURL,
    elementId: elementID,
    elementName,
    os: 'Win32',
    arch: '',
    osVersion: '10.0',
    userAgent: WEB_USER_AGENT,
    machineId: stableDeviceId(identity, 'webmachine'),
    userId: identity.uid,
    ...identity.enterpriseId === undefined ? {} : { enterpriseId: identity.enterpriseId },
  }
  await postReport(identity, `${WEB_ENDPOINT}/v2/report`, [event], signal, {
    'x-client-platform': 'web',
    Origin: WEB_ENDPOINT,
    Referer: pageURL,
    'User-Agent': WEB_USER_AGENT,
  })
}

/** 一次真实流式对话；读干流避免残留连接。 */
async function runShortChat(identity: CodeBuddyIdentity, model = 'glm-5.2', signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${CODEBUDDY_ENDPOINT}/v2/chat/completions`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${identity.accessToken}`,
      'X-Domain': identity.domain,
      'X-User-Id': identity.uid,
      ...identity.enterpriseId === undefined ? {} : { 'X-Enterprise-Id': identity.enterpriseId },
      ...accountRiskHeaders(identity),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'hi，请回复一句话' }],
      stream: true,
    }),
    ...(signal === undefined ? {} : { signal }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`growth chat failed (HTTP ${response.status}): ${text.slice(0, 160)}`)
  }
  if (response.body === null) {
    await response.text()
    return
  }
  const reader = response.body.getReader()
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
}

interface MarketExpert {
  expertId: string
  expertType: string
  displayNameZh: string
  professionZh: string
  version: string
  category: string
}

/**
 * 拉取专家市场的真实专家列表。
 *
 * `expert_actual_use` 的判据要求 `id` **真实存在**于平台——自造 id 不计数。
 * `expertType` 区分单个专家（`agent`）与专家团（`team`）。
 */
async function listMarketExperts(identity: CodeBuddyIdentity, expertType: string, signal?: AbortSignal): Promise<MarketExpert[]> {
  const response = await fetch(`${CODEBUDDY_ENDPOINT}/portal/operation-platform/market/expert/list`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${identity.accessToken}`,
      'User-Agent': DESKTOP_USER_AGENT,
      'X-Domain': 'copilot.tencent.com',
      'X-Product': 'SaaS',
      'X-User-Id': identity.uid,
      ...accountRiskHeaders(identity),
    },
    body: JSON.stringify({ page: 1, page_size: 20, sort_by: 'reco_rank', sort_order: 'desc', expert_type: expertType }),
    ...(signal === undefined ? {} : { signal }),
  })
  const envelope = await response.json() as { code?: unknown, msg?: unknown, data?: { experts?: unknown } }
  if (!response.ok || envelope.code !== 0) throw new Error(`expert list failed: ${String(envelope.msg ?? response.status)}`)
  const experts = envelope.data?.experts
  if (!Array.isArray(experts)) return []
  return experts.flatMap((raw): MarketExpert[] => {
    if (raw === null || typeof raw !== 'object') return []
    const item = raw as Record<string, unknown>
    const expertId = typeof item.expert_id === 'string' ? item.expert_id : ''
    if (expertId.length === 0) return []
    return [{
      expertId,
      expertType: typeof item.expert_type === 'string' ? item.expert_type : expertType,
      displayNameZh: typeof item.display_name_zh === 'string' ? item.display_name_zh : expertId,
      professionZh: typeof item.profession_zh === 'string' ? item.profession_zh : expertId,
      version: typeof item.version === 'string' && item.version.length > 0 ? item.version : '1.0.0',
      category: Array.isArray(item.categories) && typeof item.categories[0] === 'string' ? item.categories[0] : 'expert-all',
    }]
  })
}

/**
 * 服务端对话 id 的形状。
 *
 * `expert_actual_use` 的 `requestId` 必须是**服务端真实签发**的对话 id
 * （`cmb-` 前缀 32 hex，或裸 32 hex）。来源实测：自造 requestId 的事件上报
 * 返回 200，但任务进度不动——这正是「跑完了但没完成」的一个典型成因。
 */
const SERVER_REQUEST_ID = /^(?:cmb-)?[0-9a-f]{32}$/

/**
 * 一次带专家上下文的真实对话，返回服务端签发的 `requestId`。
 *
 * 没有这一步，`expert_actual_use` 就没有可引用的真实 id；因此拿不到 id 时
 * 必须**报错**（由调用方计入失败），而不是用一个随机值冒充。
 */
async function runExpertChat(identity: CodeBuddyIdentity, expertId: string, signal?: AbortSignal): Promise<{ conversationId: string, requestId: string }> {
  const conversationId = `dsh-growth-expert-${randomUUID()}`
  const response = await fetch(`${CODEBUDDY_ENDPOINT}/v2/chat/completions`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${identity.accessToken}`,
      'X-Domain': 'copilot.tencent.com',
      'X-Product': 'SaaS',
      'X-User-Id': identity.uid,
      'X-Conversation-ID': conversationId,
      'X-Request-ID': `${Date.now()}-${randomUUID()}`,
      'X-Agent-Intent': 'craft',
      'X-Agent-Type': 'main',
      'X-IDE-Name': 'WorkBuddy',
      'X-IDE-Type': 'WorkBuddy',
      'X-IDE-Version': '5.5.6',
      'x-codebuddy-request': '1',
      'User-Agent': DESKTOP_USER_AGENT,
      ...(expertId.length === 0 ? {} : { 'X-Expert-Id': expertId }),
      ...accountRiskHeaders(identity),
    },
    body: JSON.stringify({
      model: 'fast-model',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. 当前处于中文环境，使用简体中文回答。' },
        { role: 'user', content: '1+1等于几？直接回答。' },
      ],
      agent: 'cli',
      temperature: 1,
      stream: true,
      stream_options: { include_usage: true },
    }),
    ...(signal === undefined ? {} : { signal }),
  })
  if (!response.ok || response.body === null) {
    const text = await response.text()
    throw new Error(`expert chat failed (HTTP ${response.status}): ${text.slice(0, 160)}`)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let requestId: string | undefined
  try {
    // 1MB 上限：SSE 流里第一条形如 `"id":"cmb-…"` 的载荷就是服务端对话 id，
    // 但它可能出现在若干行之后；设一个上界避免异常长流把内存吃满。
    while (text.length < 1_000_000) {
      const chunk = await reader.read()
      if (chunk.done) break
      text += decoder.decode(chunk.value, { stream: true })
      const match = /"id":"((?:cmb-)?[0-9a-f]{32})"/.exec(text)
      if (match?.[1] !== undefined && SERVER_REQUEST_ID.test(match[1])) {
        requestId = match[1]
        break
      }
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  if (requestId === undefined) throw new Error('expert chat SSE did not contain a server request id')
  return { conversationId, requestId }
}

/** 专家分类：真实样本里 `type` 取该专家的一级分类，缺省为 `expert-all`。 */
function expertCategory(expert: MarketExpert): string {
  return expert.category.length > 0 ? expert.category : 'expert-all'
}

/** 「召唤专家」三连事件（web 点击 → 召唤 → 已召唤）。 */
function expertSummonEvents(expert: MarketExpert): GrowthEvent[] {
  return [
    { eventCode: 'web_element_click', source: expert.expertId, type: expertCategory(expert), version: expert.version, elementId: 'expert_summon_click', elementName: '立即召唤', pageURL: '/C:/Program%20Files/WorkBuddy/resources/app.asar/renderer/index.html' },
    { eventCode: 'expert_summon_click', id: expert.expertId, name: expert.displayNameZh, expertTitle: expert.professionZh, type: 'expert-all', position: 0, expertType: expert.expertType, version: expert.version, mode: 'LOCAL' },
    { eventCode: 'expert_summoned', id: expert.expertId, name: expert.displayNameZh, expertTitle: expert.professionZh, type: 'expert-all' },
  ]
}

/** `expert_actual_use` 公共载荷；`mode` 与 `type`/`cost` 由具体任务覆盖。 */
function expertActualUseEvent(expert: MarketExpert, conversationId: string, requestId: string): GrowthEvent {
  return {
    eventCode: 'expert_actual_use',
    id: expert.expertId,
    name: expert.displayNameZh,
    expertTitle: expert.professionZh,
    type: expertCategory(expert),
    expertType: expert.expertType,
    source: 'builtin',
    version: expert.version,
    cost: 9_000,
    characterCount: 14,
    conversationId,
    requestId,
    messageId: `msg-${requestId.slice(-8)}`,
    requestModelId: 'fast-model',
    requestModelName: 'fast-model',
  }
}

/**
 * 专家「召唤 + 真实使用」批处理。
 *
 * 每个专家的完整链路是：召唤三连 → 真实对话拿服务端 `requestId` → 对话链 +
 * `expert_actual_use`（JOIN 该 `requestId`）。任何一步失败都只计入失败数并
 * 继续下一个，不让一个专家把整条任务打断。
 *
 * 组间按来源实测口径留 {@link EXPERT_SUMMON_GAP_MS}：连续召唤会被判为异常流量。
 *
 * @param expertType - `agent`（单个专家）或 `team`（专家团）。
 * @param count - 需要完成的个数。
 * @param options.expertId - 指定专家 id（`Expert_lighthouse` 需要固定那位专家）。
 * @param options.localMode - 是否用 `LOCAL` 判据形态（`Expert_lighthouse`）。
 */
async function runExpertBatch(
  identity: CodeBuddyIdentity,
  expertType: string,
  count: number,
  signal?: AbortSignal,
  options: { expertId?: string, localMode?: boolean } = {},
): Promise<string> {
  const experts = await listMarketExperts(identity, expertType, signal)
  if (experts.length === 0) throw new Error('expert market list is empty')
  // 指定专家时以市场返回的真实条目为准（version/category 取服务端值）；市场里
  // 没有该专家则回落到内置事实，仍按真实 id 发送。
  const target = options.expertId === undefined
    ? experts
    : [experts.find(expert => expert.expertId === options.expertId) ?? {
        expertId: options.expertId,
        expertType,
        displayNameZh: options.expertId,
        professionZh: options.expertId,
        version: '1.0.2',
        category: 'expert-all',
      }]
  let completed = 0
  let failed = 0
  let lastError: string | undefined
  for (let index = 0; index < target.length; index += 1) {
    if (completed >= count) break
    const expert = target[index] as MarketExpert
    try {
      await reportDesktopEvents(identity, expertSummonEvents(expert), signal)
      const real = await runExpertChat(identity, expert.expertId, signal)
      const useEvent = expertActualUseEvent(expert, real.conversationId, real.requestId)
      if (options.localMode === true) {
        // 真实样本（轻量云专家）：mode=LOCAL、type 为空、cost=0。
        useEvent.mode = 'LOCAL'
        useEvent.type = ''
        useEvent.cost = 0
      } else {
        useEvent.mode = 'craft'
      }
      await reportDesktopEvents(identity, [
        ...desktopChatEvents(real.conversationId, real.requestId, `msg-${real.requestId.slice(-8)}`),
        useEvent,
      ], signal)
      completed += 1
    } catch (error) {
      // 单个专家失败不打断整条任务：继续尝试下一个，最后如实汇报成功数。
      failed += 1
      lastError = error instanceof Error ? error.message : String(error)
    }
    // 只在「确实还会再试下一个专家」时限速：最后一个尝试之后（或已达目标数）
    // 再等 6s 只会白白拖慢结果返回，失败时尤其明显。
    if (completed < count && index < target.length - 1) await wait(growthThrottle.expertSummonGapMs, signal)
  }
  if (completed === 0 && lastError !== undefined) throw new Error(`expert usage chain failed: ${lastError}`)
  return failed === 0
    ? `completed ${completed}/${count} ${expertType} expert usage chain(s)`
    : `completed ${completed}/${count} ${expertType} expert usage chain(s)（${failed} 个失败）`
}

/** growth 域动作（非上报）请求：解信封并抛错。 */
async function postGrowth(identity: CodeBuddyIdentity, path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${CODEBUDDY_ENDPOINT}${path}`, {
    method: 'POST',
    headers: reportHeaders(identity),
    body: JSON.stringify(body),
    ...(signal === undefined ? {} : { signal }),
  })
  if (!response.ok) throw new Error(`growth action failed (HTTP ${response.status})`)
  const text = await response.text()
  try {
    const envelope = JSON.parse(text) as { code?: unknown, msg?: unknown }
    if (typeof envelope.code === 'number' && envelope.code !== 0) {
      throw new Error(typeof envelope.msg === 'string' ? envelope.msg : `code ${envelope.code}`)
    }
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('growth action response is not JSON')
    throw error
  }
}

/** 夜猫子计数窗口：23:00–08:00（本地时区）。 */
function inNightWindow(now: Date): boolean {
  const hour = now.getHours()
  return hour >= 23 || hour < 8
}

/**
 * 执行一个已知的成长任务动作。
 *
 * 返回 `supported: false` 表示动作尚未移植，调用方据此记为 `unsupported`
 * 而不是「已完成」——把不可执行的任务汇报成完成，正是「跑完了但没跑完」
 * 的另一半成因。
 *
 * @param identity - 已登录身份。
 * @param taskCode - 任务 code。
 * @param current - 当前进度（用于补足差额的任务）。
 * @param target - 目标进度。
 * @param signal - 可选取消。
 */
export async function runGrowthTaskAction(
  identity: CodeBuddyIdentity,
  taskCode: string,
  current: number,
  target: number,
  signal?: AbortSignal,
): Promise<{ supported: boolean, message: string }> {
  switch (taskCode) {
    case 'chat_5': {
      // 差额补足：`target` 缺省为 5（上游偶尔不返回 target）。逐条按来源的
      // 1.05s 间隔发送，一次性连发不计分。
      const goal = target > 0 ? target : 5
      const remaining = Math.max(0, goal - current)
      for (let index = 0; index < remaining; index += 1) {
        await report(identity, 'chat_request_send', signal)
        if (index + 1 < remaining) await wait(growthThrottle.reportGapMs, signal)
      }
      return { supported: true, message: `reported ${remaining} chat activity event(s)` }
    }
    case 'first_buddy':
      // 前置上报解锁（`buddy/first` 要求当日活跃）→ 间隔 → 同意协议 → 领养。
      await report(identity, 'chat_request_send', signal)
      await wait(growthThrottle.reportGapMs, signal)
      await postGrowth(identity, '/activity/growth/buddy/agreement', { agree: true }, signal)
      await postGrowth(identity, '/activity/growth/buddy/first', {}, signal)
      return { supported: true, message: 'reported unlock and adopted the first Buddy' }
    case 'Model_chat_GLM5.2':
      // 真实对话（判据最直接的证据）→ 间隔 → 对齐模型的上报。
      await runShortChat(identity, 'glm-5.2', signal)
      await wait(growthThrottle.reportGapMs, signal)
      await report(identity, 'chat_request_send', signal, 'glm-5.2', 'GLM-5.2')
      return { supported: true, message: 'completed a GLM-5.2 chat and reported it' }
    case 'RichMeow_Chat': {
      const requestId = randomUUID()
      await reportDesktopEvents(identity, desktopChatEvents(`dsh-growth-${requestId}`, requestId, `msg-${requestId}`), signal)
      return { supported: true, message: 'reported desktop chat activity' }
    }
    case 'automation_1':
      await reportDesktopEvents(identity, [{ eventCode: 'automated_task_create_suc', name: 'DSH growth task', source: 'manually', modelId: 'fast-model', modelIsThinking: true, connectorCount: 0, skills: '', skillCount: 0, scheduleType: 'once', mode: 'LOCAL' }], signal)
      return { supported: true, message: 'reported scheduled task creation' }
    case 'Buddy_App':
    case 'Buddy_App_QQ': {
      // 企鹅教师助手是 `Buddy_App_QQ` 的判据应用，同时满足 `Buddy_App`
      // 「进入任一应用」；两组任务共用同一条事件链（幂等由任务状态兜底）。
      const buddyId = 'cb_y5Dy46tPQGGWtueMxXbe'
      const buddyName = '企鹅教师助手'
      const events = [
        { eventCode: 'buddyapp_discover_click', mode: 'LOCAL', buddyId, buddyName },
        { eventCode: 'buddyapp_show', mode: 'LOCAL', buddyId, buddyName, elementId: buddyId, elementName: buddyName, position: 2 },
        { eventCode: 'buddyapp_enter_click', mode: 'LOCAL', buddyId, buddyName, elementId: buddyId, elementName: buddyName, position: 2, isFirstPage: '1' },
        { eventCode: 'buddyapp_auth_confirm_click', mode: 'LOCAL', buddyId, buddyName, elementId: buddyId, elementName: buddyName },
        { eventCode: 'buddyapp_bindaccount_skip_click', mode: 'LOCAL', buddyId, buddyName, elementId: buddyId, elementName: buddyName },
      ]
      await reportDesktopEvents(identity, events, signal)
      return { supported: true, message: 'reported Buddy app events' }
    }
    case 'Library_read':
      // 判据是 web 域上的「资料库介绍」点击：页面地址与元素 id 都是判据的一部分。
      await reportWebEvent(
        identity,
        'web_element_click',
        'https://www.workbuddy.cn/space/d/o0KWYeynteVv06UnAZqIFm',
        'library_doc_intro_click',
        'WorkBuddy资料库介绍',
        signal,
      )
      return { supported: true, message: 'reported library reading event' }
    case 'template_5': {
      // 五组**各自独立**的模板使用链，组间 300ms：一次性把五组成一包发出去
      // 不会被数成 5/5。
      const templates = [
        { id: '1', name: '深度研究' },
        { id: '2', name: '周报生成' },
        { id: '3', name: '竞品分析' },
        { id: '4', name: '活动策划' },
        { id: '5', name: '代码评审' },
      ]
      const goal = target > 0 ? target : templates.length
      const remaining = Math.max(0, Math.min(templates.length, goal - current))
      for (let index = 0; index < remaining; index += 1) {
        const template = templates[index] as { id: string, name: string }
        const requestId = randomUUID()
        const conversationId = `dsh-growth-template-${requestId}`
        await reportDesktopEvents(identity, [
          ...desktopChatEvents(conversationId, requestId, `msg-template-${template.id}`),
          {
            eventCode: 'agent_task_created_with_template',
            mode: 'working',
            isCustomModel: false,
            id: template.id,
            name: template.name,
            requestId,
          },
          { eventCode: 'template_used', template_id: template.id, task_mode: 'working' },
        ], signal)
        if (index + 1 < remaining) await wait(growthThrottle.templateGapMs, signal)
      }
      return { supported: true, message: `reported ${remaining} template usage event(s)` }
    }
    case 'playbook_prompt': {
      const requestId = randomUUID()
      const conversationId = `dsh-growth-playbook-${requestId}`
      const caseId = 'pm-gtm-launch-plan'
      const caseName = '新产品上市 GTM 发布计划一页纸'
      await reportDesktopEvents(identity, [
        ...desktopChatEvents(conversationId, requestId, `msg-playbook-${requestId}`),
        { eventCode: 'web_element_click', pageName: 'playbook_detail', elementId: 'playbook_ctaClick', elementName: caseName, source: 'discover' },
        { eventCode: 'playbook_cta_click', source: 'discover', position: 0, id: caseId, name: caseName, type: 'document', categoryId: '', categoryName: '' },
        { eventCode: 'playbook_prompt_send', conversationId, requestId, id: caseId, name: caseName, type: 'document', categoryId: '', categoryName: '' },
      ], signal)
      return { supported: true, message: 'reported playbook prompt activity' }
    }
    case 'create_canvas': {
      const requestId = randomUUID()
      const conversationId = `dsh-growth-canvas-${requestId}`
      await reportDesktopEvents(identity, [
        ...desktopChatEvents(conversationId, requestId, 'msg-canvas'),
        { eventCode: 'wbx_design_canvas_task_create', conversationId, requestId, source: 'summon_keyword', cost: 12_000, isSuccessful: true },
        { eventCode: 'wbx_design_canvas_open', conversationId, requestId, id: `ardot-file-${requestId.slice(-8)}`, source: 'summon_keyword', type: 'page', cost: 13_000, isSuccessful: true },
      ], signal)
      return { supported: true, message: 'reported design canvas activity' }
    }
    case 'Hp_Appearance':
      // 判据是「主题生效」事件（客户端切主题后离开设置页时上报）：
      // 只调 set 不留痕不计分，因此两者都要发。
      await postGrowth(identity, '/v2/user-asset/appearance/set', { kind: 'theme', resource_key: 'theme-tkmw7j' }, signal)
      await wait(2_000, signal)
      await reportDesktopEvents(identity, [{ eventCode: 'appearance_skin_apply', action: 'apply', source: 'settings_close', id: 'theme-tkmw7j', vipLevel: 0, series: '', type: 'unknown' }], signal)
      return { supported: true, message: 'applied the growth theme and reported it' }
    case 'expert_5':
      return { supported: true, message: await runExpertBatch(identity, 'agent', 5, signal) }
    case 'Expert_team_use_3':
      return { supported: true, message: await runExpertBatch(identity, 'team', 3, signal) }
    case 'Expert_lighthouse':
      // 判据与 expert_5 同构，但固定「腾讯轻量云专家」且用 LOCAL 形态：
      // 之前按「取专家市场第一个」执行，id 不对因此从不计数。
      return {
        supported: true,
        message: await runExpertBatch(identity, 'agent', 1, signal, {
          expertId: 'ex_2cvvUZQhDyeJ',
          localMode: true,
        }),
      }
    case 'skill_1': {
      const requestId = randomUUID()
      const conversationId = `dsh-growth-skill-${requestId}`
      // 真实对话 + `skill_info`：判据是技能被真实加载，因此对话链的
      // `chat_message_response.finishReason` 必须是 `tool_calls`（模型发起了
      // 工具调用），`stop` 会被判成普通对话而不计此任务。
      await runShortChat(identity, 'glm-5.2', signal)
      await reportDesktopEvents(identity, [
        ...desktopChatEvents(conversationId, requestId, `msg-skill-${requestId}`).map(event =>
          event.eventCode === 'chat_message_response' ? { ...event, finishReason: 'tool_calls' } : event),
        { eventCode: 'skill_info', id: '润泽小馆·日报撰写', skillId: 'skill_2097350077599879168', skillVersion: '1.0.0', toolStatus: 'success', fileCount: 56, source: 'workbuddy-desktop', conversationId, requestId, messageId: `msg-skill-${requestId}`, requestModelId: 'fast-model', requestModelName: 'fast-model', traceId: requestId },
      ], signal)
      return { supported: true, message: 'completed a chat and reported skill_info' }
    }
    case 'black_cat': {
      if (!inNightWindow(new Date())) return { supported: true, message: '当前不在 23:00–08:00 计分窗口，稍后再试' }
      const goal = target > 0 ? target : 1
      const remaining = Math.max(0, goal - current)
      for (let index = 0; index < remaining; index += 1) {
        await runShortChat(identity, 'glm-5.2', signal)
        await report(identity, 'chat_request_send', signal, 'glm-5.2', 'GLM-5.2')
        if (index + 1 < remaining) await wait(growthThrottle.reportGapMs, signal)
      }
      return { supported: true, message: `completed ${remaining} night chat(s) and reported them` }
    }
    default:
      return { supported: false, message: '该任务动作尚未移植，暂不自动执行' }
  }
}

/** 供测试断言：`X-Machine-ID` 的派生盐前缀。 */
export const RISK_ID_PREFIX = 'dsh-growth:'
/** 供测试断言：对话链的服务端 id 形状校验。 */
export { SERVER_REQUEST_ID }
