import { describe, expect, it } from 'vitest'
import { DEFAULT_TOKEN_RANGE, DEFAULT_TREND_RANGE, optionsFor, rangeLabel, resolveRange } from '../src/client/token-range.ts'

/**
 * 时间范围模型。
 *
 * 档位收敛为「今天 / 近 7 天 / 近 30 天 / 近 90 天」（默认 today）：
 * 1.「今天」用 days = 1 表达——服务端下界是 startOfLocalDay(now - 0d) = 今天 00:00。
 * 2.「总计 / 本月」已移除：实际使用中读者只关心最近的情况。
 * 3.「近 90 天」是**仅 trend 槽位**开放的扩展档——给调用趋势（柱状图 echarts）
 *    一个更宽的周期；总览/分布/会话排名仍走 today/7d/30d。trend 的默认档
 *    是 7d（`DEFAULT_TREND_RANGE`），因为 today 已被该槽位排除。
 */
const t = (key: string): string => ({
  tokenRangePrefix: '近 ',
  tokenRangeSuffix: ' 天',
  tokenRangeToday: '今天',
}[key] ?? key)

/**
 * 把结果归一为 `{days, allTime?}` 形态，便于断言。
 *
 * `resolveRange` 返回 `{startTime, endTime, allTime?}`——前者是绝对端点，会随
 * 测试运行的当前时间漂移；转成 `days` 后，断言就能稳定比较「今天=1 / 7d=7 /
 * 30d=30」。
 */
function daysFromResult(result: { startTime?: number, endTime?: number, allTime?: boolean }): { days: number, allTime?: boolean } {
  const allTime = result.allTime
  if (allTime === true) return { days: 0, allTime: true }
  const start = result.startTime
  const end = result.endTime
  if (typeof start !== 'number' || typeof end !== 'number') return { days: 0 }
  return { days: Math.round((end - start) / 86_400_000) + 1 }
}

describe('范围解析', () => {
  it('今天解析为 1 天的窗口（端点都是今天 00:00）', () => {
    // startOfLocalDay(now - 0d) = 今天零点：startTime === endTime，对应 days=1。
    expect(daysFromResult(resolveRange('today'))).toEqual({ days: 1 })
  })

  it('固定天数键解析为对应天数的窗口', () => {
    expect(daysFromResult(resolveRange('7d'))).toEqual({ days: 7 })
    expect(daysFromResult(resolveRange('30d'))).toEqual({ days: 30 })
    expect(daysFromResult(resolveRange('90d'))).toEqual({ days: 90 })
  })

  it('不带 allTime（总计已移除）', () => {
    for (const key of ['today', '7d', '30d', '90d'] as const) {
      expect(resolveRange(key).allTime).toBeUndefined()
    }
  })

  it('端点都规范化到本地零点（同一日内的不同时间取整到同一行）', () => {
    // now 任意，today 应当 start === end（这一天 0 点）。
    const result = resolveRange('today', new Date(2024, 5, 15, 13, 45, 0))
    expect(result.startTime).toBe(result.endTime)
    // 该时间戳对应 2024-06-15 00:00:00 本地时间。
    const expected = new Date(2024, 5, 15, 0, 0, 0).getTime()
    expect(result.startTime).toBe(expected)
  })

  it('7d 的 startTime = endTime - 6 天', () => {
    const end = new Date(2024, 5, 15, 0, 0, 0).getTime()
    const result = resolveRange('7d', new Date(end + 12 * 3_600_000))
    expect(result.endTime).toBe(end)
    expect(result.startTime).toBe(end - 6 * 86_400_000)
  })

  it('90d 的 startTime = endTime - 89 天', () => {
    const end = new Date(2024, 5, 15, 0, 0, 0).getTime()
    const result = resolveRange('90d', new Date(end + 12 * 3_600_000))
    expect(result.endTime).toBe(end)
    expect(result.startTime).toBe(end - 89 * 86_400_000)
  })
})

describe('面板选项', () => {
  it('默认范围是今天', () => {
    expect(DEFAULT_TOKEN_RANGE).toBe('today')
  })

  it('总览/分布/会话：today / 7d / 30d；趋势：7d / 30d / 90d（不要 today）', () => {
    expect(optionsFor('overview')).toEqual(['today', '7d', '30d'])
    expect(optionsFor('other')).toEqual(['today', '7d', '30d'])
    // 趋势模块按较长周期看分布有意义——today 在该模块下不开放。
    expect(optionsFor('trend')).toEqual(['7d', '30d', '90d'])
    expect(optionsFor('trend')).not.toContain('today')
  })

  it('已移除的档位不再出现（总计 / 本月）', () => {
    for (const slot of ['overview', 'trend', 'other'] as const) {
      const options = optionsFor(slot) as readonly string[]
      expect(options).not.toContain('all')
      expect(options).not.toContain('month')
    }
  })

  it('每个面板的选项都包含该面板的默认档', () => {
    expect(optionsFor('overview')).toContain(DEFAULT_TOKEN_RANGE)
    expect(optionsFor('other')).toContain(DEFAULT_TOKEN_RANGE)
    // 趋势槽位默认 7d，不是 today——验证「默认档一定在选项中」。
    expect(optionsFor('trend')).toContain(DEFAULT_TREND_RANGE)
  })

  it('选项无重复', () => {
    for (const slot of ['overview', 'trend', 'other'] as const) {
      const options = optionsFor(slot)
      expect(new Set(options).size).toBe(options.length)
    }
  })
})

describe('范围标签', () => {
  it('今天用整词，不拼天数', () => {
    expect(rangeLabel('today', t)).toBe('今天')
  })

  it('固定天数用前后缀拼接', () => {
    expect(rangeLabel('7d', t)).toBe('近 7 天')
    expect(rangeLabel('30d', t)).toBe('近 30 天')
    expect(rangeLabel('90d', t)).toBe('近 90 天')
  })

  it('每个范围键都有非空标签', () => {
    for (const key of ['today', '7d', '30d', '90d'] as const) {
      expect(rangeLabel(key, t).length).toBeGreaterThan(0)
    }
  })
})
