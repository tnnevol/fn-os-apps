/**
 * Token 用量柱状图（echarts）：主题色从 DSH CSS 变量读取。
 *
 * 单独成模块的理由：这套图表是页面上最重的 effect（resize / MutationOb-
 * server / 颜色变量读取），把它与 CodeBuddyPanelPage / TokenStatsPage 的
 * 渲染拆开。import path 也明确告诉读者「这块是 echarts」，避免在 panel.tsx
 * 里突然出现一长串 chart.setOption() 干扰阅读。
 *
 * 颜色变量统一取 CSS 自定义属性（--dsw-alias-* / --dcb-series-*），不
 * 写死 hex——后者曾经让面板与总览分段条/模型分布颜色不同，现在由 CSS
 * 唯一来源约束。
 *
 * @module dsh-codebuddy/ui/token-usage-chart
 */

import type { TokenUsageChartProps } from '../../types/client/ui/token-usage-chart'
export type { TokenUsageChartProps } from '../../types/client/ui/token-usage-chart'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { BarChart, LineChart } from 'echarts/charts'
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
// echarts 的 `use` 是**同步注册函数**（与 registerXxx 同族），不是 React Hook。
// 这里刻意不改名成 `useECharts`——那会让 react/rules-of-hooks 误判「在顶层调
// Hook」；`registerECharts` 如实表达它的语义。
import { init as initChart, use as registerECharts } from 'echarts/core'
import type { ECharts } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

import { compact } from './loading-shared.tsx'

