

/** 一个旅行地点（来自 `travel/config`）。 */
export interface TravelLocation {
  id: number
  code: string
  name: string
  description?: string
  /** 最短/最长行程小时数。 */
  durationHoursMin?: number
  durationHoursMax?: number
  /** 奖励积分区间。 */
  rewardCreditMin?: number
  rewardCreditMax?: number
}
/** 旅行状态机的服务端状态。 */
export type TravelState = 'idle' | 'traveling' | 'arrived'
/** 一次旅行状态查询的结果。 */
export interface TravelStatus {
  ok: boolean
  /** 成长中心不可用（企业账号）。 */
  unsupported?: boolean
  /** 服务端状态；`ok` 为 false 时缺省。 */
  state?: TravelState
  /** 是否已有 Buddy；无 Buddy 时无法派发。 */
  buddyId: number
  recordId: number
  locationName?: string
  departAt: number
  arriveAt: number
  serverNow: number
  /** 当日次数已用完（官网「累了，明天再来吧」）。 */
  dailyLimitReached: boolean
  durationHours: number
  rewardCredit: number
  /** 服务端附带的一封信（到达后可能非空）。 */
  letter?: string
  error?: string
}
/** 派发/领取的通用结果。 */
export interface TravelActionResult {
  ok: boolean
  unsupported?: boolean
  /** 已经在旅行中（重复派发）。 */
  already?: boolean
  state?: TravelState
  rewardCredit?: number
  error?: string
}
