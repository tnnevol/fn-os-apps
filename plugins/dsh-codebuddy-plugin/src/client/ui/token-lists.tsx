/**
 * Token 用量分布的三种列表的实现。panel.tsx 中保留同名简短的委派函数
 * （兼容静态文本扫描的测试），业务逻辑全部实现于本文件。
 *
 * @module dsh-codebuddy/ui/token-lists
 */

import type { ReactNode } from 'react'
import { DshTypography } from '@tnnevol/dsh-semi-ui'
import type { TokenStats } from '../panel-types.ts'
import { compact } from './loading-shared.tsx'

/** 通用排行（name + 调用次数 + 占比条 + 数值）。items 已按数值降序。 */
export function BreakdownListImpl({ items, empty }: {
  items: TokenStats['models']
  empty: string
}): ReactNode {
  if (items.length === 0) return <div className="dsh-codebuddy-token-empty">{empty}</div>
  return (
    <div className="dsh-codebuddy-token-breakdown-list">
      {items.slice(0, 6).map((item, index) => (
        <div key={item.name} className="dsh-codebuddy-token-breakdown-row">
          <div className="dsh-codebuddy-token-breakdown-label">
            <span className="dsh-codebuddy-token-rank">{String(index + 1).padStart(2, '0')}</span>
            <DshTypography.Text strong className="dsh-codebuddy-token-breakdown-name" ellipsis={{ showTooltip: true }}>{item.name}</DshTypography.Text>
            <small>{item.calls} 次</small>
          </div>
          <div className="dsh-codebuddy-token-breakdown-track"><i style={{ width: `${Math.min(100, item.percent)}%` }} /></div>
          <span className="dsh-codebuddy-token-breakdown-value">{compact(item.total)}</span>
        </div>
      ))}
    </div>
  )
}

/** 工作区维度排行：用 path 作 tooltip，name 作主标题。 */
export function WorkspaceListImpl({ items, empty }: {
  items: TokenStats['workspaces']
  empty: string
}): ReactNode {
  if (items.length === 0) return <div className="dsh-codebuddy-token-empty">{empty}</div>
  return (
    <div className="dsh-codebuddy-token-breakdown-list">
      {items.slice(0, 6).map((item, index) => (
        <div key={`${item.name}-${item.path ?? ''}`} className="dsh-codebuddy-token-breakdown-row">
          <div className="dsh-codebuddy-token-breakdown-label">
            <span className="dsh-codebuddy-token-rank">{String(index + 1).padStart(2, '0')}</span>
            <DshTypography.Text strong className="dsh-codebuddy-token-breakdown-name" ellipsis={{ showTooltip: { opts: { content: item.path ?? item.name } } }}>{item.name}</DshTypography.Text>
            <small>{item.calls} 次</small>
          </div>
          <div className="dsh-codebuddy-token-breakdown-track"><i style={{ width: `${Math.min(100, item.percent)}%` }} /></div>
          <span className="dsh-codebuddy-token-breakdown-value">{compact(item.total)}</span>
        </div>
      ))}
    </div>
  )
}

/** 会话用量排行：标题 + 工作区 + 调用次数 + 占比。 */
export function SessionRankingImpl({ items, empty, untitled, noWorkspace, callSuffix }: {
  items: TokenStats['sessions']
  empty: string
  untitled: string
  noWorkspace: string
  callSuffix: string
}): ReactNode {
  if (items.length === 0) return <div className="dsh-codebuddy-token-empty">{empty}</div>
  return (
    <div className="dsh-codebuddy-token-session-list">
      {/* 服务端已按用量截取前 10，这里不再二次截断——否则表头写「Top 10」
          却只列出 8 条，与文案不符。 */}
      {items.map((item, index) => (
        <div key={item.id} className="dsh-codebuddy-token-session-row">
          <span className="dsh-codebuddy-token-rank">{String(index + 1).padStart(2, '0')}</span>
          <div className="dsh-codebuddy-token-session-main">
            {/* 只显示标题，不把会话 id（无意义 uuid）当标题顶上。
                title 为空串时用本地化占位。 */}
            <DshTypography.Text strong className="dsh-codebuddy-token-session-title" ellipsis={{ showTooltip: true }}>
              {item.title.length > 0 ? item.title : untitled}
            </DshTypography.Text>
            <DshTypography.Text size="small" type="tertiary" className="dsh-codebuddy-token-session-workspace" ellipsis={{ showTooltip: true }}>
              {`${item.workspace ?? noWorkspace} · ${item.calls}${callSuffix}`}
            </DshTypography.Text>
          </div>
          <div className="dsh-codebuddy-token-session-total"><strong>{compact(item.total)}</strong><small>{item.percent}%</small></div>
        </div>
      ))}
    </div>
  )
}
