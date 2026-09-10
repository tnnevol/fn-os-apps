import { describe, expect, it } from 'vitest'
import { DEFAULT_TOKEN_RANGE, optionsFor, rangeLabel, resolveRange } from '../src/client/token-range.ts'

/**
 * 时间范围模型。
 *
 * 两个容易错的点在这里被锁住：
 * 1.「本月」必须解析成**日历月起点**（days = 今天几号），而不是固定 30 天。
 * 2.「总计」必须走 allTime，而不是拿一个大 days 近似——days 有上限，
 *    超过一年的历史会被静默截断，而「总计」的语义是「全部」。
 */
const t = (key: string): string => ({
  tokenRangePrefix: '近 ',
  tokenRangeSuffix: ' 天',
  tokenRangeMonth: '本月',
  tokenRangeAll: '总计',
}[key] ?? key)

describe('范围解析', () => {
  it('固定天数键解析为对应天数', () => {
    expect(resolveRange('7d')).toEqual({ days: 7 })
    expect(resolveRange('30d')).toEqual({ days: 30 })
    expect(resolveRange('90d')).toEqual({ days: 90 })
  })

  it('本月解析为「今天几号」天，即从本月 1 号起算', () => {
    // 10 号 → days=10 → 服务端起点 = startOfLocalDay(now - 9d) = 本月 1 号。
    expect(resolveRange('month', new Date(2026, 8, 10))).toEqual({ days: 10 })
    // 1 号 → days=1 → 起点就是今天。
    expect(resolveRange('month', new Date(2026, 8, 1))).toEqual({ days: 1 })
    // 月末（31 天月）→ days=31。
    expect(resolveRange('month', new Date(2026, 7, 31))).toEqual({ days: 31 })
  })

  it('本月随日期变化，不与固定的 30 天混淆', () => {
    // 这正是 store 必须以范围键（而非 days）做缓存键的原因：
    // 30 号时 'month' 与 '30d' 恰好都是 30 天，但请求语义不同。
    expect(resolveRange('month', new Date(2026, 8, 30)).days).toBe(30)
    expect(resolveRange('30d').days).toBe(30)
    // 两者请求参数不同：month 不带 allTime，但 days 会随日期变；
    // '30d' 永远是 30。缓存若按 days 存，两者会互相污染。
    expect(resolveRange('month', new Date(2026, 8, 5)).days).toBe(5)
  })

  it('总计走 allTime 而不是大天数', () => {
    const all = resolveRange('all')
    expect(all.allTime).toBe(true)
    // 不应伪装成一个很大的 days——那样会被 MAX_RANGE_DAYS 截断。
    expect(all.days).toBeLessThanOrEqual(1)
  })
})

describe('面板选项', () => {
  it('默认范围是近 7 天', () => {
    expect(DEFAULT_TOKEN_RANGE).toBe('7d')
  })

  it('总览提供「总计」，因为总览要回答「一共用了多少」', () => {
    expect(optionsFor('overview')).toContain('all')
    // 总览不需要「本月」：它与其他三个窗口语义重叠。
    expect(optionsFor('overview')).not.toContain('month')
  })

  it('趋势提供「本月」，因为趋势需要一个有意义的当前窗口', () => {
    expect(optionsFor('trend')).toContain('month')
    // 趋势不放「总计」：逐日柱状图会被一根巨柱淹没。
    expect(optionsFor('trend')).not.toContain('all')
  })

  it('其他面板只给固定天数', () => {
    expect(optionsFor('other')).toEqual(['7d', '30d', '90d'])
  })

  it('每个面板的选项都包含默认值，默认态才不会落在无选项的位置', () => {
    for (const slot of ['overview', 'trend', 'other'] as const) {
      expect(optionsFor(slot)).toContain(DEFAULT_TOKEN_RANGE)
    }
  })

  it('选项无重复', () => {
    for (const slot of ['overview', 'trend', 'other'] as const) {
      const options = optionsFor(slot)
      expect(new Set(options).size).toBe(options.length)
    }
  })
})

describe('范围标签', () => {
  it('固定天数用前后缀拼接', () => {
    expect(rangeLabel('7d', t)).toBe('近 7 天')
    expect(rangeLabel('90d', t)).toBe('近 90 天')
  })

  it('本月与总计用整词，不拼天数', () => {
    expect(rangeLabel('month', t)).toBe('本月')
    expect(rangeLabel('all', t)).toBe('总计')
  })

  it('每个范围键都有非空标签', () => {
    for (const key of ['7d', '30d', '90d', 'month', 'all'] as const) {
      expect(rangeLabel(key, t).length).toBeGreaterThan(0)
    }
  })
})
