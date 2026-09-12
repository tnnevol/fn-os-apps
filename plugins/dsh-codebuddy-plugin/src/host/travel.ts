/**
 * 派猫猫旅行（CodeBuddy 成长中心）：状态查询、派发与奖励领取。
 *
 * 与 workbuddy-switch 的 `modules/travel.rs` 同一协议：
 * `GET /activity/growth/buddy/travel/{config,status}`、
 * `POST /activity/growth/buddy/travel/{depart,claim}`。
 *
 * 状态机以服务端 `data.state` 为准：
 * `idle --depart--> traveling --到点--> arrived --claim--> idle`。
 * `idle` 且 `daily_limit_reached` 是官网的「累了，明天再来吧」，即猫猫今日已旅行、
 * 当日不再派发。
 *
 * 两个来自参考项目的坑，这里都保留了处理：
 * - 企业账号不可用（`403 growth system is only available for personal users`），
 *   由调用方按 `enterprise` 跳过，本模块对 403 也返回明确的 unsupported 结果；
 * - 账号没有 Buddy 时派发报 `no active buddy`，这不是「今日完成」，
 *   必须可重试，否则账号后来有了 Buddy 也永远不会再派。
 *
 * @module dsh-codebuddy/travel
 */

import type { TravelLocation, TravelStatus, TravelActionResult } from '../types/host/travel'
export type { TravelLocation, TravelState, TravelStatus, TravelActionResult } from '../types/host/travel'
import type { CodeBuddyIdentity } from './codebuddy.ts'
import { CODEBUDDY_IDE_VERSION } from '../contracts/constants.ts'

/** 成长中心接口前缀。 */
const TRAVEL_API_PREFIX = '/activity/growth/buddy/travel'

/**
 * 成长中心要求的浏览器语境请求头。
 *
 * 与 meter 平面不同，这套接口校验 `origin`/`referer`/`x-client-platform`：
 * 缺失时被拒。缺省 referer 指向成长中心页，与官网一致。
 */
function travelHeaders(identity: CodeBuddyIdentity, endpoint: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': `CodeBuddyIDE/${CODEBUDDY_IDE_VERSION} CodeBuddy/${CODEBUDDY_IDE_VERSION}`,
    'Authorization': `Bearer ${identity.accessToken}`,
    'X-Domain': identity.domain,
    'X-User-Id': identity.uid,
    'x-client-platform': 'web',
    'origin': endpoint,
    'referer': `${endpoint}/profile/growth-center`,
  }
  if (identity.enterpriseId !== undefined) {
    headers['X-Enterprise-Id'] = identity.enterpriseId
    headers['X-Tenant-Id'] = identity.enterpriseId
  }
  if (identity.departmentFullName !== undefined) headers['X-Department-Info'] = identity.departmentFullName
  return headers
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** 一次成长中心请求：展平 `{code,msg,data}` 信封。 */
async function travelRequest(
  endpoint: string,
  path: string,
  identity: CodeBuddyIdentity,
  method: 'GET' | 'POST',
  body: string | undefined,
  signal?: AbortSignal,
): Promise<{ ok: boolean, unsupported: boolean, code: number, message: string, data: unknown }> {
  let response: Response
  try {
    response = await fetch(`${endpoint}${path}`, {
      method,
      headers: travelHeaders(identity, endpoint),
      ...body === undefined ? {} : { body },
      ...signal === undefined ? {} : { signal },
    })
  } catch (error) {
    return { ok: false, unsupported: false, code: -1, message: error instanceof Error ? error.message : String(error), data: undefined }
  }
  let raw: unknown
  try {
    raw = await response.json()
  } catch {
    return { ok: false, unsupported: false, code: response.status, message: `HTTP ${response.status}`, data: undefined }
  }
  const envelope = (raw ?? {}) as Record<string, unknown>
  const code = typeof envelope.code === 'number' ? envelope.code : response.status
  const message = text(envelope.msg) ?? text(envelope.message) ?? `${code}`
  // 403 + "only available for personal users" 是企业账号的确定拒绝，
  // 不是暂时性故障：调用方据此永久跳过该账号的成长中心玩法。
  const unsupported = response.status === 403
    || code === 403
    || message.toLowerCase().includes('only available for personal users')
  return {
    ok: (code === 0 || code === 200) && response.ok,
    unsupported,
    code,
    message,
    data: envelope.data,
  }
}

