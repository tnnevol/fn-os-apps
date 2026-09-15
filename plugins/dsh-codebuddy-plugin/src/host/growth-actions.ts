/** 成长任务动作：先覆盖低风险、可幂等的行为上报动作。 */

import { createHash, randomUUID } from 'node:crypto'
import { CODEBUDDY_ENDPOINT } from '../contracts/constants.ts'
import type { CodeBuddyIdentity } from './codebuddy.ts'

const REPORT_ENDPOINT = 'https://www.codebuddy.cn/v2/report'
const REPORT_DELAY_MS = 1_050

function reportHeaders(identity: CodeBuddyIdentity): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${identity.accessToken}`,
    'X-Domain': identity.domain,
    'X-User-Id': identity.uid,
    ...(identity.enterpriseId === undefined ? {} : {
      'X-Enterprise-Id': identity.enterpriseId,
      'X-Tenant-Id': identity.enterpriseId,
    }),
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
  const response = await fetch(REPORT_ENDPOINT, {
    method: 'POST',
    headers: reportHeaders(identity),
    body: JSON.stringify([event]),
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

function stableId(identity: CodeBuddyIdentity, salt: string): string {
  return createHash('sha256').update(`${salt}:${identity.uid}`).digest('hex').slice(0, 36)
}

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
    machineId: stableId(identity, 'machine'),
    sessionId: stableId(identity, 'session'),
    extName: 'workbuddy-desktop',
    extVersion: '5.5.6',
    os: 'win32',
    arch: 'x64',
    timestamp: now,
    presentAt: now,
    eventCode,
    ...fields,
  }
}

async function reportEvents(
  identity: CodeBuddyIdentity,
  url: string,
  events: readonly GrowthEvent[],
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers },
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

async function reportDesktopEvents(identity: CodeBuddyIdentity, events: readonly GrowthEvent[], signal?: AbortSignal): Promise<void> {
  await reportEvents(identity, `${CODEBUDDY_ENDPOINT}/v2/report`, events.map(event => ({ ...desktopEvent(identity, String(event.eventCode ?? '')), ...event })), {
    Authorization: `Bearer ${identity.accessToken}`,
    'X-Domain': 'copilot.tencent.com',
    'X-Product': 'SaaS',
    'X-User-Id': identity.uid,
    'User-Agent': 'WorkBuddy/5.5.6 WorkBuddy/5.5.6 CLI/2.137.1',
    'X-Request-ID': stableId(identity, 'request'),
  }, signal)
}

function desktopChatEvents(conversationId: string, requestId: string, messageId: string, modelId = 'fast-model', modelName = 'fast-model'): GrowthEvent[] {
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
      isSuccessful: true,
      messageErrorCode: '',
      finishReason: 'stop',
      traceId: requestId,
      rootRequestId: requestId,
      parentConversationId: conversationId,
    },
    {
      eventCode: 'chat_message_status',
      messageId: `${messageId}-assistant`,
      status: 'success',
      traceId: requestId,
      rootRequestId: requestId,
      parentConversationId: conversationId,
    },
    {
      eventCode: 'chat_request_response',
      requestId,
      isSuccessful: true,
      traceId: requestId,
      rootRequestId: requestId,
      parentConversationId: conversationId,
    },
  ]
}

async function reportWebEvent(identity: CodeBuddyIdentity, eventCode: string, signal?: AbortSignal): Promise<void> {
  const pageURL = 'https://www.workbuddy.cn/profile/growth-center'
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36'
  await reportEvents(identity, 'https://www.workbuddy.cn/v2/report', [{
    eventCode,
    timestamp: Date.now(),
    reportDelay: 0,
    pageURL,
    elementId: 'library_doc_intro_click',
    elementName: 'library_doc_intro_click',
    os: 'Win32',
    arch: '',
    osVersion: '10.0',
    userAgent: ua,
    machineId: stableId(identity, 'webmachine'),
    userId: identity.uid,
    userNickname: identity.uid,
  }], {
    Authorization: `Bearer ${identity.accessToken}`,
    'x-client-platform': 'web',
    Origin: 'https://www.workbuddy.cn',
    Referer: pageURL,
    'User-Agent': ua,
    'X-User-Id': identity.uid,
  }, signal)
}

async function runShortChat(identity: CodeBuddyIdentity, signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${CODEBUDDY_ENDPOINT}/v2/chat/completions`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${identity.accessToken}`,
      'X-Domain': identity.domain,
      'X-User-Id': identity.uid,
      ...(identity.enterpriseId === undefined ? {} : { 'X-Enterprise-Id': identity.enterpriseId }),
    },
    body: JSON.stringify({
      model: 'glm-5.2',
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

async function listMarketExperts(identity: CodeBuddyIdentity, expertType: string, signal?: AbortSignal): Promise<MarketExpert[]> {
  const response = await fetch(`${CODEBUDDY_ENDPOINT}/portal/operation-platform/market/expert/list`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${identity.accessToken}`,
      'User-Agent': 'WorkBuddy/5.5.6 WorkBuddy/5.5.6 CLI/2.137.1',
      'X-Domain': 'copilot.tencent.com',
      'X-Product': 'SaaS',
      'X-User-Id': identity.uid,
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
      ...(expertId.length === 0 ? {} : { 'X-Expert-Id': expertId }),
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
    while (text.length < 1_000_000) {
      const chunk = await reader.read()
      if (chunk.done) break
      text += decoder.decode(chunk.value, { stream: true })
      requestId ??= text.match(/"id":"(cmb-[0-9a-f]{32}|[0-9a-f]{32})"/)?.[1]
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  if (requestId === undefined) throw new Error('expert chat SSE did not contain a server request id')
  return { conversationId, requestId }
}

