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
const SCSS = readFileSync(new URL('../src/styles/token-panel.scss', import.meta.url), 'utf8')
const LOCALES_EN = readFileSync(new URL('../src/client/locales/en.ts', import.meta.url), 'utf8')
const LOCALES_ZH = readFileSync(new URL('../src/client/locales/zh.ts', import.meta.url), 'utf8')

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
  it('四个面板的头部都有日期选择器（TokenPanel 头部直接渲染）', () => {
    // 用户要求：所有带日期档位的面板都要有日期范围控件，且放在模块标题右侧
    // （头部），不放内容面板内部。日期选择器在左侧组（标题旁）。
    const head = PANEL.slice(PANEL.indexOf('dsh-codebuddy-token-panel-head'), PANEL.indexOf('PanelBody loading'))
    expect(head).toContain('<CustomRangePicker')
    expect(head).toMatch(/token-panel-lead[\s\S]{0,400}<CustomRangePicker/)
  })

  it('档位切换回填日期到选择器（不发第二次查询）', () => {
    const head = PANEL.slice(PANEL.indexOf('dsh-codebuddy-token-panel-head'), PANEL.indexOf('PanelBody loading'))
    // RangeToggle 的 onChange：onRangeChange(key) 之后立即 onDatesChange([rangeStart(key), 今天])
    expect(head).toMatch(/onRangeChange\(key\)\s*\n\s*onDatesChange\(\[rangeStart\(key\), new Date\(\)\]\)/)
  })

  it('选择器修改 → 先写窗口天数再进 custom 档，不回写固定档', () => {
    const head = PANEL.slice(PANEL.indexOf('dsh-codebuddy-token-panel-head'), PANEL.indexOf('PanelBody loading'))
    // 实现形态：const days = …; setCustomRangeDays(days); onDatesChange; onRangeChange('custom')
    const days = head.indexOf('setCustomRangeDays(days)')
    const enter = head.indexOf("onRangeChange('custom')")
    expect(days).toBeGreaterThan(-1)
    expect(enter).toBeGreaterThan(days)
    // 单向：不得回写某个固定档位名
    expect(head).not.toMatch(/onRangeChange\('(?:today|7d|30d)'\)/)
  })

  it('选择器非空（清自定义通过点固定档完成，不留白）', () => {
    // 日期显示非空与「档位→选择器」的回填一致：两者始终展示同一区间。
    expect(PANEL).toMatch(/dates: \[Date, Date\]\n/)
    expect(PANEL).not.toMatch(/dates: \[Date, Date\] \| undefined/)
  })

  it('禁止选择今天之后的日期', () => {
    const fn = PANEL.slice(PANEL.indexOf('function CustomRangePicker'), PANEL.indexOf('function todayRange'))
    expect(fn).toMatch(/disabledDate/)
    expect(fn).toMatch(/startOfDay\(new Date\(\)\)\.getTime\(\)/)
  })

  it('初始 dates 是今天的区间（与默认档一致）', () => {
    expect(PANEL).toMatch(/function todayRange\(\)/)
    // 四个面板都以 todayRange 初始化
    const inits = PANEL.match(/useState<\[Date, Date\]>\(todayRange\)/g) ?? []
    expect(inits.length).toBe(4)
  })

  it('天数换算助手：终点视为今天', () => {
    expect(PANEL).toContain('function rangeStart(')
    expect(PANEL).toMatch(/range === 'today'\) return end/)
  })

  it('包装组件：值形状归一 + 半受控延迟提交（仅完整区间回调）', () => {
    const fn = PANEL.slice(PANEL.indexOf('function CustomRangePicker'), PANEL.indexOf('function todayRange'))
    // 1. 值形状归一：[Date, Date] 保留、空串 → undefined
    expect(fn).toMatch(/Array\.isArray\(date\) && date\[0\] instanceof Date/)
    // 2. 半受控：start === end 时只更草稿、不调用外层 onChange
    expect(fn).toMatch(/start\.getTime\(\) === end\.getTime\(\)/)
    expect(fn).toMatch(/setDraft\(\[start, end\]\)/)
    // 3. 完整区间才提交：start !== end → onChange(range)
    expect(fn).toMatch(/onChange\(range\)/)
    // 4. 草稿与外层 value 同步：value 变化时重置 draft
    expect(fn).toMatch(/setDraft\(null\)\s*\}\s*,\s*\[value\[0\]\.getTime\(\),\s*value\[1\]\.getTime\(\)\]\)/)
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
      // 按语言文件检查：en 与 zh 各出现一次（locales 已按语言拆分）
      expect(LOCALES_EN.split('\n').filter(l => l.includes(`${key}:`)).length).toBe(1)
      expect(LOCALES_ZH.split('\n').filter(l => l.includes(`${key}:`)).length).toBe(1)
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

describe('选择自定义区间必须真正生效（回归）', () => {
  const PANEL_LIVE = readFileSync(new URL('../src/client/panel.tsx', import.meta.url), 'utf8')

  it('选择器的 onChange 里必须写入 custom 窗口天数', () => {
    /**
     * 曾有的回归：onChange 只调 `onRangeChange('custom')`，但**没有**先
     * `setCustomRangeDays(天数)`。于是 `resolveRange('custom')` 恒返回初始值 1，
     * 选任何区间数据都不变——用户看到「选了日期但面板没反应」。
     */
    const ctrl = PANEL_LIVE.slice(PANEL_LIVE.indexOf('dsh-codebuddy-token-panel-head'), PANEL_LIVE.indexOf('PanelBody loading'))
    // onChange 分支里必须先写天数再进 custom。
    // 注意 indexOf 会撞上**注释里的同名字样**（回归说明注释恰好引用了这两个调用），
    // 因此只认**代码行**：行首缩进 + 无注释前缀（* 或 //）。
    const codeLine = (token: string): number => {
      for (const [offset, line] of ctrl.split('\n').entries()) {
        if (line.includes(token) && !line.trim().startsWith('*') && !line.trim().startsWith('//')) {
          return offset
        }
      }
      return -1
    }
    const setDays = codeLine('setCustomRangeDays(days)')
    const enterCustom = codeLine("onRangeChange('custom')")
    expect(setDays).toBeGreaterThan(-1)
    expect(enterCustom).toBeGreaterThan(setDays)
  })

  it('写入的天数 = 起点相对今天的天数（至少 1）', () => {
    const ctrl = PANEL_LIVE.slice(PANEL_LIVE.indexOf('dsh-codebuddy-token-panel-head'), PANEL_LIVE.indexOf('PanelBody loading'))
    // 实现形态：const days = Math.max(1, …); setCustomRangeDays(days)
    expect(ctrl).toMatch(/const days = Math\.max\(1, Math\.ceil\([\s\S]{0,120}setCustomRangeDays\(days\)/)
  })
})
