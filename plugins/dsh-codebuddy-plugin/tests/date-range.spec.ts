import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { DEFAULT_TOKEN_RANGE, optionsFor, resolveRange, setCustomRangeDays, getCustomRangeDays, rangeLabel } from '../src/client/token-range.ts'

/**
 * ④ 日期范围选择器（Semi DatePicker dateRange）与自定义档。
 *
 * 约束（用户指定）：样式**只改 semi 变量、不覆盖组件样式**；日期选择器选出的
 * 自定义窗口进入既有范围模型（custom 档），清空后回到默认档。
 */
const PANEL = readFileSync(new URL('../src/client/panel.tsx', import.meta.url), 'utf8')
const SCSS = readFileSync(new URL('../src/styles/panel-layout.scss', import.meta.url), 'utf8')
const LOCALES = readFileSync(new URL('../src/client/locales.ts', import.meta.url), 'utf8')

describe('custom 档', () => {
  it('resolveRange("custom") 使用 setCustomRangeDays 写入的窗口', () => {
    setCustomRangeDays(14)
    expect(resolveRange('custom')).toEqual({ days: 14 })
    setCustomRangeDays(1)
    expect(resolveRange('custom')).toEqual({ days: 1 })
  })

  it('窗口被夹到 [1, 365]（服务端 MAX_RANGE_DAYS 防御一致）', () => {
    setCustomRangeDays(0)
    expect(getCustomRangeDays()).toBe(1)
    setCustomRangeDays(9999)
    expect(getCustomRangeDays()).toBe(365)
    setCustomRangeDays(7.6)
    expect(getCustomRangeDays()).toBe(8)   // 取整
    setCustomRangeDays(7)                  // 还原
  })

  it('custom 不出现在按钮组选项里（由日期选择器激活）', () => {
    for (const slot of ['overview', 'trend', 'other'] as const) {
      expect(optionsFor(slot)).not.toContain('custom')
    }
  })

  it('custom 的标签为空（区间由选择器自身表达）', () => {
    const t = (k: string): string => k
    expect(rangeLabel('custom', t)).toBe('')
  })
})

describe('DatePicker 接线', () => {
  it('四个面板的头部都有日期选择器（经 PanelRangeControls 统一注入）', () => {
    // 用户要求：所有带日期档位的面板都要有日期范围控件，且放在模块标题右侧
    // （头部），不放内容面板内部。
    const ctrl = PANEL.slice(PANEL.indexOf('function PanelRangeControls'), PANEL.indexOf('function PanelRangeControls') + 1800)
    expect(ctrl).toContain('<CustomRangePicker')
  })

  it('档位切换回填日期到选择器（不发第二次查询）', () => {
    const ctrl = PANEL.slice(PANEL.indexOf('function PanelRangeControls'), PANEL.indexOf('function PanelRangeControls') + 1800)
    // onRangeChange 里同时 onDatesChange(rangeStart(key), end)
    // 实际形态：onRangeChange(key) 之后紧跟 if (key !== 'custom') → onDatesChange
    expect(ctrl).toMatch(/onRangeChange\(key\)/)
    expect(ctrl).toMatch(/if \(key !== 'custom'\) \{\s*\n\s*const end = new Date\(\)\s*\n\s*onDatesChange\(\[rangeStart\(key\), end\]\)/)
  })

  it('选择器修改 → 进入 custom 档，不回写固定档；清空 → 回默认档', () => {
    const ctrl = PANEL.slice(PANEL.indexOf('function PanelRangeControls'), PANEL.indexOf('function PanelRangeControls') + 1800)
    expect(ctrl).toMatch(/onRangeChange\('custom'\)/)
    expect(ctrl).toMatch(/onRangeChange\(DEFAULT_TOKEN_RANGE\)/)
    // 单向：选择器分支里不得回填某个固定档位名
    expect(ctrl).not.toMatch(/onRangeChange\('(?:today|7d|30d)'\)/)
  })

  it('天数换算助手：终点视为今天', () => {
    expect(PANEL).toContain('function rangeStart(')
    expect(PANEL).toMatch(/range === 'today'\) return end/)
  })

  it('包装组件对 Semi 的值形状归一（[Date,Date] 保留、空串→undefined）', () => {
    const fn = PANEL.slice(PANEL.indexOf('function CustomRangePicker'), PANEL.indexOf('function CustomRangePicker') + 1400)
    expect(fn).toMatch(/Array\.isArray\(date\) && date\[0\] instanceof Date/)
  })
})

describe('配色：只改 semi 变量，不覆盖组件样式', () => {
  it('用 --semi-color-primary* 变量上色（Semi DatePicker 的唯一上色途径）', () => {
    expect(SCSS).toMatch(/--semi-color-primary:/)
    expect(SCSS).toMatch(/--semi-color-primary-light-default:/)
  })

  it('作用域是面板头部 actions + 弹层（datepicker 挂在 body 下）', () => {
    expect(SCSS).toMatch(/\.dsh-codebuddy-token-panel-actions,\s*\n\.semi-popover \.semi-datepicker \{/)
  })

  it('不出现 .semi-datepicker-* 的**属性**覆盖（变量作用域不算）', () => {
    // 用户明确要求不随意用 scss 覆盖组件样式。变量声明（--semi-*）是合法途径；
    // 出现其它属性（color/background 等）即违规。
    const blocks = SCSS.match(/\.semi-datepicker[a-z-]*[^{]*\{([^}]*)\}/g) ?? []
    const violations = blocks.filter(b => {
      const body = b.slice(b.indexOf('{') + 1, b.lastIndexOf('}'))
      const decls = body.split(';').map(d => d.trim()).filter(Boolean)
      // 每条声明都必须是自定义属性（--semi-*）
      return decls.some(d => !d.startsWith('--'))
    })
    expect(violations).toEqual([])
  })

  it('文案键齐备（en + zh）', () => {
    for (const key of ['tokenDateStart', 'tokenDateEnd', 'tokenDateRange']) {
      const count = LOCALES.split('\n').filter(l => l.includes(`${key}:`)).length
      expect(count).toBe(2)
    }
  })
})

describe('facade 导出', () => {
  const FACADE = readFileSync(new URL('../../../packages/dsh-semi-ui/src/components.ts', import.meta.url), 'utf8')

  it('DshDatePicker 已从 facade 导出', () => {
    expect(FACADE).toContain("export { default as DshDatePicker } from '@douyinfe/semi-ui/lib/es/datePicker/index'")
  })

  it('DatePickerProps 类型可用（本地 DatePickerRangeProps 的注释说明了原因）', () => {
    expect(PANEL).toContain('interface DatePickerRangeProps')
    expect(PANEL).toMatch(/semi-foundation.*无法被 TS\s*解析|无法被 TS\n\s*\* 解析/)
  })
})

describe('默认档', () => {
  it('默认档是今天', () => {
    expect(DEFAULT_TOKEN_RANGE).toBe('today')
  })
})
