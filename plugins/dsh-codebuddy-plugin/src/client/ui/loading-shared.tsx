/**
 * 共享加载与页面外壳组件。
 *
 * 抽出来是因为：AccountsPage / TokenStatsPage 都用同一套骨架、同一套刷新
 * 遮罩、同一套指标格——把这一坨留在 panel.tsx 只为「共享」四个字太重。
 *
 * 命名遵循「形状优先」：组件名字直接说它的视觉角色（SkeletonBlock / Page-
 * Loading / StatMetric / PanelBody），而不是它绑定的页面，避免读源码时还要
 * 先猜含义。
 *
 * @module dsh-codebuddy/ui/loading-shared
 */

import type { ReactNode } from 'react'
import { DshCard, DshSkeleton, DshSpin } from '@tnnevol/dsh-semi-ui'

/**
 * 单块骨架。Semi 的 `Skeleton.Title` 自带底色，能在祖先 `.semi-skeleton-active`
 * 下产生微光动画（active 由 `<DshSkeleton active>` 提供）。
 */
export function SkeletonBlock({ height, width = '100%', radius = 8 }: {
  height: number
  width?: number | string
  radius?: number
}): ReactNode {
  return <DshSkeleton.Title style={{ height, width, borderRadius: radius }} />
}

/**
 * 账号管理 / 积分统计的初次加载骨架。
 *
 * 不用整屏转圈：那会先出现一大片空白再「啪」地换成内容。骨架铺出**与真实页面
 * 同形**的占位，到位时骨架就地替换，不发生版面跳动。
 */
export function AccountsSkeleton(): ReactNode {
  return (
    <DshSkeleton
      active
      className="dsh-codebuddy-panel-page"
      aria-busy="true"
      placeholder={(
        <>
          <DshCard className="dsh-codebuddy-panel-stat-card">
            <div className="dsh-codebuddy-panel-stat-grid">
              {[0, 1, 2, 3].map(index => (
                <div key={index} className="dsh-codebuddy-panel-stat">
                  <SkeletonBlock height={12} width="52%" radius={6} />
                  <SkeletonBlock height={26} width="40%" radius={8} />
                </div>
              ))}
            </div>
          </DshCard>
          <div className="dsh-codebuddy-panel-section-head">
            <SkeletonBlock height={16} width={140} />
            <SkeletonBlock height={28} width={220} radius={6} />
          </div>
          <div className="dsh-codebuddy-panel-cards">
            {[0, 1].map(index => (
              <DshCard key={index} className="dsh-codebuddy-panel-card">
                <div className="dsh-codebuddy-skeleton-card-body">
                  <SkeletonBlock height={20} width="55%" />
                  <SkeletonBlock height={12} width="80%" radius={6} />
                  <SkeletonBlock height={8} radius={999} />
                  <SkeletonBlock height={12} width="65%" radius={6} />
                </div>
              </DshCard>
            ))}
          </div>
        </>
      )}
    />
  )
}

/** Token 统计页面骨架：总览 + 趋势图 + 列表，与真实卡片/图表高度对齐。 */
export function TokensSkeleton(): ReactNode {
  return (
    <DshSkeleton
      active
      className="dsh-codebuddy-panel-page dsh-codebuddy-panel-tokens"
      aria-busy="true"
      placeholder={(
        <>
          <div className="dsh-codebuddy-token-toolbar">
            <SkeletonBlock height={12} width={220} radius={6} />
          </div>
          <DshCard className="dsh-codebuddy-token-overview-card">
            <div className="dsh-codebuddy-skeleton-overview-body">
              <SkeletonBlock height={26} width="40%" />
              <SkeletonBlock height={9} radius={999} />
              <div className="dsh-codebuddy-panel-stat-grid">
                {[0, 1, 2, 3].map(index => <SkeletonBlock key={index} height={38} radius={6} />)}
              </div>
            </div>
          </DshCard>
          <section className="dsh-codebuddy-token-section">
            <SkeletonBlock height={16} width={120} />
            <DshCard className="dsh-codebuddy-panel-chart-card">
              <SkeletonBlock height={310} radius={10} />
            </DshCard>
          </section>
          <section className="dsh-codebuddy-token-section">
            <SkeletonBlock height={16} width={120} />
            <DshCard className="dsh-codebuddy-token-list-card">
              <div className="dsh-codebuddy-skeleton-list">
                {[0, 1, 2, 3, 4, 5].map(index => <SkeletonBlock key={index} height={18} radius={6} />)}
              </div>
            </DshCard>
          </section>
        </>
      )}
    />
  )
}

/** 页面级骨架入口：根据 variant 选用不同形状的占位。 */
export function PageLoading({ variant }: { variant: 'accounts' | 'tokens' }): ReactNode {
  return variant === 'tokens' ? <TokensSkeleton /> : <AccountsSkeleton />
}

/** 指标格：图标 + 标签 + 大数字。Token 总览卡片多次复用。 */
export function StatMetric({ icon, label, value }: {
  icon: ReactNode
  label: string
  value: string
}): ReactNode {
  return (
    <div className="dsh-codebuddy-panel-stat">
      <div className="dsh-codebuddy-panel-stat-label">{icon}<span>{label}</span></div>
      <strong className="dsh-codebuddy-panel-stat-value">{value}</strong>
    </div>
  )
}

/**
 * 局部刷新遮罩：保留已渲染内容，只在上面叠一层半透明遮罩 + 转圈。
 *
 * 之所以不用 `if (loading) return <DshSpin/>` 整页替换：那会让整个子树卸载重建，
 * 页面闪一下、滚动位置丢失，也与「局部更新」的预期相反。遮罩用绝对定位覆盖
 * 页面容器，不参与布局，因此不会引起跳动。
 */
export function PanelRefreshOverlay({ visible }: { visible: boolean }): ReactNode {
  if (!visible) return null
  return (
    <div className="dsh-codebuddy-refresh-overlay" role="status" aria-live="polite">
      <DshSpin size="middle" />
    </div>
  )
}

/**
 * Token 页各面板的内容级 loading 包装：刷新时保留面板内已渲染的数据，
 * 只在该面板上叠一层遮罩，而不是把整页换成转圈。
 *
 * 单独做成组件是因为面板的「外壳」（`DshCard` 及其版式类）必须留在外面——
 * 遮罩只包内容，卡片自身的圆角、内边距与网格参与方式才不会被破坏。
 */
export function PanelBody({ loading, children }: { loading: boolean, children: ReactNode }): ReactNode {
  return (
    <div className="dsh-codebuddy-panel-body">
      {children}
      <PanelRefreshOverlay visible={loading} />
    </div>
  )
}

/** 半受控 helper：给 Semi Statistic / DSHMetric 类展示做紧凑计数。 */
export function compact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(Math.round(n))
}

/** 中文环境下的紧凑大数（万 / 亿），用于账号剩余额度。 */
export function formatCredit(n: number): string {
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}亿`
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`
  return String(Math.round(n))
}
