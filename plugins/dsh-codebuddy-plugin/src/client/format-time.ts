/**
 * 时间格式化。
 *
 * 单独成模块（不放进 panel.tsx）是为了可测：panel.tsx 一旦被 import 就会拉起
 * Semi 组件，测试环境解析不了 JSX/样式。
 *
 * @module dsh-codebuddy/format-time
 */

import dayjs from 'dayjs'

/**
 * 把毫秒时间戳格式化成 `yyyy-MM-dd HH:mm:ss`。
 *
 * 用 dayjs 而不是 `toLocaleString()`：后者的分隔符与顺序随运行环境 locale 变化
 * （`2026/9/10 下午12:40:30`、`9/10/2026, 12:40:30 PM` 等），而这里要的是**固定
 * 布局**的时间戳——它会随每次刷新跳动，格式不稳定会让读者难以扫视比较。
 *
 * 时间戳缺失或非法时返回 `—`，而不是 "Invalid Date"。
 */
export function formatUpdatedAt(timestamp: number | undefined): string {
  if (timestamp === undefined || !Number.isFinite(timestamp) || timestamp <= 0) return '—'
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')
}

/**
 * 把服务端返回的重置时间字符串裁到「日」。
 *
 * 服务端给的是完整时间戳（实测形如 `2026-10-10 15:47:09`，见
 * `normalizeResetTime`）。账号卡片上它只是套餐行的次要信息，跟在
 * 「已用 / 总量」之后，秒级精度既读不出也占宽度；同一天到期的多个套餐还会因为
 * 时分秒不同而看起来是不同日期，反而干扰扫视。
 *
 * 只取日期部分是**字符串裁剪**而非 Date 解析：这是展示层的格式收缩，不是时间
 * 计算，用 Date 会引入时区转换风险（服务端给的是无时区标记的本地时间字符串，
 * 被当成 UTC 解析后在东八区会显示成前一天）。
 *
 * 无法识别为 `YYYY-MM-DD` 前缀时原样返回，避免把未知格式截成空串。
 */
export function formatResetDate(resetsAt: string | null | undefined): string {
  if (resetsAt === null || resetsAt === undefined) return '—'
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(resetsAt.trim())
  return match === null ? resetsAt : match[1]!
}

/** 陈旧提示的阈值：超过这么久才提示，避免每次刷新都跳出来。 */
export const STALE_HINT_AFTER_MS = 2 * 60_000

/**
 * 额度数据「有多旧」的相对描述；**数据足够新时返回 `null`**。
 *
 * 返回 `null` 而不是「刚刚」是刻意的：面板**没有自动刷新**，正常情况下数据就
 * 是打开时那一刻的，显示「刚刚」既无信息量又占用每张卡片的宽度。只有在数据陈旧
 * 到值得用户点刷新时才提示：
 *
 *   - 面板开着不动（无自动刷新，可以陈旧很久）
 *   - 命中统探测的 30s TTL 缓存（刷新了但拿到的是缓存快照）
 *
 * 超过一天只说「N 天前」，秒级/分钟级精度在那个尺度上没有意义。
 * @param probedAt - 数据产出时刻（epoch ms）。
 * @param now - 当前时刻；显式传入以便测试。
 * @returns 相对时间描述，或 `null` 表示不必提示。
 */
export function formatProbeAge(probedAt: number | undefined, now: number = Date.now()): string | null {
  if (probedAt === undefined || !Number.isFinite(probedAt) || probedAt <= 0) return null
  const age = now - probedAt
  // 时钟回拨（age 为负）不提示：那不是「数据陈旧」，且提示会误导。
  if (age < STALE_HINT_AFTER_MS) return null
  const minutes = Math.floor(age / 60_000)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}
