import { describe, expect, it } from 'vitest'
import * as echarts from 'echarts'
import { readFileSync } from 'node:fs'

/**
 * 「Token 与调用趋势」图例：每个 item（输入/输出/缓存读/缓存写）至少 20px 高。
 *
 * 用 ECharts 的 SSR 渲染与包围盒 API 实测，而不是读源码文本——图例高度由
 * ECharts 内部布局决定，肉眼看代码推不出来。实测数据（itemGap 16）：
 *
 *   itemWidth/itemHeight = 10/10 → item 高 12px、图例区高 17px（现状，不达标）
 *   itemWidth/itemHeight = 20/20 → item 高 20px、图例区高 25px（达标）
 *   itemWidth 10 + itemHeight 20 → item 高 20px，但**色块被拉成 10×20 竖条**
 *
 * 因此 itemWidth 必须与 itemHeight 相等：图例色块是 roundRect，按 (w,h) 直接铺开、
 * 不保持宽高比；且实测 `symbolKeepAspect: true` 对 roundRect 无效（path 完全不变），
 * 不能靠它补救。
 */
const NAMES = ['输入', '输出', '缓存读', '缓存写']
const PANEL = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/panel.tsx',
  'utf8',
)

interface Probe {
  itemHeight: number
  legendHeight: number
  marker: { w: number, h: number }
}

function probe(width: number, legend: Record<string, unknown>, gridTop = 32, names: readonly string[] = NAMES): Probe {
  const chart = (echarts as unknown as { init: (...a: unknown[]) => {
    setOption: (o: unknown) => void
    renderToSVGString: () => string
    _componentsViews?: Array<{
      __model?: { mainType?: string }
      group?: { getBoundingRect: () => { y: number, height: number } }
    }>
  } }).init(null, null, { renderer: 'svg', ssr: true, width, height: 310 })
  chart.setOption({
    animation: false,
    legend: { top: 0, ...legend },
    grid: { top: gridTop, right: 12, bottom: 28, left: 12, containLabel: true },
    xAxis: { type: 'category', data: ['09-01', '09-02'] },
    yAxis: { type: 'value' },
    series: names.map(name => ({ name, type: 'bar', stack: 't', data: [1, 2] })),
  })
  const svg = chart.renderToSVGString()
  // item 高度：图例的命中矩形（pointer-events=visible 的 path）高
  const itemH = Number(/<path d="M-?[\d.]+ -?[\d.]+l[\d.]+ 0l0 ([\d.]+)l[^"]*"[^>]*pointer-events="visible"/.exec(svg)?.[1] ?? NaN)
  // 图例色块（roundRect）的包围盒
  const p = /<path d="([^"]*)" transform="translate\([^)]*\)"[^>]*ecmeta_ssr_type="legend"/.exec(svg)?.[1] ?? ''
  const pts = [...p.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => ({ x: +m[1]!, y: +m[2]! }))
  const marker = pts.length === 0
    ? { w: NaN, h: NaN }
    : {
        w: Math.max(...pts.map(q => q.x)) - Math.min(...pts.map(q => q.x)),
        h: Math.max(...pts.map(q => q.y)) - Math.min(...pts.map(q => q.y)),
      }
  const lv = (chart._componentsViews ?? []).find(v => v.__model?.mainType === 'legend')
  const rect = lv?.group?.getBoundingRect()
  return { itemHeight: itemH, legendHeight: rect === undefined ? NaN : rect.height, marker }
}

/** 从 panel.tsx 解析真实的 legend 配置，避免测试与实现各写一份数字。 */
const LEGEND = (() => {
  const m = /legend: \{ top: 0, itemWidth: (\d+), itemHeight: (\d+), itemGap: (\d+)/.exec(PANEL)
  if (m === null) throw new Error('未能在 panel.tsx 中解析出 legend 配置')
  return { itemWidth: Number(m[1]), itemHeight: Number(m[2]), itemGap: Number(m[3]) }
})()

describe('图例 item 最小高度 20px', () => {
  it('面板实际配置下 item 高度 ≥ 20px', () => {
    // 用从源码解析出的配置渲染：面板改成 10 时这里必须失败。
    const r = probe(900, LEGEND)
    expect(r.itemHeight).toBeGreaterThanOrEqual(20)
  })

  it('原配置（10/10）不达标——这是本次修改的动因', () => {
    const r = probe(900, { itemWidth: 10, itemHeight: 10, itemGap: 16 })
    expect(r.itemHeight).toBeLessThan(20)
  })

  it('色块保持正方形：itemWidth 必须等于 itemHeight', () => {
    // 只调 itemHeight 会把 roundRect 拉成竖条（实测 10×20）。
    expect(LEGEND.itemWidth).toBe(LEGEND.itemHeight)
    const square = probe(900, LEGEND).marker
    expect(Math.abs(square.w - square.h)).toBeLessThan(0.001)
    const stretched = probe(900, { itemWidth: 10, itemHeight: 20, itemGap: 16 }).marker
    expect(stretched.h).toBeGreaterThan(stretched.w * 1.5)
  })

  it('symbolKeepAspect 对 roundRect 图标无效（故不能靠它补救）', () => {
    const on = probe(900, { itemWidth: 10, itemHeight: 20, itemGap: 16, symbolKeepAspect: true }).marker
    const off = probe(900, { itemWidth: 10, itemHeight: 20, itemGap: 16 }).marker
    expect(on.w).toBeCloseTo(off.w, 5)
    expect(on.h).toBeCloseTo(off.h, 5)
  })
})

describe('图例变高后不与绘图区重叠', () => {
  it('单行时 grid.top 足够', () => {
    const r = probe(900, { itemWidth: 20, itemHeight: 20, itemGap: 16 }, 32)
    expect(r.legendHeight).toBeLessThanOrEqual(32)
  })

  it('折行后图例高约 66px，会压住 grid.top 32px', () => {
    // 实测折行阈值：英文标签（Cache write）约 340px 起折，中文约 260px 起折；
    // 折行后两行高度 66px > 32px，因此必须抬高绘图区。
    const wrapped = probe(300, { itemWidth: 20, itemHeight: 20, itemGap: 16 }, 32, ['Input', 'Output', 'Cache read', 'Cache write'])
    expect(wrapped.legendHeight).toBeGreaterThan(32)
  })

  it('中文标签在 260px 才折行（阈值比英文更低）', () => {
    // 中文标签更短，同样宽度下不易折行——阈值取值要覆盖更长的那一种。
    const zh340 = probe(340, { itemWidth: 20, itemHeight: 20, itemGap: 16 }, 32)
    expect(zh340.legendHeight).toBeLessThanOrEqual(32)
    const zh260 = probe(260, { itemWidth: 20, itemHeight: 20, itemGap: 16 }, 32)
    expect(zh260.legendHeight).toBeGreaterThan(32)
  })

  it('面板用 media 在窄屏抬高 grid.top 让出空间', () => {
    // 阈值 420px：覆盖英文约 340px 的折行点并留余量（其他语言/字体更宽时仍生效）。
    expect(PANEL).toMatch(/media: \[\s*\{ query: \{ maxWidth: 420 \}, option: \{ grid: \{ top: 68 \} \} \}/)
  })
})