/** 读取可选的地点列表（派发时按顺序尝试）。 */
export async function fetchTravelLocations(
  endpoint: string,
  identity: CodeBuddyIdentity,
  signal?: AbortSignal,
): Promise<TravelLocation[]> {
  const resp = await travelRequest(endpoint, `${TRAVEL_API_PREFIX}/config`, identity, 'GET', undefined, signal)
  if (!resp.ok) return []
  const data = (resp.data ?? {}) as Record<string, unknown>
  const list = Array.isArray(data.locations) ? data.locations : []
  const out: TravelLocation[] = []
  for (const entry of list) {
    if (entry === null || typeof entry !== 'object') continue
    const item = entry as Record<string, unknown>
    const id = number(item.id)
    const name = text(item.name)
    if (id <= 0 || name === undefined) continue
    const description = text(item.description)
    out.push({
      id,
      code: text(item.code) ?? String(id),
      name,
      ...description === undefined ? {} : { description },
      ...number(item.duration_hours_min) > 0 ? { durationHoursMin: number(item.duration_hours_min) } : {},
      ...number(item.duration_hours_max) > 0 ? { durationHoursMax: number(item.duration_hours_max) } : {},
      ...number(item.reward_credit_min) > 0 ? { rewardCreditMin: number(item.reward_credit_min) } : {},
      ...number(item.reward_credit_max) > 0 ? { rewardCreditMax: number(item.reward_credit_max) } : {},
    })
  }
  return out
}

/** 查询一个账号的旅行状态。 */
export async function fetchTravelStatus(
  endpoint: string,
  identity: CodeBuddyIdentity,
  signal?: AbortSignal,
): Promise<TravelStatus> {
  const resp = await travelRequest(endpoint, `${TRAVEL_API_PREFIX}/status`, identity, 'GET', undefined, signal)
  if (!resp.ok) {
    return {
      ok: false,
      buddyId: 0,
      recordId: 0,
      departAt: 0,
      arriveAt: 0,
      serverNow: 0,
      dailyLimitReached: false,
      durationHours: 0,
      rewardCredit: 0,
      ...resp.unsupported ? { unsupported: true } : {},
      error: resp.message,
    }
  }
  const data = (resp.data ?? {}) as Record<string, unknown>
  const location = data.location !== null && typeof data.location === 'object'
    ? data.location as Record<string, unknown>
    : undefined
  const state = text(data.state)
  const locationName = text(location?.name)
  const letter = text(data.letter)
  return {
    ok: true,
    ...state === 'idle' || state === 'traveling' || state === 'arrived' ? { state } : {},
    buddyId: number(data.buddy_id),
    recordId: number(data.record_id),
    ...locationName === undefined ? {} : { locationName },
    departAt: number(data.depart_at),
    arriveAt: number(data.arrive_at),
    serverNow: number(data.server_now),
    dailyLimitReached: data.daily_limit_reached === true,
    durationHours: number(data.duration_hours),
    rewardCredit: number(data.reward_credit),
    ...letter === undefined ? {} : { letter },
  }
}

/** 派猫猫出门旅行（`depart`）。 */
export async function departTravel(
  endpoint: string,
  identity: CodeBuddyIdentity,
  locationId: number,
  signal?: AbortSignal,
): Promise<TravelActionResult> {
  const resp = await travelRequest(
    endpoint,
    `${TRAVEL_API_PREFIX}/depart`,
    identity,
    'POST',
    JSON.stringify({ location_id: locationId }),
    signal,
  )
  if (resp.ok) {
    const data = (resp.data ?? {}) as Record<string, unknown>
    const state = text(data.state)
    return {
      ok: true,
      ...state === 'idle' || state === 'traveling' || state === 'arrived' ? { state } : {},
    }
  }
  const message = resp.message
  // 已在旅行中不是失败：状态机的正常分支，下一轮会走到领取。
  const already = message.toLowerCase().includes('already traveling')
  return {
    ok: false,
    ...resp.unsupported ? { unsupported: true } : {},
    ...already ? { already: true, state: 'traveling' as const } : {},
    error: message,
  }
}

/** 领取到达后的旅行奖励（`claim`）。 */
export async function claimTravel(
  endpoint: string,
  identity: CodeBuddyIdentity,
  recordId: number,
  signal?: AbortSignal,
): Promise<TravelActionResult> {
  const resp = await travelRequest(
    endpoint,
    `${TRAVEL_API_PREFIX}/claim`,
    identity,
    'POST',
    JSON.stringify(recordId > 0 ? { record_id: recordId } : {}),
    signal,
  )
  if (resp.ok) {
    const data = (resp.data ?? {}) as Record<string, unknown>
    return { ok: true, rewardCredit: number(data.reward_credit) }
  }
  return {
    ok: false,
    ...resp.unsupported ? { unsupported: true } : {},
    error: resp.message,
  }
}
