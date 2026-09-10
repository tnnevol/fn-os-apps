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
