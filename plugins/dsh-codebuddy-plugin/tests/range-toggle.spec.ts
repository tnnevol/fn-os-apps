import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 时间范围选择器：**用 Semi 原生样式**，并保证激活态对比度。
 *
 * 两条看起来冲突、实则同源的要求：
 *
 * - 「默认使用 Semi demo 中的样式，不做样式覆盖」→ 激活用 `theme="solid"`、
 *   其余 `theme="borderless"`，不自定义底色/圆角/hover。
 * - 「激活状态确保文字与背景有对比」→ 不可完全依赖 Semi：它把实心按钮的文字
 *   写死为 `rgba(var(--semi-white), 1)`（内置 255,255,255 纯白），而 DSH 的
 *   `--dsw-alias-button-primary-fill` 在**深色主题**下解析为浅色
 *   （→ brand-primary → bluish-50），白字对比度仅 1.08:1，几乎不可读。
 *   因此激活项的文字色必须换成随主题翻转的
 *   `--dsw-alias-label-primary-foreground`（浅色主题白 / 深色主题近黑）。
 *
 * 实测对比度：浅色 18.9:1、深色 17.0:1，两个主题都达标。
 */
const PANEL = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/panel.tsx',
  'utf8',
)
const SCSS = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/styles/panel-layout.scss',
  'utf8',
)
const INDEX_SCSS = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/styles/index.scss',
  'utf8',
)

describe('RangeToggle 结构（Semi 原生主题）', () => {
  const toggle = PANEL.slice(PANEL.indexOf('function RangeToggle'), PANEL.indexOf('function BreakdownList'))

  it('激活项用 Semi 的 solid + primary，其余用 borderless', () => {
    expect(toggle).toContain("theme={range === key ? 'solid' : 'borderless'}")
    expect(toggle).toContain("type={range === key ? 'primary' : 'tertiary'}")
  })

  it('ButtonGroup 上不传 theme / type（否则会覆盖子按钮，激活态失效）', () => {
    // ButtonGroup 合并子 props 的顺序是 {disabled,size,type} → itm.props → rest，
    // theme 不在其解构出的键里，会落进 rest 并覆盖子按钮。
    const groupTag = /<DshButtonGroup[\s\S]*?>/.exec(toggle)?.[0] ?? ''
    expect(groupTag).not.toContain('theme=')
    expect(groupTag).not.toContain('type=')
    expect(groupTag).toContain('size="small"')
  })

  it('aria-pressed 表达选中态（纯视觉的 theme 切换对读屏不可见）', () => {
    expect(toggle).toContain('aria-pressed={range === key}')
  })

  it('不再用自定义 is-active 类表达激活态', () => {
    expect(toggle).not.toContain('is-active')
  })
})

describe('RangeToggle 样式（最小必要覆盖）', () => {
  it('隐藏 ButtonGroup 自动插入的分隔线（含 ::before 竖线）', () => {
    expect(SCSS).toMatch(/\.dsh-codebuddy-panel-range > \.semi-button-group-line[\s\S]{0,120}display: none/)
    expect(SCSS).toMatch(/semi-button-group-line::before[\s\S]{0,80}display: none/)
  })

  it('激活项文字色用随主题翻转的 foreground（保证对比度）', () => {
    expect(SCSS).toMatch(/\.semi-button-primary\.semi-button-solid \{[\s\S]{0,120}label-primary-foreground/)
  })

  it('不自定义底色 / 圆角 / hover / focus（保留 Semi 默认外观）', () => {
    // 这些是「样式覆盖」的典型项，交给 Semi 原生规则处理。
    expect(SCSS).not.toMatch(/panel-range > \.semi-button \{[^}]*background: transparent/)
    expect(SCSS).not.toMatch(/panel-range > \.semi-button \{[^}]*border-radius: 6px/)
    expect(SCSS).not.toMatch(/panel-range > \.semi-button:not\(\.is-active\)/)
    expect(SCSS).not.toMatch(/panel-range > \.semi-button:focus-visible/)
  })

  it('组容器上没有 gap（有间隙就会把「一组」拆散）', () => {
    // 这条曾真实存在：index.scss 里一条旧布局规则带着 gap: 8px，是「按钮之间有
    // 缝隙」的实际来源，与 ButtonGroup 无关。
    for (const source of [SCSS, INDEX_SCSS]) {
      expect(source).not.toMatch(/\.dsh-codebuddy-panel-range \{[^}]*gap/)
    }
  })
})
