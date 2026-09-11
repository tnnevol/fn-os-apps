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
  it('分布面板的工具栏里有 CustomRangePicker', () => {
    const block = PANEL.slice(PANEL.indexOf("title={t('tokenDistribution')}"), PANEL.indexOf("title={t('tokenTopSessions')}"))
    expect(block).toContain('<CustomRangePicker')
  })

  it('选择自定义区间 → 进入 custom 档；清空 → 回默认档', () => {
    const block = PANEL.slice(PANEL.indexOf('<CustomRangePicker'), PANEL.indexOf('<CustomRangePicker') + 700)
    expect(block).toMatch(/setDistributionRange\('custom'\)/)
    expect(block).toMatch(/setDistributionRange\(DEFAULT_TOKEN_RANGE\)/)
  })

  it('天数计算：终点视为今天、至少 1 天', () => {
    const block = PANEL.slice(PANEL.indexOf('<CustomRangePicker'), PANEL.indexOf('<CustomRangePicker') + 700)
    // Math.max(1, ceil((now - start)/DAY) + 1)
    expect(block).toMatch(/Math\.max\(1, Math\.ceil\(\(Date\.now\(\) - range\[0\]\.getTime\(\)\) \/ 86_400_000\) \+ 1\)/)
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

  it('作用域是工具栏 + 弹层（datepicker 挂在 body 下）', () => {
    expect(SCSS).toMatch(/\.dsh-codebuddy-token-card-toolbar,\s*\n\.semi-popover \.semi-datepicker \{/)
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
