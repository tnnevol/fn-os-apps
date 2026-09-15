import { describe, expect, it } from 'vitest'
import { checkinButtonState } from '../src/client/checkin-state.ts'

/**
 * 一键签到按钮状态。
 *
 * 这里把「进行中」拆成 `executing` 与 `probing` 两种，是因为 loading 与 disabled
 * 要**共存**、各表达一件事：两者都需要 loading（都是进行中），但只有 `probing`
 * 同时需要 disabled（状态未知时提交会在「可能全部已签到」的情况下误触发全量请求）。
 */
describe('管理后台一键签到按钮状态', () => {
  it('无账号时不可用；执行中只是 executing', () => {
    expect(checkinButtonState([], false)).toBe('unavailable')
    expect(checkinButtonState([{ checkinOk: true, todayCheckedIn: false }], true)).toBe('executing')
  })

  it('状态尚未探测完成时是 probing（加载中且不可提交）', () => {
    expect(checkinButtonState([{ checkinOk: true }], false)).toBe('probing')
  })

  it('存在未签到账号时激活', () => {
    expect(checkinButtonState([
      { checkinOk: true, todayCheckedIn: true },
      { checkinOk: true, todayCheckedIn: false },
    ], false)).toBe('enabled')
  })

  it('全部已签到或只有企业账号时不可用', () => {
    expect(checkinButtonState([{ checkinOk: true, todayCheckedIn: true }], false)).toBe('unavailable')
    expect(checkinButtonState([{ enterprise: true, checkinOk: false }], false)).toBe('unavailable')
  })

  it('执行中优先于探测中：busy 时即使状态缺失也是 executing', () => {
    expect(checkinButtonState([{ checkinOk: true }], true)).toBe('executing')
  })
})
