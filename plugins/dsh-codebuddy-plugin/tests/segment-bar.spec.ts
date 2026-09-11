import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { SEGMENT_MIN_WIDTH, isVisibleWidth, segmentWidths, sortSegmentsByValueDesc } from '../src/client/segment-bar.ts'

/**
 * 分段条要保证「任何一个非零项都不会被大项挤没」。
 *
 * 真实数据（本地 90 天会话实测）：缓存读 98.68%、输入 1.18%、输出 0.15%、
 * 缓存写 0%。纯按比例分配时输出只有约 1px、缓存写 0px，视觉上直接消失，
 * 连 Tooltip 都悬停不到——这正是要修的问题。
 */
const REAL = [18_864_650, 2_338_946, 1_579_863_784, 0] // 输入 / 输出 / 缓存读 / 缓存写

describe('分段条布局', () => {
  it('极端倾斜的真实比例下，小项仍可见', () => {
    const widths = segmentWidths(REAL, 800)
    // 每一项都达到最小可见宽度。
    for (const width of widths) expect(isVisibleWidth(width)).toBe(true)
    // 输出（0.15%）此前只有约 1px，现在必须可见。
    expect(widths[1]).toBeGreaterThanOrEqual(SEGMENT_MIN_WIDTH)
    // 缓存写为 0，但也保留可见宽度，否则看不出「存在这一项」。
    expect(widths[3]).toBeGreaterThanOrEqual(SEGMENT_MIN_WIDTH)
  })

  it('大项仍占绝大部分，视觉主次没有被破坏', () => {
    const widths = segmentWidths(REAL, 800)
    const cacheRead = widths[2] ?? 0
    // 缓存读应仍占 95% 以上；最小值补偿只吃掉了几个像素。
    expect(cacheRead / 800).toBeGreaterThan(0.95)
  })

  it('总宽恰好铺满，不溢出也不留白', () => {
    for (const bar of [400, 600, 800, 1200]) {
      const total = segmentWidths(REAL, bar).reduce((sum, width) => sum + width, 0)
      expect(Math.abs(total - bar)).toBeLessThan(0.001)
    }
  })

  it('比例正常时结果接近纯比例（最小值不干扰常规情况）', () => {
    const widths = segmentWidths([50, 30, 20], 500)
    // 每段都远大于最小值，补偿量可忽略。
    expect(widths[0]).toBeGreaterThan(240)
    expect(widths[0]).toBeLessThan(260)
    expect(widths[1]).toBeGreaterThan(140)
    expect(widths[2]).toBeGreaterThan(90)
  })

  it('条太窄时等分，不产生 0 宽或负宽', () => {
    const widths = segmentWidths(REAL, 6)
    for (const width of widths) expect(width).toBeGreaterThan(0)
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(6, 6)
  })

  it('全为 0 时不产生 NaN', () => {
    const widths = segmentWidths([0, 0, 0, 0], 800)
    for (const width of widths) {
      expect(Number.isFinite(width)).toBe(true)
      expect(width).toBeGreaterThanOrEqual(SEGMENT_MIN_WIDTH)
    }
  })

  it('负值（异常数据）按 0 处理，不影响其他段', () => {
    const widths = segmentWidths([-5, 10, 90], 500)
    expect(widths[0]).toBeGreaterThan(0)
    expect(isVisibleWidth(widths[0] ?? 0)).toBe(true)
    expect(Math.abs(widths.reduce((a, b) => a + b, 0) - 500)).toBeLessThan(0.001)
  })

  it('空输入返回空数组', () => {
    expect(segmentWidths([], 800)).toEqual([])
  })

  it('任意宽度下每段都可见（扫一遍常见条宽）', () => {
    for (let bar = 200; bar <= 1600; bar += 100) {
      const widths = segmentWidths(REAL, bar)
      for (const width of widths) expect(width).toBeGreaterThanOrEqual(SEGMENT_MIN_WIDTH - 1e-9)
    }
  })
})

describe('分段排序：占比最大的排第一', () => {
  /**
   * 真实数据里缓存读常占 95% 以上。若它排在中间，视觉重心会偏；降序后主项紧贴
   * 阅读起点，一眼可辨。排序同时作用于条形与图例，两处顺序必须一致。
   */
  const REAL = [
    { label: '输入', value: 18_864_650 },
    { label: '输出', value: 2_338_946 },
    { label: '缓存读', value: 1_579_863_784 },
    { label: '缓存写', value: 0 },
  ]

  it('按数值降序，最大项排第一', () => {
    const sorted = sortSegmentsByValueDesc(REAL)
    expect(sorted.map(s => s.label)).toEqual(['缓存读', '输入', '输出', '缓存写'])
  })

  it('不修改原数组（调用方可能还在用原顺序）', () => {
    const input = [...REAL]
    sortSegmentsByValueDesc(input)
    expect(input.map(s => s.label)).toEqual(['输入', '输出', '缓存读', '缓存写'])
  })

  it('相等值保持原相对顺序（稳定，刷新时位置不抖动）', () => {
    const tied = [
      { label: 'a', value: 5 },
      { label: 'b', value: 10 },
      { label: 'c', value: 5 },
      { label: 'd', value: 10 },
    ]
    expect(sortSegmentsByValueDesc(tied).map(s => s.label)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('负值当 0 处理，不会因排序把异常数据顶到前面', () => {
    const weird = [
      { label: 'neg', value: -5 },
      { label: 'zero', value: 0 },
      { label: 'pos', value: 3 },
    ]
    expect(sortSegmentsByValueDesc(weird).map(s => s.label)).toEqual(['pos', 'neg', 'zero'])
  })

  it('空数组与单元素不出错', () => {
    expect(sortSegmentsByValueDesc([])).toEqual([])
    expect(sortSegmentsByValueDesc([{ label: 'x', value: 1 }])).toHaveLength(1)
  })
})

describe('最小宽度已加倍', () => {
  it('下限为 8px（原为 4px）', () => {
    expect(SEGMENT_MIN_WIDTH).toBe(8)
  })

  it('极窄条也保证每段至少 8px 可辨', () => {
    const widths = segmentWidths([1_000_000, 1, 1, 1], 400)
    for (const width of widths) expect(width).toBeGreaterThanOrEqual(8)
  })
})

describe('最小宽度的单一事实来源', () => {
  /**
   * SEGMENT_MIN_WIDTH（TS）与 --dcb-segment-min（CSS）必须一致，否则会静默错位：
   * TS 那份只用于测试验算，真正生效的是 CSS；两者不一致时测试会「通过」而界面
   * 是另一个数——这正是最容易被忽略的一类漂移。
   */
  it('TS 常量与 CSS 变量取值一致', () => {
    const scss = readFileSync(
      '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/styles/token-panel.scss',
      'utf8',
    )
    const match = /--dcb-segment-min:\s*(\d+)px/.exec(scss)
    expect(match).not.toBeNull()
    expect(Number(match?.[1])).toBe(SEGMENT_MIN_WIDTH)
  })

  it('条形与图例用同一个顺序（两处都基于 ordered）', () => {
    const panel = readFileSync(
      '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/panel.tsx',
      'utf8',
    )
    const bar = panel.slice(panel.indexOf('function SegmentBar'), panel.indexOf('function BreakdownList'))
    // 条形与图例都必须遍历 ordered，而不是其中一个用原始 segments。
    expect(bar).toMatch(/dsh-codebuddy-panel-segment-bar[\s\S]*?\{ordered\.map/)
    expect(bar).toMatch(/dsh-codebuddy-panel-segment-legend[\s\S]*?\{ordered\.map/)
  })
})
