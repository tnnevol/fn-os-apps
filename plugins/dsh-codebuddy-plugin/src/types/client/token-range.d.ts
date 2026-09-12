
/** CodeBuddy 类型声明；由原模块抽取，运行时实现保留在 src 下。 */

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
/** `optionsFor(slot)` 把上述 OPTIONS 表暴露给调用方。 */
export type TokenRangeSlot = 'overview' | 'trend' | 'other'
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
