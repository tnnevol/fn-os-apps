/**
 * Token 活动热力图的几何计算。
 *
 * 单独成模块（不放进 panel.tsx）有两个理由：
 * 1. 这里是纯计算，可以脱离 React/Semi UI 单测——而 panel.tsx 一旦被 import
 *    就会拉起 Semi 组件，测试环境解析不了。
 * 2. 这套几何只要有一项与 CSS 不一致，热力图就会既铺不满又错位，属于「界面上
 *    只表现为看着有点不对」的缺陷，必须能被测试锁住。
 *
 * @module dsh-codebuddy/activity-grid
 */

/** 星期标签列宽与其右侧间距：必须与 CSS `.dsh-codebuddy-token-activity-shell` 的 grid 一致。 */
export const WEEKDAY_COLUMN_WIDTH = 18
export const WEEKDAY_COLUMN_GAP = 8
/** 格子间隙：必须与 CSS `--dcb-cell-gap` 一致。 */
export const CELL_GAP = 4
/** 格子边长区间：太小看不清，太大显得笨重。 */
export const CELL_MIN = 9
export const CELL_MAX = 22

/**
 * 由可用宽度算出格子边长，让 `weekCount` 周正好铺满内容区。
 *
 * 一年恒为 53 周（365 天补位后总是 371 格），所以列数固定。原先列宽与行高都写死
 * 12px，整块宽度被钉死在 844px，卡片更宽时右侧留白——「没填满」即由此而来。
 *
 * 超宽屏下会被 `CELL_MAX` 截断而留白，这是刻意的：格子继续放大会显得笨重。
 * 窄屏下会被 `CELL_MIN` 兜住，由外层 `overflow-x: auto` 承担溢出。
 */
export function activityCellSize(shellWidth: number, weekCount: number): number {
  const grid = Math.max(0, shellWidth - WEEKDAY_COLUMN_WIDTH - WEEKDAY_COLUMN_GAP)
  const raw = (grid - (weekCount - 1) * CELL_GAP) / weekCount
  return Math.max(CELL_MIN, Math.min(CELL_MAX, raw))
}

/** 热力图连同星期列的总占用宽度，用于验证「正好铺满」。 */
export function activityGridWidth(cellSize: number, weekCount: number): number {
  return weekCount * cellSize + (weekCount - 1) * CELL_GAP + WEEKDAY_COLUMN_WIDTH + WEEKDAY_COLUMN_GAP
}
