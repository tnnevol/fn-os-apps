/**
 * 指标占比分段条的布局计算。
 *
 * 单独成模块（不放进 panel.tsx）是为了可测：panel.tsx 一旦被 import 就会拉起
 * Semi 组件，测试环境解析不了 JSX/样式。
 *
 * 背景：分段条不能按「宽度 = 占比百分比」渲染。实测真实数据里缓存读占 98.68%、
 * 输出仅 0.15%、缓存写为 0%，纯百分比会把小项压成 0–1px 让它们视觉上消失。
 * 因此每段先占一个可见的最小宽度，剩余空间才按数值比例分配——本模块就负责这套
 * 分配的验算，与 CSS 的 flex 规则保持一致。
 *
 * @module dsh-codebuddy/segment-bar
 */

/** 每段的可见最小宽度（px）。必须与 CSS `--dcb-segment-min` 一致。 */
export const SEGMENT_MIN_WIDTH = 4

/**
 * 计算各段的实际渲染宽度，与 CSS 的
 * `flex: 0 1 0; min-width: var(--dcb-segment-min); flex-grow: <value>`
 * 行为一致：先给每段最小宽度，余量按数值比例分配。
 *
 * 用于测试与验算——CSS 由浏览器计算，这里只是把同一套规则用代码表达出来，
 * 以便锁住「小项不会被压成 0」这一契约。
 */
export function segmentWidths(values: readonly number[], barWidth: number): number[] {
  const positive = values.map(value => Math.max(0, value))
  const total = positive.reduce((sum, value) => sum + value, 0)
  const count = positive.length
  if (count === 0) return []
  // 条太窄，连最小宽度都放不下：等分（此时保证不出现 0 宽）。
  const reserved = count * SEGMENT_MIN_WIDTH
  if (barWidth <= reserved) return positive.map(() => barWidth / count)
  const remaining = barWidth - reserved
  return positive.map(value => SEGMENT_MIN_WIDTH + (total > 0 ? (value / total) * remaining : 0))
}

/** 某一段是否可辨：宽度达到最小可见宽度。 */
export function isVisibleWidth(width: number): boolean {
  return width >= SEGMENT_MIN_WIDTH
}
