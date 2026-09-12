import type { TokenRangeKey, TokenRangeSlot, ResolvedTokenRange } from '../types/client/token-range'
export type { TokenRangeKey, TokenRangeSlot, ResolvedTokenRange } from '../types/client/token-range'


/** 所有面板的默认范围：今天。 */
export const DEFAULT_TOKEN_RANGE: TokenRangeKey = 'today'

/** 固定天数键对应的天数。 */
const FIXED_DAYS: Record<'7d' | '30d' | '90d', number> = { '7d': 7, '30d': 30, '90d': 90 }

/**
 * 各面板的选项。
 *
 * 「调用趋势」（trend）模块：周期更长才有看头（90 天分布），所以**去掉「今天」档**、
 * 改为 `7d / 30d / 90d` 三档。其它模块（总览、分布、会话排名）仍走
 * `today / 7d / 30d`——近 90 天的总量/工作区聚合对它们意义不大。
 */
const OPTIONS: Record<'overview' | 'trend' | 'other', readonly TokenRangeKey[]> = {
  overview: ['today', '7d', '30d'],
  trend: ['7d', '30d', '90d'],
  other: ['today', '7d', '30d'],
}

/**
 * 趋势模块的默认档位：`'today'` 已被 trend 排除，所以首次进入时挑一个真实可选的
 * 档（`7d`），避免出现"按钮组全灭 / 没有任何高亮"的状态。
 */
export const DEFAULT_TREND_RANGE: TokenRangeKey = '7d'

export function optionsFor(slot: TokenRangeSlot): readonly TokenRangeKey[] {
  return OPTIONS[slot]
}

/** 取本地零点（年-月-日）。 */
function startOfLocalDay(now: Date): number {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return date.getTime()
}

/**
 * 把范围键解析成毫秒时间戳区间。
 *
 * 「今天」用 `startTime = endTime = 今天 00:00` 表达：`event.time >= startTime`
 * 把今天 0 点之前的事件排除，符合「只看今天」的口径。
 *
 * @param now 便于测试注入当前时间；不传则用真实 `new Date()`。
 */
export function resolveRange(key: TokenRangeKey, now: Date = new Date()): ResolvedTokenRange {
  const end = startOfLocalDay(now)
  if (key === 'today') return { startTime: end, endTime: end }
  const days = FIXED_DAYS[key]
  return { startTime: end - (days - 1) * 86_400_000, endTime: end }
}

/**
 * 范围标签。
 *
 * `Translate` 不支持插值，故用前后缀拼接；「今天」是独立词，直接取整词。
 */
export function rangeLabel(
  key: TokenRangeKey,
  t: (k: 'tokenRangePrefix' | 'tokenRangeSuffix' | 'tokenRangeToday') => string,
): string {
  if (key === 'today') return t('tokenRangeToday')
  return `${t('tokenRangePrefix')}${FIXED_DAYS[key]}${t('tokenRangeSuffix')}`
}
