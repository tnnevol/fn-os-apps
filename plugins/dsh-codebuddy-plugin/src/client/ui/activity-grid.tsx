/**
 * CodeBuddy Token 活动热力图：把 365 天的活跃度格子化。
 *
 * 拆分理由：大量几何计算 + JS 量宽回调 + cell 数组构造挤在 panel.tsx 里
 * 会模糊 TokenStatsPage 的渲染结构；这里专门承担「表格视觉」的关注点。
 *
 * 视觉对齐靠 `--dcb-cell-size` 一个变量同时控制月份行 / 热力图 / 星期列：
 * 由 `activityCellSize` (来自 activity-grid.ts) 在 JS 里一次算得；CSS 端只
 * 消费这个值。
 *
 * @module dsh-codebuddy/ui/activity-grid
 */

import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { DshTooltip } from '@tnnevol/dsh-semi-ui'
import type { TokenStats } from '../panel-types.ts'
import { activityCellSize } from '../activity-grid.ts'
import { compact } from './loading-shared.tsx'

/** 一年中 day 字符串（YYYY-MM-DD）对应的星期序号。 */
function activityWeekdayImpl(day: string): number {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number)
  return new Date(year, month - 1, date).getDay()
}

export function ActivityGridImpl({ activity, callSuffix }: {
  activity: TokenStats['activity']
  callSuffix: string
}): ReactNode {
  const max = Math.max(1, ...activity.map(item => item.tokens))
  const leading = activity[0] === undefined ? 0 : activityWeekdayImpl(activity[0].day)
  const cells: Array<TokenStats['activity'][number] | undefined> = [
    ...Array.from({ length: leading }, () => undefined),
    ...activity,
  ]
  while (cells.length % 7 !== 0) cells.push(undefined)
  const weekCount = Math.max(1, cells.length / 7)
  const monthLabels: string[] = []
  let previousMonth = ''
  for (let week = 0; week < weekCount; week += 1) {
    const weekCells = cells.slice(week * 7, week * 7 + 7)
    const firstDay = weekCells.find(item => item !== undefined)?.day
    const month = firstDay?.slice(5, 7) ?? ''
    monthLabels.push(month !== '' && month !== previousMonth ? `${Number(month)}月` : '')
    if (month !== '') previousMonth = month
  }

  /**
   * 让 53 周正好铺满内容区。
   *
   * 为什么用 JS 量宽而不是纯 CSS：热力图是**列优先**（一周一列、一天一行），
   * 而「一/三/五」星期标签在**另一列**里、按行对齐。星期列自有宽度（18px），
   * 无法从热力图列宽反推行高——纯 CSS 下两者的行高必然逐渐错位。所以这里量一次
   * 可用宽度，算出统一的格子边长写进 CSS 变量，三处（月份行、热力图、星期列）
   * 共用同一个值，对齐由构造保证。
   */
  const shellRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const shell = shellRef.current
    if (shell === null) return
    const applyCellSize = (): void => {
      const width = shell.clientWidth
      if (width <= 0) return
      shell.style.setProperty('--dcb-cell-size', `${activityCellSize(width, weekCount).toFixed(2)}px`)
    }
    applyCellSize()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', applyCellSize)
      return () => { window.removeEventListener('resize', applyCellSize) }
    }
    const observer = new ResizeObserver(applyCellSize)
    observer.observe(shell)
    return () => { observer.disconnect() }
  }, [weekCount])

  return (
    <div
      className="dsh-codebuddy-token-activity-shell"
      ref={shellRef}
      style={{ '--dcb-week-count': String(weekCount) } as CSSProperties}
    >
      <div className="dsh-codebuddy-token-weekdays" aria-hidden="true"><span /><span>一</span><span /><span>三</span><span /><span>五</span><span /></div>
      <div className="dsh-codebuddy-token-activity-scroll">
        <div className="dsh-codebuddy-token-months" aria-hidden="true">
          {monthLabels.map((label, index) => <span key={`${index}-${label}`}>{label}</span>)}
        </div>
        <div className="dsh-codebuddy-token-activity-grid" role="img" aria-label="最近一年 CodeBuddy Token 活动热力图">
          {cells.map((item, index) => {
            if (item === undefined) return <span key={`padding-${index}`} className="is-padding" aria-hidden="true" />
            const level = item.tokens === 0 ? 0 : Math.min(4, Math.ceil((item.tokens / max) * 4))
            return (
              <DshTooltip key={item.day} content={`${item.day} · ${compact(item.tokens)} · ${item.calls}${callSuffix}`}>
                <span className={`level-${level}`} />
              </DshTooltip>
            )
          })}
        </div>
      </div>
    </div>
  )
}
