import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 时间范围选择器（分段控件）的三条不变式。
 *
 * 这组断言守的是一个真实缺陷：ButtonGroup 的分隔线来自它内部
 * `getInnerWithLine()`，该方法只对 `theme === 'outline'` 跳过，其余主题
 * （**含 borderless**）都会在每两个相邻按钮间插入
 * `<span class="semi-button-group-line-*">`，其 `::before` 是 1px×20px 竖线。
 * 表现为「按钮之间有 gap 和多余分割线」。
 *
 * 同时组上的 theme/type 会覆盖子按钮自身的值（ButtonGroup 用
 * `Object.assign({disabled,size,type}, itm.props, rest)` 合并，而 theme 落进
 * rest 且排在子 props 之后），所以激活态不能用 theme 表达。
 */
const PANEL = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/panel.tsx',
  'utf8',
)
const SCSS = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/styles/panel-layout.scss',
  'utf8',
)

describe('RangeToggle 结构', () => {
  const toggle = PANEL.slice(PANEL.indexOf('function RangeToggle'), PANEL.indexOf('function BreakdownList'))

  it('ButtonGroup 上不传 theme / type（否则会覆盖子按钮并触发分隔线）', () => {
    const groupTag = /<DshButtonGroup[\s\S]*?>/.exec(toggle)?.[0] ?? ''
    expect(groupTag).not.toContain('theme=')
    expect(groupTag).not.toContain('type=')
    // size 是被 ButtonGroup 解构出去的，安全。
    expect(groupTag).toContain('size="small"')
  })

  it('子按钮统一 borderless，激活态用独立类表达', () => {
    expect(toggle).toContain('theme="borderless"')
    expect(toggle).toContain("className={range === key ? 'is-active' : undefined}")
    // aria-pressed 是分段控件的选中态语义，必须一起给。
    expect(toggle).toContain('aria-pressed={range === key}')
  })

  it('不再用 theme 切换来表达选中态', () => {
    expect(toggle).not.toMatch(/theme=\{range === key/)
  })
})

describe('RangeToggle 样式', () => {
  it('隐藏 ButtonGroup 自动插入的分隔线（含 ::before 竖线）', () => {
    expect(SCSS).toMatch(/\.dsh-codebuddy-panel-range > \.semi-button-group-line[\s\S]{0,120}display: none/)
    expect(SCSS).toMatch(/semi-button-group-line::before[\s\S]{0,80}display: none/)
  })

  it('激活态有独立的主色实心样式', () => {
    expect(SCSS).toMatch(/\.semi-button\.is-active[\s\S]{0,200}background: var\(--dsw-alias-button-primary-fill\)/)
    // 反色文字，且带兜底，避免主色底配主色字。
    expect(SCSS).toMatch(/color: var\(--dsw-alias-label-primary-foreground, #fff\)/)
  })

  it('按钮之间没有 gap（分段控件必须是连续控件）', () => {
    const block = SCSS.slice(SCSS.indexOf('.dsh-codebuddy-panel-range {'), SCSS.indexOf('.dsh-codebuddy-panel-chart-card'))
    // 轨道自身可以有内边距，但不能出现 gap（那会在按钮之间留缝）。
    expect(block).not.toMatch(/(^|[^-])gap:\s*\d/)
  })

  it('选择器带 body[data-dsh-semi-theme] 前缀（与仓库既有主题写法一致且提高特异性）', () => {
    // 以「分段控件」注释块为起点，覆盖到下一个模块（chart-card）为止。
    const start = SCSS.indexOf('时间范围选择器（分段控件')
    const end = SCSS.indexOf('.dsh-codebuddy-panel-chart-card', start)
    expect(start).toBeGreaterThan(-1)
    const block = SCSS.slice(start, end)
    const count = (block.match(/body\[data-dsh-semi-theme\] \.dsh-codebuddy-panel-range/g) ?? []).length
    expect(count).toBeGreaterThanOrEqual(6)
  })

  it('尊重 prefers-reduced-motion', () => {
    expect(SCSS).toMatch(/prefers-reduced-motion[\s\S]{0,200}dsh-codebuddy-panel-range/)
  })
})
