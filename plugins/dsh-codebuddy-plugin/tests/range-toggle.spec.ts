import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 时间范围选择器：**完全使用 Semi 原生样式**，不做任何外观覆盖。
 *
 * 对比度不需要我们操心：`packages/dsh-semi-ui` 的 theme.scss 已为
 * `.semi-button-primary.semi-button-solid` 分浅色/深色指定了「底色 + 文字色」：
 *   浅色主题：bluish-1000(#0f1115) 底 + bluish-00(#fff) 字
 *   深色主题：bluish-00 底 + bluish-1000 字
 * 两套都是硬编码的高对比配对，因此插件侧不该再覆盖文字色。
 *
 * 同理，ButtonGroup 自动插入的 `<span class="semi-button-group-line-*">` 是组件
 * 正常产物，原生样式下渲染正常，不该强制 display:none。
 */
const TOGGLE = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/ui/range-toggle.tsx',
  'utf8',
)
const SCSS = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/styles/token-panel.scss',
  'utf8',
)
const INDEX_SCSS = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/styles/index.scss',
  'utf8',
)

describe('RangeToggle 结构（Semi 原生主题）', () => {
  const toggle = TOGGLE.slice(TOGGLE.indexOf('export function RangeToggle'), TOGGLE.indexOf('RangeToggleImpl = RangeToggle'))

  it('激活项用 Semi 的 solid + primary，其余用 borderless', () => {
    expect(toggle).toContain("theme={range === key ? 'solid' : 'borderless'}")
    expect(toggle).toContain("type={range === key ? 'primary' : 'tertiary'}")
  })

  it('ButtonGroup 上不传 theme / type（否则会覆盖子按钮，激活态失效）', () => {
    const groupTag = /<DshButtonGroup[\s\S]*?>/.exec(toggle)?.[0] ?? ''
    expect(groupTag).not.toContain('theme=')
    expect(groupTag).not.toContain('type=')
    expect(groupTag).toContain('size="small"')
  })

  it('aria-pressed 表达选中态（纯视觉的 theme 切换对读屏不可见）', () => {
    expect(toggle).toContain('aria-pressed={range === key}')
  })

  it('不使用 SplitButtonGroup（组件来自 facade 的 DshButtonGroup）', () => {
    expect(toggle).toContain('<DshButtonGroup')
    const code = TOGGLE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(code).not.toContain('SplitButton')
  })
})

describe('RangeToggle 不做外观覆盖', () => {
  it('不覆盖按钮底色 / 圆角 / 文字色 / hover / focus', () => {
    // 这些都是「样式覆盖」的典型项，全部交回 Semi 原生规则。
    expect(SCSS).not.toMatch(/panel-range\s*>\s*\.semi-button\s*\{/)
    expect(SCSS).not.toMatch(/panel-range\s*>\s*\.semi-button[-\w.:()]*\s*\{/)
  })

  it('不隐藏 ButtonGroup 的分隔线（那是组件正常产物）', () => {
    expect(SCSS).not.toMatch(/dsh-codebuddy-panel-range\s*[^{]*semi-button-group-line[^{]*\{/)
  })

  it('组容器上没有 gap（有间隙会把「一组」拆散）', () => {
    // 这条曾真实存在：index.scss 里一条旧布局规则带着 gap: 8px。
    for (const source of [SCSS, INDEX_SCSS]) {
      expect(source).not.toMatch(/\.dsh-codebuddy-panel-range \{[^}]*gap/)
    }
  })

  it('保留的 panel-range 规则只做响应式布局（width / justify-content）', () => {
    const rules = SCSS.match(/[^{}]*\.dsh-codebuddy-panel-range[^{}]*\{[^}]*\}/g) ?? []
    for (const rule of rules) {
      const body = rule.slice(rule.indexOf('{') + 1, rule.lastIndexOf('}'))
      // 允许的属性仅限布局项；出现 background/color/border 之类即为外观覆盖。
      expect(body).toMatch(/^\s*(width|justify-content|flex|min-width)\s*:/)
    }
  })
})
