import { describe, expect, it } from 'vitest'
import { activityCellSize, activityGridWidth } from '../src/client/activity-grid.ts'

/**
 * Token 活动热力图要「让一年的格子填满整个模块」。
 *
 * 一年恒为 53 周（365 天补位后总是 371 格）。这套几何由三处共同决定：星期列宽
 * 18px、其右侧间距 8px、格子间距 4px——任何一项与 CSS 不一致，热力图就会既
 * 铺不满又错位，而界面上只表现为「看着有点不对」，很难察觉。因此这里直接锁住
 * 「占用宽度 ≈ 可用宽度」这个不变式。
 */
const WEEKS = 53

describe('热力图格子边长', () => {
  it('足够宽时正好铺满（占用 == 可用）', () => {
    // 铺满的前提是算出来的边长落在 [CELL_MIN, CELL_MAX] 内。下界 711px
    // （53*9 + 52*4 + 26），上界 1400px（53*22 + 52*4 + 26）。
    for (const width of [711, 760, 900, 1100, 1280, 1400]) {
      const cell = activityCellSize(width, WEEKS)
      // 浮点误差允许 1px 以内。
      expect(Math.abs(activityGridWidth(cell, WEEKS) - width)).toBeLessThan(1)
    }
  })

  it('格子保持正方形（宽高同源，不会出现长方形）', () => {
    const cell = activityCellSize(900, WEEKS)
    expect(activityGridWidth(cell, WEEKS)).toBeCloseTo(900, 0)
    // 正方形由 CSS 同用 --dcb-cell-size 保证；这里确认该值是个正常正数。
    expect(cell).toBeGreaterThan(0)
  })

  it('窄屏下不低于可读下限，交给横向滚动', () => {
    const cell = activityCellSize(200, WEEKS)
    expect(cell).toBe(9)
    // 低于下限时占用会超过可用宽——这正是外层 overflow-x:auto 的存在意义。
    expect(activityGridWidth(cell, WEEKS)).toBeGreaterThan(200)
  })

  it('超宽屏下受上限约束并留白（刻意不让格子继续变大）', () => {
    const cell = activityCellSize(4000, WEEKS)
    expect(cell).toBe(22)
    expect(activityGridWidth(cell, WEEKS)).toBeLessThan(4000)
  })

  it('宽度为 0（未挂载/隐藏）时不产生 NaN 或负数', () => {
    const cell = activityCellSize(0, WEEKS)
    expect(Number.isFinite(cell)).toBe(true)
    expect(cell).toBeGreaterThan(0)
  })

  it('随宽度单调不减：拖动窗口时格子只会变大或不变', () => {
    let previous = 0
    for (let width = 300; width <= 2000; width += 50) {
      const cell = activityCellSize(width, WEEKS)
      expect(cell).toBeGreaterThanOrEqual(previous)
      previous = cell
    }
  })

  it('列数变化时同样铺满（不写死 53）', () => {
    // 对任意列数，只要算出的边长没撞上 [CELL_MIN, CELL_MAX]，就应当正好铺满。
    // 这样断言的是不变式本身，而不用挑选凑巧不撞界的数字。
    for (const weeks of [10, 27, 40, 53]) {
      for (const width of [400, 600, 800, 900, 1000]) {
        const cell = activityCellSize(width, weeks)
        if (cell <= 9 || cell >= 22) continue // 边界情况由上面的用例覆盖
        expect(Math.abs(activityGridWidth(cell, weeks) - width)).toBeLessThan(1)
      }
    }
  })
})
