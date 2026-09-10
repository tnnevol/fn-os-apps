import { describe, expect, it } from 'vitest'
import { formatResetDate, formatUpdatedAt } from '../src/client/format-time.ts'

/**
 * 顶部时间戳要求固定布局 `yyyy-MM-dd HH:mm:ss`。
 *
 * 关键点是**不依赖运行环境 locale**：`toLocaleString()` 会随环境产出
 * `2026/9/10 下午12:40:30` 或 `9/10/2026, 12:40:30 PM` 这类结果，而这个时间戳
 * 每次刷新都会变，格式不稳定就没法快速扫视比较。用 dayjs 固定 pattern。
 */
describe('formatUpdatedAt', () => {
  it('按 yyyy-MM-dd HH:mm:ss 格式化', () => {
    // 用本地时间构造，避免测试依赖 CI 时区。
    const stamp = new Date(2026, 8, 10, 12, 40, 30).getTime() // 2026-09-10 12:40:30
    expect(formatUpdatedAt(stamp)).toBe('2026-09-10 12:40:30')
  })

  it('个位数月/日/时分秒补零（固定宽度，便于扫视）', () => {
    const stamp = new Date(2026, 0, 5, 3, 7, 9).getTime() // 2026-01-05 03:07:09
    expect(formatUpdatedAt(stamp)).toBe('2026-01-05 03:07:09')
  })

  it('使用 24 小时制，不出现 AM/PM', () => {
    const stamp = new Date(2026, 8, 10, 23, 5, 0).getTime()
    const text = formatUpdatedAt(stamp)
    expect(text).toBe('2026-09-10 23:05:00')
    expect(text).not.toMatch(/AM|PM|上午|下午/)
  })

  it('午夜按 00 而不是 24', () => {
    const stamp = new Date(2026, 8, 10, 0, 0, 0).getTime()
    expect(formatUpdatedAt(stamp)).toBe('2026-09-10 00:00:00')
  })

  it('缺失或非法时间戳返回占位符，而不是 Invalid Date', () => {
    expect(formatUpdatedAt(undefined)).toBe('—')
    expect(formatUpdatedAt(0)).toBe('—')
    expect(formatUpdatedAt(Number.NaN)).toBe('—')
    expect(formatUpdatedAt(-1)).toBe('—')
    expect(formatUpdatedAt(Number.POSITIVE_INFINITY)).toBe('—')
  })

  it('输出长度恒定（宽度不随数值变化）', () => {
    const stamps = [
      new Date(2026, 0, 1, 0, 0, 0).getTime(),
      new Date(2026, 11, 31, 23, 59, 59).getTime(),
    ]
    for (const stamp of stamps) expect(formatUpdatedAt(stamp)).toHaveLength(19)
  })
})

describe('formatResetDate（套餐重置时间裁到日）', () => {
  it('完整时间戳裁到日', () => {
    // 实测服务端返回 `2026-10-10 15:47:09` 这类完整时间戳。
    expect(formatResetDate('2026-10-10 15:47:09')).toBe('2026-10-10')
    expect(formatResetDate('2026-10-01 00:00:00')).toBe('2026-10-01')
  })

  it('同一天的不同时分秒得到同一结果（这正是要消除的干扰）', () => {
    const same = ['2026-10-10 10:13:37', '2026-10-10 15:40:51', '2026-10-10 23:59:59']
      .map(formatResetDate)
    expect(new Set(same).size).toBe(1)
    expect(same[0]).toBe('2026-10-10')
  })

  it('已经是纯日期时不变', () => {
    expect(formatResetDate('2026-10-10')).toBe('2026-10-10')
  })

  it('不依赖 Date 解析：跨时区不会偏移到前一天', () => {
    // 服务端给的是无时区标记的本地时间串。若用 new Date() 解析再格式化，
    // 在 UTC 环境下会被当作 UTC，东八区显示时可能落到前一天。
    // 字符串裁剪与此无关，因此结果恒定。
    expect(formatResetDate('2026-01-01 00:00:00')).toBe('2026-01-01')
    expect(formatResetDate('2026-12-31 23:59:59')).toBe('2026-12-31')
  })

  it('缺失或不可识别时给出可读结果而不是空串', () => {
    expect(formatResetDate(null)).toBe('—')
    expect(formatResetDate(undefined)).toBe('—')
    // 未知格式原样返回，便于发现服务端变了格式。
    expect(formatResetDate('长期有效')).toBe('长期有效')
    expect(formatResetDate('')).toBe('')
  })

  it('容忍两侧空白', () => {
    expect(formatResetDate('  2026-10-10 15:47:09  ')).toBe('2026-10-10')
  })
})
