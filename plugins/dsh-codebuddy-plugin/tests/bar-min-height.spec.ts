import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 趋势图每段柱体要有最小高度。
 *
 * 真实数据里输出仅 0.15%，按真实比例算出的高度会被四舍五入成 0px，
 * 该分段就从图上「消失」（图例有、柱体没有）。`barMinHeight` 在**堆叠**模式下
 * 由 ECharts 按每个分段独立生效（源码按 stackStartValue 单独计算），因此这是
 * 正确的选项。
 *
 * 这里同时核对选项名与 ECharts 类型定义——写错名字不会报错，只会被静默忽略。
 */
const PANEL = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/panel.tsx',
  'utf8',
)

describe('趋势图柱体最小高度', () => {
  const chart = PANEL.slice(PANEL.indexOf('function TokenUsageChart'))

  it('三个堆叠系列都设置了 barMinHeight: 30', () => {
    const series = chart.slice(chart.indexOf('series: ['), chart.indexOf("type: 'line'"))
    const matches = series.match(/barMinHeight: 30/g) ?? []
    // 输入 / 输出 / 缓存读 —— 三段都要，漏一个那段就可能不可见。
    // （缓存写已移出统计，不再有该系列。）
    expect(matches).toHaveLength(3)
  })

  it('折线系列不带 barMinHeight（它没有柱体）', () => {
    const line = chart.slice(chart.indexOf("type: 'line'"))
    const lineSeries = line.slice(0, line.indexOf('}'))
    expect(lineSeries).not.toContain('barMinHeight')
  })

  it('选项名与 ECharts 类型定义一致（拼错会被静默忽略）', () => {
    const types = readFileSync(
      '/Users/tnnevol/workspace/fn-packages/fn-os-apps/node_modules/.pnpm/echarts@6.1.0/node_modules/echarts/types/dist/shared.d.ts',
      'utf8',
    )
    expect(types).toContain('barMinHeight?: number')
  })
})