// 模块级注册 echarts 组件：每个 import 都注册一次。
registerECharts([BarChart, LineChart, AriaComponent, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

/** 读取 CSS 变量；空值回退到 fallback。 */
export function cssVariableFromElement(element: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback
}

export function TokenUsageChartImpl({ days, inputLabel, outputLabel, cacheReadLabel, recordsLabel }: TokenUsageChartProps): ReactNode {
  const chartElement = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = chartElement.current
    if (element === null) return
    const textColor = cssVariableFromElement(element, '--dsw-alias-label-tertiary', '#8b93a7')
    const gridColor = cssVariableFromElement(element, '--dsw-alias-border-l3', 'rgba(139, 147, 167, 0.24)')
    // 四个系列色统一取 --dcb-series-*（定义在 .dsh-codebuddy-panel-tokens），
    // 与总览分段条/模型分布同色；不要在这里各写一个语义变量——那正是此前
    // 同一指标在不同面板颜色不一致的原因（缓存读曾用 label-tertiary，即灰色）。
    const inputColor = cssVariableFromElement(element, '--dcb-series-input', '#2aa3a3')
    const outputColor = cssVariableFromElement(element, '--dcb-series-output', '#7b61d8')
    const cacheReadColor = cssVariableFromElement(element, '--dcb-series-cache-read', '#e2823c')
    const chart: ECharts = initChart(element, undefined, { renderer: 'canvas' })
    chart.setOption({
      aria: { enabled: true },
      animation: false,
      grid: { top: 32, right: 12, bottom: 28, left: 12, containLabel: true },
      // 图例：每个系列的 item 至少 20px 高，保证四个指标（输入/输出/缓存读/缓存写）
      // 都有足够的点击与辨认区域。
      //
      // itemWidth 必须与 itemHeight **相等**：ECharts 的图例色块是 roundRect，
      // 按 (itemWidth, itemHeight) 直接铺开，不保持宽高比——实测 path 数据：
      //   itemWidth 10 + itemHeight 20 → "M2.5 0L7.5 0 … L10 17.5 … L2.5 20 …"
      //   即 10 宽 20 高的竖条（色块被拉长）；
      //   20 × 20 → "M5 0L15 0 … L20 15 … L5 20 …" 即正方形。
      // 另测 symbolKeepAspect: true 对 roundRect 图标**无效**（path 完全不变），
      // 所以不能靠它补救，只能让宽高相等。
      legend: { top: 0, itemWidth: 20, itemHeight: 20, itemGap: 16, textStyle: { color: textColor } },
      // 窄屏下四个图例项会折成两行，压住绘图区。实测图例高度：
      //   单行 25px（itemWidth 10 时是 17px）／双行 61px，
      // 而 grid.top 固定 32px —— 双行时重叠 29px。
      // 用 media 按宽度抬高绘图区：单行保持紧凑，折行时自动让位。
      // 阈值取 420px：实测英文长标签（Cache write）在 itemWidth 20 下约 340px 处开始折行，
      // 留出余量以覆盖中文/其他语言与字体差异。
      media: [
        { query: { maxWidth: 420 }, option: { grid: { top: 68 } } },
      ],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (value: string | number) => compact(Number(value)),
      },
      xAxis: {
        type: 'category',
        data: days.map(day => day.day.slice(5)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: textColor, fontSize: 10 },
      },
      yAxis: [
        {
          type: 'value',
          axisTick: { show: false },
          axisLine: { show: false },
          axisLabel: { color: textColor, formatter: (value: number) => compact(value) },
          splitLine: { lineStyle: { color: gridColor } },
        },
        {
          type: 'value',
          axisTick: { show: false },
          axisLine: { show: false },
          axisLabel: { color: textColor, formatter: (value: number) => compact(value) },
          splitLine: { show: false },
        },
      ],
      series: [
        // barMinHeight：每段柱体的最小像素高度。堆叠模式下 ECharts 对**每个分段**
        // 生效（源码按 stackStartValue 单独计算），因此占比极小的分段也始终可见
        // ——否则它的高度会被四舍五入成 0，整段从图例中「消失」。
        // 缓存写不再统计，故无该系列；顶部圆角改由最后一段（缓存读）承担。
        { name: inputLabel, type: 'bar', stack: 'tokens', barMaxWidth: 32, barMinHeight: 30, itemStyle: { color: inputColor }, data: days.map(day => day.input) },
        { name: outputLabel, type: 'bar', stack: 'tokens', barMaxWidth: 32, barMinHeight: 30, itemStyle: { color: outputColor }, data: days.map(day => day.output) },
        { name: cacheReadLabel, type: 'bar', stack: 'tokens', barMaxWidth: 32, barMinHeight: 30, itemStyle: { color: cacheReadColor, borderRadius: [3, 3, 0, 0] }, data: days.map(day => day.read) },
        { name: recordsLabel, type: 'line', yAxisIndex: 1, smooth: true, symbol: 'none', lineStyle: { type: 'dashed', width: 2 }, data: days.map(day => day.records) },
      ],
    })
    const resize = (): void => { chart.resize() }
    const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize)
    if (resizeObserver !== undefined) resizeObserver.observe(element)
    else window.addEventListener('resize', resize)
    /**
     * 页面被 keep-alive 保留后，从隐藏切回可见时容器会由 0 宽度变回真实宽度。
     * ResizeObserver 在多数浏览器会因此回调，但在「元素刚从 display:none 恢复」
     * 这一刻不保证一定触发——尤其图表初始化就发生在隐藏状态下（0×0）时，
     * 它会一直保持空白。因此额外观察承载页面的 hidden 变化，恢复可见时主动
     * resize 一次。
     */
    const view = element.closest('.dsh-codebuddy-panel-view')
    const visibilityObserver = typeof MutationObserver === 'undefined' || view === null
      ? undefined
      : new MutationObserver(() => {
        if ((view as HTMLElement).hidden) return
        // 等一帧后再量：hidden 刚被移除时容器尺寸可能尚未完成布局。
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(resize)
        else resize()
      })
    visibilityObserver?.observe(view as Node, { attributes: true, attributeFilter: ['hidden'] })
    return () => {
      resizeObserver?.disconnect()
      visibilityObserver?.disconnect()
      if (resizeObserver === undefined) window.removeEventListener('resize', resize)
      chart.dispose()
    }
  }, [days, inputLabel, outputLabel, cacheReadLabel, recordsLabel])
  return <div ref={chartElement} className="dsh-codebuddy-panel-chart" role="img" aria-label={`${inputLabel} and ${outputLabel}`} />
}
