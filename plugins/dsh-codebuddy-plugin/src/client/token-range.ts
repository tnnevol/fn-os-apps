/**
 * Token 统计各面板的时间范围模型。
 *
 * 单独成模块（不放进 panel.tsx）是为了可测：panel.tsx 一旦被 import 就会拉起
 * Semi 组件，测试环境解析不了 JSX/样式；而这里的映射（范围键 → 请求参数、标签、
 * 默认值）正是最该被测试锁住的部分。
 *
 * @module dsh-codebuddy/token-range
 */

/** 面板可选的时间范围键。`custom` 表示日期范围选择器选出的任意窗口。 */
export type TokenRangeKey = 'today' | '7d' | '30d' | 'custom'

/** 所有面板的默认范围：今天。 */
export const DEFAULT_TOKEN_RANGE: TokenRangeKey = 'today'

/**
 * 「自定义」档的窗口天数（由日期范围选择器写入）。
 *
 * 选择器的终点总是「今天」——服务端的窗口就是「以今天为终点的 N 天」，
 * 没有任意起止区间的参数；因此用户选 [start, end] 时按 `start` 相对今天的天数
 * 取窗口（若 end 不是今天，取到 end 为止的语义由展示层用数据近似）。
 *
 * 注意这不是常量：它由 `setCustomRangeDays` 写入，`resolveRange('custom')` 读取。
 * 放模块级而不是组件 state，是因为缓存与请求解析都在组件外。
 */
let customDays = 1

/** 日期范围选择器选出的窗口写入这里（终点视为今天）。 */
export function setCustomRangeDays(days: number): void {
  const rounded = Math.max(1, Math.min(365, Math.round(days)))
  customDays = rounded
}

/** 读取当前自定义窗口的天数。 */
export function getCustomRangeDays(): number {
  return customDays
}

/** 固定天数键对应的天数。 */
const FIXED_DAYS: Record<'7d' | '30d', number> = { '7d': 7, '30d': 30 }

/**
 * 各面板的选项（统一：今天 / 近 7 天 / 近 30 天 / 自定义）。
 *
 * 曾经按面板职责分配不同档位（总览给「总计」、趋势给「本月」、其余给
 * 「7/30/90 天」），现已收敛为一组：「总计」与「近 90 天」移除、「本月」移除、
 * 新增「今天」。按面板分配的前提是各面板回答的问题需要不同窗口；实际使用中
 * 读者只关心最近的情况，多档位反而让界面显得复杂。
 *
 * `custom` 不出现在按钮组里——它由日期范围选择器激活，按钮组里没有可点的
 * 「自定义」档（选中自定义时按钮组无高亮，属于预期）。
 */
const OPTIONS: Record<'overview' | 'trend' | 'other', readonly TokenRangeKey[]> = {
  overview: ['today', '7d', '30d'],
  trend: ['today', '7d', '30d'],
  other: ['today', '7d', '30d'],
}

export type TokenRangeSlot = keyof typeof OPTIONS

export function optionsFor(slot: TokenRangeSlot): readonly TokenRangeKey[] {
  return OPTIONS[slot]
}

/**
 * 把范围键解析成服务端请求参数。
 *
 * 「今天」用 `days = 1` 表达：服务端的下界是
 * `startOfLocalDay(now - (days - 1) * DAY_MS)`，代入即得今天 00:00。
 * `custom` 用 `setCustomRangeDays` 写入的窗口。
 *
 * @param now 便于测试注入当前时间。
 */
export function resolveRange(key: TokenRangeKey, now: Date = new Date()): { days: number, allTime?: boolean } {
  if (key === 'today') return { days: 1 }
  if (key === 'custom') return { days: customDays }
  return { days: FIXED_DAYS[key] }
}

/**
 * 范围标签。
 *
 * `Translate` 不支持插值，故用前后缀拼接；「今天」是独立词，直接取整词。
 * `custom` 的标签由日期选择器自身表达（选中的区间就显示在输入框里），不另拼文案。
 */
export function rangeLabel(
  key: TokenRangeKey,
  t: (k: 'tokenRangePrefix' | 'tokenRangeSuffix' | 'tokenRangeToday') => string,
): string {
  if (key === 'today') return t('tokenRangeToday')
  if (key === 'custom') return ''
  return `${t('tokenRangePrefix')}${FIXED_DAYS[key]}${t('tokenRangeSuffix')}`
}
