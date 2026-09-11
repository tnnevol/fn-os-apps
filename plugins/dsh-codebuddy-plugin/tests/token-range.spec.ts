import { describe, expect, it } from 'vitest'
import { DEFAULT_TOKEN_RANGE, optionsFor, rangeLabel, resolveRange } from '../src/client/token-range.ts'

/**
 * 时间范围模型。
 *
 * 档位已收敛为「今天 / 近 7 天 / 近 30 天」（默认今天）：
 * 1.「今天」用 days = 1 表达——服务端下界是 startOfLocalDay(now - 0d) = 今天 00:00。
 * 2.「总计 / 本月 / 近 90 天」已移除：实际使用中读者只关心最近的情况，多档位
 *    反而让界面显得复杂。
 */
const t = (key: string): string => ({
  tokenRangePrefix: '近 ',
  tokenRangeSuffix: ' 天',
  tokenRangeToday: '今天',
}[key] ?? key)

describe('范围解析', () => {
  it('今天解析为 days=1（服务端起点 = 今天 00:00）', () => {
    // startOfLocalDay(now - (1-1)*DAY) = 今天零点。
    expect(resolveRange('today')).toEqual({ days: 1 })
  })

  it('固定天数键解析为对应天数', () => {
    expect(resolveRange('7d')).toEqual({ days: 7 })
    expect(resolveRange('30d')).toEqual({ days: 30 })
  })

  it('不带 allTime（总计已移除）', () => {
    for (const key of ['today', '7d', '30d'] as const) {
      expect(resolveRange(key).allTime).toBeUndefined()
    }
  })
})

describe('面板选项', () => {
  it('默认范围是今天', () => {
    expect(DEFAULT_TOKEN_RANGE).toBe('today')
  })

  it('所有面板统一给「今天 / 近 7 天 / 近 30 天」', () => {
    for (const slot of ['overview', 'trend', 'other'] as const) {
      expect(optionsFor(slot)).toEqual(['today', '7d', '30d'])
    }
  })

  it('已移除的档位不再出现（总计 / 本月 / 近 90 天）', () => {
    for (const slot of ['overview', 'trend', 'other'] as const) {
      const options = optionsFor(slot) as readonly string[]
      expect(options).not.toContain('all')
      expect(options).not.toContain('month')
      expect(options).not.toContain('90d')
    }
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
  it('今天用整词，不拼天数', () => {
    expect(rangeLabel('today', t)).toBe('今天')
  })

  it('固定天数用前后缀拼接', () => {
    expect(rangeLabel('7d', t)).toBe('近 7 天')
    expect(rangeLabel('30d', t)).toBe('近 30 天')
  })

  it('每个范围键都有非空标签', () => {
    for (const key of ['today', '7d', '30d'] as const) {
      expect(rangeLabel(key, t).length).toBeGreaterThan(0)
    }
  })
})
