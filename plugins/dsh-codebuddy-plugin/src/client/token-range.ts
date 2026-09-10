/**
 * Token 统计各面板的时间范围模型。
 *
 * 单独成模块（不放进 panel.tsx）是为了可测：panel.tsx 一旦被 import 就会拉起
 * Semi 组件，测试环境解析不了 JSX/样式；而这里的映射（范围键 → 请求参数、标签、
 * 默认值）正是最该被测试锁住的部分。
 *
 * @module dsh-codebuddy/token-range
 */

/** 面板可选的时间范围键。 */
export type TokenRangeKey = '7d' | '30d' | '90d' | 'month' | 'all'

/** 所有面板的默认范围。 */
export const DEFAULT_TOKEN_RANGE: TokenRangeKey = '7d'

/** 固定天数键对应的天数。 */
const FIXED_DAYS: Record<'7d' | '30d' | '90d', number> = { '7d': 7, '30d': 30, '90d': 90 }

/**
 * 按面板职责分配选项：
 *
 * - 总览回答「一共用了多少」，所以给「总计」——它需要全量，不能用大 `days` 近似。
 * - 趋势回答「随时间怎么变」，所以给「本月」——它需要一个有意义的当前窗口。
 *
 * 两者不互换：把「总计」放到趋势上，逐日柱状图会退化成一根巨柱；把「本月」放到
 * 总览上，则与其他三个窗口重复。
 */
const OPTIONS: Record<'overview' | 'trend' | 'other', readonly TokenRangeKey[]> = {
  overview: ['7d', '30d', '90d', 'all'],
  trend: ['7d', '30d', '90d', 'month'],
  other: ['7d', '30d', '90d'],
}

export type TokenRangeSlot = keyof typeof OPTIONS

export function optionsFor(slot: TokenRangeSlot): readonly TokenRangeKey[] {
  return OPTIONS[slot]
}

/**
 * 把范围键解析成服务端请求参数。
 *
 * 「本月」用 `days = 今天几号` 表达：服务端的下界是
 * `startOfLocalDay(now - (days - 1) * DAY_MS)`，代入即得本月 1 号 00:00，
 * 因此这是精确的日历月起点，不需要服务端额外支持「月」这种单位。
 *
 * @param now 便于测试注入当前时间。
 */
export function resolveRange(key: TokenRangeKey, now: Date = new Date()): { days: number, allTime?: boolean } {
  if (key === 'all') return { days: 0, allTime: true }
  if (key === 'month') return { days: now.getDate() }
  return { days: FIXED_DAYS[key] }
}

/**
 * 范围标签。
 *
 * `Translate` 不支持插值，故用前后缀拼接；「本月」「总计」是独立词，直接取整词。
 */
export function rangeLabel(
  key: TokenRangeKey,
  t: (k: 'tokenRangePrefix' | 'tokenRangeSuffix' | 'tokenRangeMonth' | 'tokenRangeAll') => string,
): string {
  if (key === 'month') return t('tokenRangeMonth')
  if (key === 'all') return t('tokenRangeAll')
  return `${t('tokenRangePrefix')}${FIXED_DAYS[key]}${t('tokenRangeSuffix')}`
}
