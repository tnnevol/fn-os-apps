/**
 * Token 统计面板的时间范围模型。
 *
 * **本模块不再提供日期范围选择**：面板只保留固定档位（today / 7d / 30d），
 * 时间区间在请求时刻由 `resolveRange` 根据当前时间计算，传给 host 的端点
 * 形如 `{ startTime, endTime, allTime? }`。这是与「从请求时刻倒退 N 天」旧
 * 行为的彻底分离：服务端不再自己拼区间。
 *
 * 单独成模块（不放进 panel.tsx）有两个理由：
 *  1. 这里是纯映射，能脱离 React/Semi 单测。
 *  2. `useTokenStats` 与 `TokenStatsStore` 都直接消费这套键，是 host 端
 *     `panelStatus` / `tokenStats` RPC 的客户端契约面。
 *
 * @module dsh-codebuddy/token-range
 */

/**
 * 面板可选的时间范围键。**全部为固定档**（today / 7d / 30d / 90d）：
 * 自定义区间业务已下线，不再提供 `custom` 档。
 *
 * `90d` 是**可选档**——只对调用趋势（trend）这类"按较长周期看分布"的面板开放；
 * 总览、分布、会话排名等仍走 today/7d/30d 三档。`90d` 走同样的端点解析路径
 * （`startTime = endTime - 89 天`），不需要 host 端新增 RPC 类型。
 */
export type TokenRangeKey = 'today' | '7d' | '30d' | '90d'

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

/** `optionsFor(slot)` 把上述 OPTIONS 表暴露给调用方。 */
export type TokenRangeSlot = keyof typeof OPTIONS

export function optionsFor(slot: TokenRangeSlot): readonly TokenRangeKey[] {
  return OPTIONS[slot]
}

/**
 * 范围键解析后的服务端入参形状。
 *
 * 窗口用「毫秒时间戳区间」表达：服务端整段计算闭环于这两个端点，不读
 * `Date.now()`。`allTime` 用于按需放宽 totals 的下界过滤；它与端点是**正交**
 * 的两个概念——`allTime` 不改变端点本身（端点仍用于活动热力图与逐日行数），
 * 只是让 totals 不再按下界过滤。
 */
export interface ResolvedTokenRange {
  /** 窗口下界（毫秒时间戳，含），由 `resolveRange` 按当前时间计算。 */
  startTime: number
  /** 窗口上界（毫秒时间戳，含），通常为今天 00:00。 */
  endTime: number
  /** 不做时间下界过滤：统计全部历史。 */
  allTime?: boolean
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