function expertSummonEvents(expert: MarketExpert): GrowthEvent[] {
  return [
    { eventCode: 'web_element_click', source: expert.expertId, type: expert.category, version: expert.version, elementId: 'expert_summon_click', elementName: '立即召唤', pageURL: '/C:/Program%20Files/WorkBuddy/resources/app.asar/renderer/index.html' },
    { eventCode: 'expert_summon_click', id: expert.expertId, name: expert.displayNameZh, expertTitle: expert.professionZh, type: 'expert-all', position: 0, expertType: expert.expertType, version: expert.version, mode: 'LOCAL' },
    { eventCode: 'expert_summoned', id: expert.expertId, name: expert.displayNameZh, expertTitle: expert.professionZh, type: 'expert-all' },
  ]
}

async function runExpertBatch(identity: CodeBuddyIdentity, expertType: string, count: number, signal?: AbortSignal): Promise<string> {
  const experts = await listMarketExperts(identity, expertType, signal)
  if (experts.length === 0) throw new Error('expert market list is empty')
  let completed = 0
  for (const expert of experts.slice(0, count)) {
    await reportDesktopEvents(identity, expertSummonEvents(expert), signal)
    const real = await runExpertChat(identity, expert.expertId, signal)
    await reportDesktopEvents(identity, [
      ...desktopChatEvents(real.conversationId, real.requestId, `msg-${real.requestId.slice(-8)}`),
      { eventCode: 'expert_actual_use', id: expert.expertId, name: expert.displayNameZh, expertTitle: expert.professionZh, type: expert.category, expertType: expert.expertType, source: 'builtin', version: expert.version, cost: 9000, characterCount: 14, conversationId: real.conversationId, requestId: real.requestId, messageId: `msg-${real.requestId.slice(-8)}`, requestModelId: 'fast-model', requestModelName: 'fast-model' },
    ], signal)
    completed += 1
    if (completed < Math.min(count, experts.length)) await wait(6_000, signal)
  }
  return `completed ${completed} ${expertType} expert usage chain(s)`
}

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

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('aborted'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason ?? new Error('aborted'))
    }, { once: true })
  })
}

