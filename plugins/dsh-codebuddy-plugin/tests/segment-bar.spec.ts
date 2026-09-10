import { describe, expect, it } from 'vitest'
import { SEGMENT_MIN_WIDTH, isVisibleWidth, segmentWidths } from '../src/client/segment-bar.ts'

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
