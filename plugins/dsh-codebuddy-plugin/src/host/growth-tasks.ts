/** CodeBuddy 成长任务上游接口：列表、报名与领奖。 */

import { CODEBUDDY_ENDPOINT } from '../contracts/constants.ts'
import type { CodeBuddyIdentity } from './codebuddy.ts'

const TASKS_BASE = `${CODEBUDDY_ENDPOINT}/v2/activity/growth/tasks`
const CLAIM_BASE = 'https://www.workbuddy.cn/activity/growth/tasks'

export interface GrowthTask {
  taskCode: string
  title?: string
  description?: string
  taskDesc?: string
  credit: number
  energy: number
  hasReward: boolean
  rewardBuddy: boolean
  taskType?: string
  tag?: string
  jumpUrl?: string
  locked: boolean
  target: number
  current: number
  acceptStatus?: string
  status?: string
  claimable: boolean
  claimed: boolean
  automatable: boolean
  automationReason?: string
}

export interface GrowthClaimResult {
  alreadyClaimed: boolean
  credit: number
  energy: number
}

const AUTOMATABLE_TASKS = new Set([
  'chat_5',
  'first_buddy',
  'Model_chat_GLM5.2',
  'RichMeow_Chat',
  'Buddy_App',
  'Buddy_App_QQ',
  'automation_1',
  'Library_read',
  'template_5',
  'playbook_prompt',
  'create_canvas',
  'expert_5',
  'Expert_team_use_3',
  'Hp_Appearance',
  'skill_1',
  'Expert_lighthouse',
  'black_cat',
])

function headers(identity: CodeBuddyIdentity): Record<string, string> {
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

async function requestJson(
  url: string,
  identity: CodeBuddyIdentity,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    ...init,
    headers: { ...headers(identity), ...(init.headers as Record<string, string> | undefined) },
    ...(signal === undefined ? {} : { signal }),
  })
  const text = await response.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error(`growth task response is not JSON (HTTP ${response.status})`)
  }
  if (body === null || typeof body !== 'object') {
    throw new Error(`growth task response is invalid (HTTP ${response.status})`)
  }
  const envelope = body as Record<string, unknown>
  if (!response.ok || (typeof envelope.code === 'number' && envelope.code !== 0)) {
    const message = typeof envelope.msg === 'string' ? envelope.msg : `HTTP ${response.status}`
    throw new Error(`growth task request failed: ${message}`)
  }
  return envelope
}

function number(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && Number.isFinite(Number(value))) return Number(value)
  return fallback
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function bool(value: unknown): boolean {
  return value === true
}

function mapTask(raw: Record<string, unknown>): GrowthTask {
  const progress = raw.progress !== null && typeof raw.progress === 'object'
    ? raw.progress as Record<string, unknown>
    : undefined
  const target = number(progress?.target ?? raw.target)
  const current = number(progress?.current ?? raw.current)
  const taskCode = string(raw.task_code) ?? ''
  const title = string(raw.title)
  const description = string(raw.description)
  const taskDesc = string(raw.task_desc)
  const taskType = string(raw.task_type)
  const tag = string(raw.tag)
  const jumpUrl = string(raw.jump_url)
  const acceptStatus = string(raw.accept_status)
  const status = string(raw.status)
  const claimed = acceptStatus === 'claimed'
  const claimable = !claimed && target > 0 && current >= target
  const automatable = AUTOMATABLE_TASKS.has(taskCode)
  return {
    taskCode,
    ...(title === undefined ? {} : { title }),
    ...(description === undefined ? {} : { description }),
    ...(taskDesc === undefined ? {} : { taskDesc }),
    credit: number(raw.reward_credit),
    energy: number(raw.reward_energy),
    hasReward: bool(raw.has_reward),
    rewardBuddy: bool(raw.reward_buddy),
    ...(taskType === undefined ? {} : { taskType }),
    ...(tag === undefined ? {} : { tag }),
    ...(jumpUrl === undefined ? {} : { jumpUrl }),
    locked: bool(raw.locked),
    target,
    current,
    ...(acceptStatus === undefined ? {} : { acceptStatus }),
    ...(status === undefined ? {} : { status }),
    claimable,
    claimed,
    automatable,
    ...(automatable ? {} : { automationReason: '该任务需要官方客户端或真实用户操作，暂不自动执行' }),
  }
}

/** 只读拉取当前身份的全部成长任务。 */
export async function listGrowthTasks(
  identity: CodeBuddyIdentity,
  signal?: AbortSignal,
): Promise<GrowthTask[]> {
  const envelope = await requestJson(TASKS_BASE, identity, { method: 'GET' }, signal)
  const data = envelope.data !== null && typeof envelope.data === 'object'
    ? envelope.data as Record<string, unknown>
    : envelope
  const tasks = Array.isArray(data.tasks) ? data.tasks : []
  return tasks
    .filter((task): task is Record<string, unknown> => task !== null && typeof task === 'object')
    .map(mapTask)
    .filter(task => task.taskCode.length > 0)
}

/** 报名尚未 accepted/completed 且未锁定的任务；失败由调用方决定是否继续。 */
export async function acceptGrowthTasks(
  identity: CodeBuddyIdentity,
  taskCodes: readonly string[],
  signal?: AbortSignal,
): Promise<void> {
  if (taskCodes.length === 0) return
  await requestJson(TASKS_BASE + '/accept', identity, {
    method: 'POST',
    body: JSON.stringify({ task_codes: taskCodes }),
  }, signal)
}

/** 领取单个已达标任务奖励；重复领取按成功处理。 */
export async function claimGrowthTask(
  identity: CodeBuddyIdentity,
  taskCode: string,
  signal?: AbortSignal,
): Promise<GrowthClaimResult> {
  const envelope = await requestJson(`${CLAIM_BASE}/${encodeURIComponent(taskCode)}/claim`, identity, {
    method: 'POST',
    headers: {
      Origin: 'https://www.workbuddy.cn',
      Referer: 'https://www.workbuddy.cn/profile/growth-center',
      'x-client-platform': 'web',
    },
  }, signal)
  const data = envelope.data !== null && typeof envelope.data === 'object'
    ? envelope.data as Record<string, unknown>
    : envelope
  return {
    alreadyClaimed: data.already_claimed === true,
    credit: number(data.credit),
    energy: number(data.energy),
  }
}

export function isAutomatableGrowthTask(task: GrowthTask): boolean {
  return task.automatable && !task.claimed && !task.locked
}