/** 执行一个已知的低风险成长任务动作；未知动作明确返回不可用。 */
export async function runGrowthTaskAction(
  identity: CodeBuddyIdentity,
  taskCode: string,
  current: number,
  target: number,
  signal?: AbortSignal,
): Promise<{ supported: boolean, message: string }> {
  switch (taskCode) {
    case 'chat_5': {
      const remaining = Math.max(0, Math.min(5, target - current))
      for (let index = 0; index < remaining; index += 1) {
        await report(identity, 'chat_request_send', signal)
        if (index + 1 < remaining) await wait(REPORT_DELAY_MS, signal)
      }
      return { supported: true, message: `reported ${remaining} chat activity event(s)` }
    }
    case 'first_buddy':
      await report(identity, 'chat_request_send', signal)
      await postGrowth(identity, '/activity/growth/buddy/agreement', { agree: true }, signal)
      await postGrowth(identity, '/activity/growth/buddy/first', {}, signal)
      return { supported: true, message: 'reported unlock and adopted the first Buddy' }
    case 'Model_chat_GLM5.2':
      await runShortChat(identity, signal)
      await wait(REPORT_DELAY_MS, signal)
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
      await reportWebEvent(identity, 'web_element_click', signal)
      return { supported: true, message: 'reported library reading event' }
    case 'template_5': {
      const events: GrowthEvent[] = []
      for (let index = 0; index < 5; index += 1) {
        const requestId = randomUUID()
        const conversationId = `dsh-growth-template-${requestId}`
        events.push(...desktopChatEvents(conversationId, requestId, `msg-template-${index}`, 'fast-model', 'fast-model'))
        events.push({
          eventCode: 'agent_task_created_with_template',
          mode: 'working',
          isCustomModel: false,
          id: `dsh-template-${index}`,
          name: 'DSH growth template',
          requestId,
        })
        events.push({ eventCode: 'template_used', template_id: `dsh-template-${index}`, task_mode: 'working' })
      }
      await reportDesktopEvents(identity, events, signal)
      return { supported: true, message: 'reported five template usage events' }
    }
    case 'playbook_prompt': {
      const requestId = randomUUID()
      const conversationId = `dsh-growth-playbook-${requestId}`
      await reportDesktopEvents(identity, [
        ...desktopChatEvents(conversationId, requestId, `msg-playbook-${requestId}`),
        { eventCode: 'web_element_click', pageName: 'playbook_detail', elementId: 'playbook_ctaClick', elementName: 'DSH growth playbook', source: 'discover' },
        { eventCode: 'playbook_cta_click', source: 'discover', position: 0, id: 'dsh-growth-playbook', name: 'DSH growth playbook', type: 'document' },
        { eventCode: 'playbook_prompt_send', conversationId, requestId, id: 'dsh-growth-playbook', name: 'DSH growth playbook', type: 'document' },
      ], signal)
      return { supported: true, message: 'reported playbook prompt activity' }
    }
    case 'create_canvas': {
      const requestId = randomUUID()
      const conversationId = `dsh-growth-canvas-${requestId}`
      await reportDesktopEvents(identity, [
        ...desktopChatEvents(conversationId, requestId, `msg-canvas-${requestId}`),
        { eventCode: 'wbx_design_canvas_task_create', conversationId, requestId, source: 'summon_keyword', cost: 12000, isSuccessful: true },
        { eventCode: 'wbx_design_canvas_open', conversationId, requestId, id: `ardot-file-${requestId.slice(-8)}`, source: 'summon_keyword', type: 'page', cost: 13000, isSuccessful: true },
      ], signal)
      return { supported: true, message: 'reported design canvas activity' }
    }
    case 'Hp_Appearance':
      await postGrowth(identity, '/v2/user-asset/appearance/set', { kind: 'theme', resource_key: 'theme-tkmw7j' }, signal)
      await wait(2_000, signal)
      await reportDesktopEvents(identity, [{ eventCode: 'appearance_skin_apply', action: 'apply', source: 'settings_close', id: 'theme-tkmw7j', vipLevel: 0, series: '', type: 'unknown' }], signal)
      return { supported: true, message: 'applied the growth theme and reported it' }
    case 'expert_5':
      return { supported: true, message: await runExpertBatch(identity, 'agent', 5, signal) }
    case 'Expert_team_use_3':
      return { supported: true, message: await runExpertBatch(identity, 'team', 3, signal) }
    case 'Expert_lighthouse':
      return { supported: true, message: await runExpertBatch(identity, 'agent', 1, signal) }
    case 'skill_1': {
      const requestId = randomUUID()
      const conversationId = `dsh-growth-skill-${requestId}`
      await runShortChat(identity, signal)
      await reportDesktopEvents(identity, [
        ...desktopChatEvents(conversationId, requestId, `msg-skill-${requestId}`),
        { eventCode: 'skill_info', id: '润泽小馆·日报撰写', skillId: 'skill_2097350077599879168', skillVersion: '1.0.0', toolStatus: 'success', fileCount: 56, source: 'workbuddy-desktop', conversationId, requestId, messageId: `msg-skill-${requestId}`, requestModelId: 'fast-model', requestModelName: 'fast-model', traceId: requestId },
      ], signal)
      return { supported: true, message: 'completed a chat and reported skill_info' }
    }
    case 'black_cat': {
      const hour = new Date().getHours()
      if (hour >= 8 && hour < 23) return { supported: true, message: '当前不在 23:00–08:00 计分窗口，稍后再试' }
      await runShortChat(identity, signal)
      await report(identity, 'chat_request_send', signal, 'glm-5.2', 'GLM-5.2')
      return { supported: true, message: 'completed night chat and reported it' }
    }
    default:
      return { supported: false, message: '该任务动作尚未移植，暂不自动执行' }
  }
}
