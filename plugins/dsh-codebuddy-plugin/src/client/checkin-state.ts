export interface CheckinStateRow {
  enterprise?: boolean
  checkinOk?: boolean
  todayCheckedIn?: boolean
}

/**
 * 一键签到按钮的状态。
 *
 * 刻意把「进行中」拆成两种而不是合成一个 loading：
 *  - `executing`：本轮签到在跑 —— 只 loading（转圈）；
 *  - `probing`：签到状态还没探测出来 —— loading **且** disabled。
 *
 * 两者都要 loading（都是进行中），但只有 `probing` 同时需要 disabled：
 * 状态未知时提交会在「可能全部已签到」的情况下误触发全量请求。
 * 这正是「loading 与 disabled 共存、各表达一件事」的用法。
 */
export type CheckinButtonState = 'executing' | 'probing' | 'enabled' | 'unavailable'

/** 根据最近一次真实账号状态决定管理后台一键签到按钮。 */
export function checkinButtonState(rows: readonly CheckinStateRow[], busy: boolean): CheckinButtonState {
  if (rows.length === 0) return 'unavailable'
  if (busy) return 'executing'
  const candidates = rows.filter(row => row.enterprise !== true && row.checkinOk !== false)
  if (candidates.length === 0) return 'unavailable'
  if (candidates.some(row => row.todayCheckedIn === undefined)) return 'probing'
  return candidates.some(row => row.todayCheckedIn === false) ? 'enabled' : 'unavailable'
}
