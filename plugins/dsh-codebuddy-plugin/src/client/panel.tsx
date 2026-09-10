/**
 * CodeBuddy 管理面板：全页面 overlay（shell.overlay slot），hash 路由隔离。
 * 页面：账号管理、积分统计、Token 统计。布局参考 workbuddy-switch：
 * 左上返回按钮 + 侧边导航；账号卡片化（当前/掉线/签到/剩余额度），
 * 无可用余额的账号禁用「设为当前」。数据来自 host 的 /codebuddy RPC。
 *
 * @module dsh-codebuddy/panel
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { BarChart, LineChart } from 'echarts/charts'
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { init as initChart, use as useECharts } from 'echarts/core'
import type { ECharts } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import {
  DshButton,
  DshButtonGroup,
  DshCard,
  DshDescriptions,
  DshDropdown,
  DshEmpty,
  DshIconButton,
  DshIconArrowLeft,
  DshIconClose,
  DshIconCommand,
  DshIconEdit,
  DshIconElementStroked,
  DshIconList,
  DshIconMore,
  DshIconRefresh,
  DshIconSetting,
  DshIconUser,
  DshInput,
  DshLayout,
  DshModal,
  DshNav,
  DshProgress,
  DshSkeleton,
  DshSpin,
  DshSwitch,
  DshTabs,
  DshTag,
  DshToast,
  DshTooltip,
  DshTypography,
} from '@tnnevol/dsh-semi-ui'
import { CODEBUDDY_AUTH_CHANNEL } from './constants.ts'
import { CODEBUDDY_ENVIRONMENT_LABELS } from '../constants.ts'
import type { CodeBuddyLocaleKey } from './locales.ts'
import type { ConnectionRpc, AccountsResult } from './rpc.ts'
import { describeRpcError } from './rpc.ts'
import { PanelRouteController } from './panel-route.ts'
import type { PanelRoute } from './panel-route.ts'
import { classifyResources, forgetResources, readResources, recordResources } from './resource-history.ts'
import type { ClassifiedResource, LiveResource, ResourceLifecycle } from './resource-history.ts'
import { TokenStatsStore } from './token-stats-store.ts'
import { activityCellSize } from './activity-grid.ts'
import { sortSegmentsByValueDesc } from './segment-bar.ts'
import { formatUpdatedAt } from './format-time.ts'
import { DEFAULT_TOKEN_RANGE, optionsFor, rangeLabel as rangeLabelOf, type TokenRangeKey } from './token-range.ts'
import { CodeBuddyLogo } from '../components/CodeBuddyLogo.tsx'
import { AddAccountModal, startLoginPolling } from '../components/AddAccountModal.tsx'
import { getAutoCheckinPref, getAutoTravelPref, setAutoCheckinPref, setAutoTravelPref } from './usage-prefs.ts'

useECharts([BarChart, LineChart, AriaComponent, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

type Translate = (key: CodeBuddyLocaleKey) => string

/** 一个账号的完整卡片数据（host panelStatus 聚合返回）。 */
interface PanelAccountRow {
  id: string
  name: string
  nickname: string
  environment?: string
  active: boolean
  expired: boolean
  /** 企业账号：不支持签到（隐藏签到入口、跳过签到与自动签到）。 */
  enterprise: boolean
  creditOk: boolean
  totalRemaining: number
  totalCapacity: number
  usable: boolean
  resources: Array<{
    name: string
    total: number | null
    remaining: number | null
    remainingPct: number | null
    used: number | null
    resetsAt: string | null
  }>
  todayCheckedIn: boolean | null
  checkinOk: boolean
  checkinError: string | null
  /** 派猫猫旅行状态；企业账号或查询失败为 null。 */
  travel: {
    state: string | null
    buddyId: number
    locationName: string | null
    arriveAt: number
    serverNow: number
    dailyLimitReached: boolean
    rewardCredit: number
  } | null
  result?: string
  skipped?: boolean
}

/** 积分到期资源（CreditStatsPage 复用账号卡片的 resources）。 */
interface PanelCreditRow {
  name: string
  remaining: number
  total: number
}

/** CodeBuddy 专属 Token 统计聚合（host tokenStats 返回）。 */
interface TokenStats {
  provider: string
  rangeDays: number
  generatedAt: number
  totals: { total: number, input: number, output: number, read: number, write: number, records: number, sessions: number, cacheHitRate?: number }
  days: Array<{ day: string, total: number, input: number, output: number, read: number, write: number, records: number, activeSessions: number }>
  activity: Array<{ day: string, calls: number, tokens: number, activeSessions: number }>
  workspaces: Array<{ name: string, path?: string, total: number, calls: number, percent: number }>
  models: Array<{ name: string, total: number, calls: number, percent: number }>
  sessions: Array<{ id: string, title: string, workspace?: string, total: number, input: number, output: number, calls: number, percent: number, lastActiveAt: number }>
}

function compact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(Math.round(n))
}

function formatCredit(n: number): string {
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}亿`
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`
  return String(Math.round(n))
}

function usePanelData<T>(
  rpc: ConnectionRpc,
  endpoint: string,
  payload: unknown,
  deps: unknown[],
): { data: T | undefined, loading: boolean, reload: () => void } {
  const [data, setData] = useState<T | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const reload = (): void => { setTick(v => v + 1) }
  useEffect(() => {
    let active = true
    setLoading(true)
    void rpc.call<T>(CODEBUDDY_AUTH_CHANNEL, endpoint, payload).then(result => {
      if (!active) return
      setData(result.ok ? result.value : undefined)
      setLoading(false)
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpc, endpoint, tick, ...deps])
  return { data, loading, reload }
}

/**
 * 订阅 Token 统计缓存。每个面板用**自己的** range 调用本 hook：
 * 范围相同的面板共享同一份数据与同一个在途请求，范围不同才各自取一次。
 *
 * 返回两个不同的加载态，用途严格区分：
 * - `initialLoading`：从未取到过数据 → 该面板/整页需要占位。
 * - `loading`：请求在途（可能已有陈旧数据）→ 只叠遮罩。
 *
 * 混用这两者会导致「刷新时整页回到初次加载占位」，即所谓的全局刷新。
 */
function useTokenStats(store: TokenStatsStore, range: TokenRangeKey): {
  data: TokenStats | undefined
  loading: boolean
  initialLoading: boolean
  error: string | undefined
  reload: () => void
} {
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  // 每个面板一份稳定令牌：数据按范围共享，但加载指示只属于发起刷新的面板，
  // 否则停在同范围上的其他面板会一起转圈（看起来还是全局刷新）。
  const owner = useRef<symbol>(Symbol('token-panel'))
  useEffect(() => { store.ensure(range) }, [store, range])
  const data = store.get(range) as TokenStats | undefined
  const inFlight = store.isLoading(range, owner.current)
  const reload = useCallback(() => { store.reload(range, owner.current) }, [store, range])
  return {
    data,
    loading: inFlight,
    initialLoading: data === undefined && inFlight,
    error: store.errorOf(range),
    reload,
  }
}

/**
 * 页面首次加载时的占位。
 *
 * 不用整屏转圈（`<DshSpin size="large"/>`）：那会先出现一大片空白再「啪」地换成
 * 内容，视觉上像卡了一下。改用 Semi 的 `Skeleton` 铺出**与真实页面同形**的骨架，
 * 内容到位时骨架就地替换，不发生版面跳动。
 *
 * 之所以每个页面各写一套骨架（而不是一个通用占位）：骨架的价值就在于形状对得上
 * ——卡片网格、指标格、图表的高度与真实元素一致，切换时才不闪。通用占位做不到
 * 这一点，也就退化成「换个样子的转圈」。
 *
 * Semi 的 `Skeleton` 支持 `loading` 开关与 `placeholder` 自定义，这里直接把它们
 * 组合成静态骨架（数据到位后整块被真实内容取代，故不需要 loading 切换）。
 */
function SkeletonBlock({ height, width = '100%', radius = 8 }: { height: number, width?: number | string, radius?: number }): ReactNode {
  // 用 `Skeleton.Title` 而不是裸 div：它自带 .semi-skeleton-title 类与底色，
  // 且能被祖先 `.semi-skeleton-active` 选中而产生微光动画（见下方 wrapper）。
  return <DshSkeleton.Title style={{ height, width, borderRadius: radius }} />
}

/** 账号管理 / 积分统计：操作卡 + 账号卡片网格。 */
function AccountsSkeleton(): ReactNode {
  return (
    <DshSkeleton
      active
      className="dsh-codebuddy-panel-page"
      aria-busy="true"
      placeholder={(
        <>
          <DshCard className="dsh-codebuddy-panel-action-card">
        <div className="dsh-codebuddy-panel-action-copy">
          <SkeletonBlock height={18} width="42%" />
          <SkeletonBlock height={12} width="70%" radius={6} />
        </div>
        <div className="dsh-codebuddy-panel-action-cta">
          <SkeletonBlock height={28} width={96} radius={6} />
        </div>
      </DshCard>
      <div className="dsh-codebuddy-panel-section-head">
        <SkeletonBlock height={16} width={140} />
        <SkeletonBlock height={28} width={180} radius={6} />
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

/** Token 统计：总览卡 + 趋势图 + 列表。与真实的卡片/图表高度对齐。 */
function TokensSkeleton(): ReactNode {
  return (
    <DshSkeleton
      active
      className="dsh-codebuddy-panel-page dsh-codebuddy-panel-tokens"
      aria-busy="true"
      placeholder={(
        <>
          <div className="dsh-codebuddy-token-toolbar">
        {/* 与真实页面对应：这里是一行「数据更新于 …」，不再是标题块。 */}
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

function PageLoading({ variant }: { variant: 'accounts' | 'tokens' }): ReactNode {
  return variant === 'tokens' ? <TokensSkeleton /> : <AccountsSkeleton />
}

function StatMetric({ icon, label, value }: { icon: ReactNode, label: string, value: string }): ReactNode {
  return (
    <div className="dsh-codebuddy-panel-stat">
      <div className="dsh-codebuddy-panel-stat-label">{icon}<span>{label}</span></div>
      <strong className="dsh-codebuddy-panel-stat-value">{value}</strong>
    </div>
  )
}

/**
 * 局部刷新遮罩：刷新期间保留已渲染内容，只在上面叠一层半透明遮罩 + 转圈。
 *
 * 之所以不用 `if (loading) return <DshSpin/>` 整页替换：那会让整个子树卸载重建，
 * 页面闪一下、滚动位置丢失，也与「局部更新」的预期相反。遮罩用绝对定位覆盖
 * 页面容器，不参与布局，因此不会引起跳动。
 */
function PanelRefreshOverlay({ visible }: { visible: boolean }): ReactNode {
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
function PanelBody({ loading, children }: { loading: boolean, children: ReactNode }): ReactNode {
  return (
    <div className="dsh-codebuddy-panel-body">
      {children}
      <PanelRefreshOverlay visible={loading} />
    </div>
  )
}

/**
 * 指标占比分段条。
 *
 * 不能用「宽度 = 占比百分比」直接渲染：实测真实数据里缓存读占 98.68%、输出仅
 * 0.15%、缓存写为 0%，纯百分比会把小项压成 0–1px，视觉上直接消失（连 Tooltip
 * 都悬停不到）。
 *
 * 改用 flex-grow 语义：每段先占一个可见的最小宽度（CSS 的 --dcb-segment-min），
 * 剩余空间才按数值比例分配。大项仍占绝大部分、小项也始终看得到，且总和恰好
 * 铺满不溢出（flex 的 shrink 会处理极端情况，故 bar 上保留 overflow:hidden）。
 *
 * `flex-basis: 0`（见 CSS）是必需的：若留下 auto basis，内容宽度会参与分配，
 * 最小宽度被满足后各段比例就不再等于数值比例。
 */
function SegmentBar({ segments }: { segments: Array<{ label: string, value: number, color: string }> }): ReactNode {
  // 占比最大的排在最左边：真实数据里缓存读常占 95% 以上，若它排在中间视觉重心
  // 会偏；降序后主项紧贴阅读起点，一眼可辨（相等时保持原序，避免刷新时抖动）。
  // 排序同时作用于条形与图例，两处顺序才会一致。
  const ordered = sortSegmentsByValueDesc(segments)
  const total = ordered.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)
  return (
    <div className="dsh-codebuddy-panel-segment-wrap">
      <div className="dsh-codebuddy-panel-segment-bar" role="img" aria-label={ordered.map(segment => `${segment.label} ${compact(segment.value)}`).join('，')}>
        {ordered.map(segment => (
          <DshTooltip key={segment.label} content={`${segment.label}: ${compact(segment.value)}`}>
            <span
              className="dsh-codebuddy-panel-segment-slice"
              style={{
                // 只决定剩余空间的分配比例；可见下限由 CSS 保证。
                flexGrow: total > 0 ? Math.max(0, segment.value) : 0,
                background: segment.color,
              }}
            />
          </DshTooltip>
        ))}
      </div>
      <div className="dsh-codebuddy-panel-segment-legend">
        {ordered.map(segment => <span key={segment.label}><i style={{ background: segment.color }} />{segment.label}</span>)}
      </div>
    </div>
  )
}

/* ============================================================================
 * 账号卡片（对齐 workbuddy-switch：头像/名称/状态 chips/额度/签到/操作）
 * ========================================================================== */

interface AccountCardProps {
  row: PanelAccountRow
  labels: {
    active: string
    offline: string
    checkedIn: string
    unchecked: string
    checkin: string
    remaining: string
    switchLabel: string
    deleteLabel: string
    renameLabel: string
    resourcesLabel: string
    noBalanceHint: string
    travel: {
      untraveled: string
      noBuddy: string
      traveling: string
      arrivesIn: string
      dailyLimit: string
      reward: string
    }
  }
  /** 自动签到开启时不显示手动签到动作。 */
  autoCheckin: boolean
  /** 该账号已分类的资源包（概览取前两个）。 */
  resources: ClassifiedResource[]
  busy: boolean
  onCheckin: (id: string) => void
  onSwitch: (id: string) => void
  onDelete: (row: PanelAccountRow) => void
  onRename: (row: PanelAccountRow) => void
  /** 点击卡片主体查看该账号全部资源包。 */
  onOpenResources: (row: PanelAccountRow) => void
}

function AccountCard({ row, labels, autoCheckin, resources, busy, onCheckin, onSwitch, onDelete, onRename, onOpenResources }: AccountCardProps): ReactNode {
  const env = row.environment
  const name = row.nickname
  const { active, offline, checkedIn, unchecked, checkin, remaining, switchLabel, deleteLabel, renameLabel, noBalanceHint } = labels
  const totalPct = row.totalCapacity > 0 ? Math.max(0, Math.min(100, (row.totalRemaining / row.totalCapacity) * 100)) : null
  const remainingSum = row.totalRemaining
  // 卡片是概览：最多两个套餐，按 可使用 → 已用完 → 已过期 取前二。
  const cardResources = resources.slice(0, CARD_RESOURCE_LIMIT)
  // 旅行状态 chip：只在能表达有用信息时渲染（企业账号没有成长中心）。
  const travelChip = (() => {
    const travel = row.travel
    if (row.enterprise || travel === null) return null
    // `buddyId` 是**当前在旅行的猫猫 id**，未派发时服务端返回 0——不能用它
    // 判断「是否拥有猫猫」，否则未派发过的账号会一律显示「暂无猫猫」。
    // 服务端给不出「拥有但未派出」这种状态，因此 0 就按「未旅行」呈现。
    if (travel.state === 'traveling') {
      const left = Math.max(0, travel.arriveAt - travel.serverNow)
      const hours = Math.floor(left / 3600)
      const minutes = Math.floor((left % 3600) / 60)
      const countdown = hours > 0 ? `${hours}小时${minutes}分` : `${minutes}分`
      const chip = (
        <span className="dsh-codebuddy-travel-chip is-traveling">
          {labels.travel.traveling}
          {left > 0 ? ` · ${labels.travel.arrivesIn}${countdown}` : ''}
        </span>
      )
      // 地点名可能缺失（尚未派发到具体地点），此时不挂 Tooltip。
      return travel.locationName === null
        ? chip
        : <DshTooltip content={travel.locationName}>{chip}</DshTooltip>
    }
    if (travel.dailyLimitReached) {
      return <span className="dsh-codebuddy-travel-chip is-muted">{labels.travel.dailyLimit}</span>
    }
    return <span className="dsh-codebuddy-travel-chip">{labels.travel.untraveled}</span>
  })()
  // 企业账号不支持签到；自动签到开启或已签到时不显示手动签到入口。
  const checkinVisible = !row.enterprise && !autoCheckin
  const checkinDisabled = row.expired || !row.checkinOk || row.todayCheckedIn === true || busy

  const menu: ReactNode[] = [
    <DshDropdown.Item key="rename" icon={<DshIconEdit />} onClick={() => { onRename(row) }}>{renameLabel}</DshDropdown.Item>,
  ]
  if (checkinVisible) {
    menu.push(
      <DshDropdown.Item
        key="checkin"
        icon={<DshIconRefresh />}
        disabled={checkinDisabled}
        onClick={() => { if (!checkinDisabled) onCheckin(row.id) }}
      >
        {checkin}
      </DshDropdown.Item>,
    )
  }
  if (!row.active) {
    menu.push(
      <DshDropdown.Item
        key="switch"
        icon={<DshIconSetting />}
        disabled={!row.usable || row.expired}
        onClick={() => { onSwitch(row.id) }}
      >
        {switchLabel}
      </DshDropdown.Item>,
    )
  }
  menu.push(<DshDropdown.Divider key="divider" />)
  menu.push(
    <DshDropdown.Item key="delete" icon={<DshIconClose />} type="danger" onClick={() => { onDelete(row) }}>{deleteLabel}</DshDropdown.Item>,
  )

  return (
    <div
      className={'dsh-codebuddy-account-card-wrap' + (row.active ? ' is-active' : '')}
      role="button"
      tabIndex={0}
      aria-label={`${name} ${labels.resourcesLabel}`}
      onClick={() => { onOpenResources(row) }}
      onKeyDown={(event: ReactKeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpenResources(row)
        }
      }}
    >
      <DshCard className={'dsh-codebuddy-panel-card dsh-codebuddy-account-card' + (row.active ? ' dsh-codebuddy-panel-card-active' : '')}>
      {/* 头部：头像 + 名称/环境 + 状态 chips + 「…」操作菜单 */}
      <div className="dsh-codebuddy-account-card-head">
        <span className="dsh-codebuddy-account-card-avatar" aria-hidden>{name.charAt(0).toUpperCase()}</span>
        <div className="dsh-codebuddy-account-card-main">
          <div className="dsh-codebuddy-account-card-title-row">
            {/* 名称可能很长：Typography.Text 负责截断，showTooltip 在真正溢出时
                才挂 Tooltip，短名称不会弹出多余气泡。 */}
            <DshTypography.Text className="dsh-codebuddy-account-name" ellipsis={{ showTooltip: true }}>
              {name}
            </DshTypography.Text>
            {row.active ? <DshTag size="small" type="solid" color="green">{active}</DshTag> : null}
            {row.expired ? <DshTag size="small" type="light" color="orange">{offline}</DshTag> : null}
            {env !== undefined
              ? <DshTag size="small" type="light">{CODEBUDDY_ENVIRONMENT_LABELS[env as keyof typeof CODEBUDDY_ENVIRONMENT_LABELS] ?? env}</DshTag>
              : null}
          </div>
          {(!row.enterprise && row.checkinOk) || travelChip !== undefined ? (
            <div className="dsh-codebuddy-account-card-chips">
              {!row.enterprise && row.checkinOk ? (
                <span className={'dsh-codebuddy-checkin-chip' + (row.todayCheckedIn === true ? ' dsh-codebuddy-checkin-chip-done' : '')}>
                  {row.todayCheckedIn === true ? checkedIn : unchecked}
                </span>
              ) : null}
              {travelChip}
            </div>
          ) : null}
        </div>
        {/* 菜单与卡片点击互斥：菜单区域吞掉冒泡，避免点「…」同时打开弹框。 */}
        <span
          className="dsh-codebuddy-account-card-more"
          onClick={(event: ReactMouseEvent) => { event.stopPropagation() }}
          onKeyDown={(event: ReactKeyboardEvent) => { event.stopPropagation() }}
        >
          <DshDropdown
            trigger="click"
            position="bottomRight"
            clickToHide
            content={(
              <DshDropdown.Menu>
                {menu}
              </DshDropdown.Menu>
            )}
          >
            <DshIconButton size="small" type="tertiary" theme="borderless" icon={<DshIconMore />} aria-label="更多操作" />
          </DshDropdown>
        </span>
      </div>

      {/* 主体：剩余额度大字 + 进度 + 前两个资源包 */}
      {!row.expired ? (
        <div className="dsh-codebuddy-account-card-body">
          {!row.creditOk
            ? <div className="dsh-codebuddy-muted">积分查询失败</div>
            : (
                <>
                  <div className="dsh-codebuddy-account-card-credits">
                    <strong className="dsh-codebuddy-account-card-credits-value">{formatCredit(remainingSum)}</strong>
                    <span className="dsh-codebuddy-muted">{remaining}</span>
                    <span className="dsh-codebuddy-muted">{resources.length} 个资源包</span>
                  </div>
                  {totalPct !== null && (
                    <DshProgress
                      percent={totalPct}
                      showInfo={false}
                      aria-label={remaining}
                      stroke="var(--dsw-alias-brand-primary)"
                      orbitStroke="var(--dsw-alias-border-l3)"
                    />
                  )}
                  {/* 概览只列前两个套餐，按 可使用 → 已用完 → 已过期 排序；
                      文字颜色跟随生命周期，一眼看出哪个还能用。容器始终渲染，
                      保证只有一个（或没有）套餐的账号与两个套餐的卡片等高。 */}
                  <div className="dsh-codebuddy-account-card-resources">
                    {cardResources.map((r) => (
                      <div key={r.key} className={`dsh-codebuddy-credit-resource-row is-${r.lifecycle}`}>
                        <DshTypography.Text className="dsh-codebuddy-credit-resource-name" ellipsis={{ showTooltip: true }}>
                          {r.name}
                        </DshTypography.Text>
                        <span className="dsh-codebuddy-credit-resource-meta">
                          {r.remaining !== null ? formatCredit(r.remaining) : '—'} / {r.total !== null ? formatCredit(r.total) : '∞'}
                          {r.resetsAt !== null ? ` · ${r.resetsAt}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
        </div>
      ) : (
        <div className="dsh-codebuddy-account-expired-pad">{offline}，请重新登录</div>
      )}
      </DshCard>
    </div>
  )
}

/* ============================================================================
 * 资源包弹框：账号下全部资源包，按生命周期分三组（可使用 / 已用完 / 已过期）
 * ========================================================================== */

/** 一类资源包的呈现元数据：语义色 + 说明，避免每个调用点各写一套判断。 */
const RESOURCE_LIFECYCLE_META: Record<ResourceLifecycle, { labelKey: CodeBuddyLocaleKey, emptyKey: CodeBuddyLocaleKey, color: string }> = {
  usable: { labelKey: 'resourcesUsable', emptyKey: 'resourcesEmptyUsable', color: 'var(--dsw-alias-state-success-primary)' },
  depleted: { labelKey: 'resourcesDepleted', emptyKey: 'resourcesEmptyDepleted', color: 'var(--dsw-alias-state-warn-primary)' },
  expired: { labelKey: 'resourcesExpired', emptyKey: 'resourcesEmptyExpired', color: 'var(--dsw-alias-label-tertiary)' },
}

/** 卡片行优先展示的套餐数：卡片是概览，全量台账在弹框里。 */
const CARD_RESOURCE_LIMIT = 2

/* ---------------------------------------------------------------------------
 * Token 活动热力图的几何常量。
 *
 * 热力图是列优先（一周一列、一天一行），而「一/三/五」星期标签另占一列、按行
 * 对齐；星期列有固定宽度，无法从热力图列宽反推行高。因此格子边长由 JS 量宽后
 * 算一次，写进 --dcb-cell-size，三处（月份行 / 热力图 / 星期列）共用同一个值，
 * 对齐由构造保证，而不是靠两套像素算术碰巧一致。
 * ------------------------------------------------------------------------- */
/** 把一个账号的实时资源包转成台账输入（卡片与弹框共用同一映射）。 */
function liveResourcesOf(row: PanelAccountRow): LiveResource[] {
  return row.resources.map(r => ({
    name: r.name,
    total: r.total,
    remaining: r.remaining,
    resetsAt: r.resetsAt,
  }))
}

/** 一行资源包：左侧状态条 + 名称与用量 + 右侧剩余/总量。 */
function ResourceRow({ item, t }: { item: ClassifiedResource, t: Translate }): ReactNode {
  const meta = RESOURCE_LIFECYCLE_META[item.lifecycle]
  const pct = item.total !== null && item.total > 0 && item.remaining !== null
    ? Math.max(0, Math.min(100, (item.remaining / item.total) * 100))
    : null
  const used = item.total !== null && item.remaining !== null ? Math.max(item.total - item.remaining, 0) : null
  return (
    <div className={`dsh-codebuddy-resource-row is-${item.lifecycle}`} style={{ '--dcb-resource-color': meta.color } as CSSProperties}>
      <span className="dsh-codebuddy-resource-bar" aria-hidden />
      <div className="dsh-codebuddy-resource-main">
        <div className="dsh-codebuddy-resource-head">
          <DshTypography.Text strong className="dsh-codebuddy-resource-name" ellipsis={{ showTooltip: true }}>
            {item.name}
          </DshTypography.Text>
          {item.total === null
            ? <span className="dsh-codebuddy-resource-amount">{t('resourceNoQuota')}</span>
            : (
                <span className="dsh-codebuddy-resource-amount">
                  {item.remaining !== null ? formatCredit(item.remaining) : '—'}
                  <small> / {formatCredit(item.total)}</small>
                </span>
              )}
        </div>
        {pct !== null ? (
          <DshProgress
            percent={pct}
            showInfo={false}
            aria-label={item.name}
            stroke={meta.color}
            orbitStroke="var(--dsw-alias-border-l3)"
          />
        ) : null}
        <div className="dsh-codebuddy-resource-foot">
          <span>
            {used !== null ? `${t('resourceUsedOf')} ${formatCredit(used)}` : ''}
          </span>
          <span>
            {item.resetsAt === null
              ? t('resourceLongTerm')
              : `${item.lifecycle === 'expired' ? t('resourceExpiredAt') : t('resourceExpiresAt')} ${item.resetsAt}`}
          </span>
        </div>
      </div>
    </div>
  )
}

/** 一个生命周期分组的内容：列表或一句明确的空态说明。 */
function ResourceGroup({ items, lifecycle, t }: { items: ClassifiedResource[], lifecycle: ResourceLifecycle, t: Translate }): ReactNode {
  const meta = RESOURCE_LIFECYCLE_META[lifecycle]
  if (items.length === 0) {
    return <p className="dsh-codebuddy-resource-empty">{t(meta.emptyKey)}</p>
  }
  return (
    <div className="dsh-codebuddy-resource-list">
      {items.map(item => <ResourceRow key={item.key} item={item} t={t} />)}
    </div>
  )
}

/** 账号资源包弹框：头部账号摘要 + 三组生命周期 Tabs。 */
function AccountResourcesModal({ row, items, t, onClose }: {
  row: PanelAccountRow | undefined
  /** 该账号已分类的资源包（由 AccountsPage 统一计算，与卡片同源）。 */
  items: ClassifiedResource[]
  t: Translate
  onClose: () => void
}): ReactNode {
  const [activeKey, setActiveKey] = useState<ResourceLifecycle>('usable')
  // 换账号时回到「可使用」：Tab 是这次查看的临时状态，不跟着上一个账号走。
  useEffect(() => { setActiveKey('usable') }, [row?.id])
  const groups = useMemo(() => ({
    usable: items.filter(item => item.lifecycle === 'usable'),
    depleted: items.filter(item => item.lifecycle === 'depleted'),
    expired: items.filter(item => item.lifecycle === 'expired'),
  }), [items])

  return (
    <DshModal
      title={t('resourcesTitle')}
      visible={row !== undefined}
      footer={null}
      onCancel={onClose}
      className="dsh-codebuddy-resource-modal"
    >
      {row === undefined ? null : (
        <div className="dsh-codebuddy-resource-dialog">
          <div className="dsh-codebuddy-resource-summary">
            <div>
              <DshTypography.Text className="dsh-codebuddy-resource-account" ellipsis={{ showTooltip: true }}>
                {row.nickname}
              </DshTypography.Text>
              {row.active ? <DshTag size="small" type="solid" color="green">{t('accountActive')}</DshTag> : null}
              {row.expired ? <DshTag size="small" type="light" color="orange">{t('accountOffline')}</DshTag> : null}
            </div>
            <div className="dsh-codebuddy-resource-total">
              <strong>{formatCredit(row.totalRemaining)}</strong>
              <span>{t('remaining')}</span>
            </div>
          </div>
          <DshTabs
            type="line"
            size="small"
            activeKey={activeKey}
            onChange={(key: string) => { setActiveKey(key as ResourceLifecycle) }}
          >
            {(['usable', 'depleted', 'expired'] as const).map(lifecycle => (
              <DshTabs.TabPane
                key={lifecycle}
                itemKey={lifecycle}
                tab={<span className="dsh-codebuddy-resource-tab">{t(RESOURCE_LIFECYCLE_META[lifecycle].labelKey)}<i>{groups[lifecycle].length}</i></span>}
              >
                <ResourceGroup items={groups[lifecycle]} lifecycle={lifecycle} t={t} />
              </DshTabs.TabPane>
            ))}
          </DshTabs>
        </div>
      )}
    </DshModal>
  )
}

/* ============================================================================
 * 页面组件
 * ========================================================================== */

function AccountsPage({
  rpc, t, notify, rosterTick, loginWaiting, loginLink, onCopyLoginLink, onRename, onDelete, onAddAccount, onCheckinChange,
}: {
  rpc: ConnectionRpc
  t: Translate
  notify: (ok: boolean, text: string) => void
  /** 数据版本：登录/删除/改名完成后由父级自增以重拉列表。 */
  rosterTick: number
  /** 是否有正在等待授权的登录（禁用添加入口并显示等待条）。 */
  loginWaiting: boolean
  /** 正在等待授权的登录链接（等待条「复制」用）。 */
  loginLink?: string
  onCopyLoginLink: () => void
  onRename: (row: PanelAccountRow) => void
  onDelete: (row: PanelAccountRow) => void
  onAddAccount: () => void
  onCheckinChange: () => void
}): ReactNode {
  const { data, loading, reload } = usePanelData<{ accounts: PanelAccountRow[], currentId?: string }>(rpc, 'panelStatus', {}, [rosterTick])
  const [busyId, setBusyId] = useState<string | undefined>(undefined)
  // 资源包弹框目标账号。
  const [resourceTarget, setResourceTarget] = useState<PanelAccountRow | undefined>(undefined)
  // 自动签到开关状态：开启时隐藏手动签到动作。
  const [autoCheckinOn, setAutoCheckinOn] = useState<boolean>(autoCheckinPref())
  // 自动旅行开关状态（成长中心）。
  const [autoTravelOn, setAutoTravelOn] = useState<boolean>(autoTravelPref())
  // 资源台账版本：记录完本次探测结果后自增，让卡片用上最新的分类。
  const [ledgerTick, setLedgerTick] = useState(0)
  const rows = data?.accounts ?? []

  // 每次探测都把实时资源包并入本地台账（写 localStorage 属于副作用，放 effect）。
  useEffect(() => {
    if (rows.length === 0) return
    for (const row of rows) {
      // 查询失败的账号不写台账：空的实时列表会把已有记录挤成「已过期」。
      if (!row.creditOk) continue
      recordResources(row.id, liveResourcesOf(row))
    }
    setLedgerTick(v => v + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // 每个账号的分类资源包（可使用 → 已用完 → 已过期），卡片与弹框共用。
  const resourcesByAccount = useMemo(() => {
    const map = new Map<string, ClassifiedResource[]>()
    for (const row of rows) {
      // 额度查询失败时实时列表为空，此时不能把台账里的包判成「已过期」——
      // 那只是这次没查到，不是资源没了。
      map.set(row.id, row.creditOk ? classifyResources(readResources(row.id), liveResourcesOf(row)) : [])
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ledgerTick])

  useEffect(() => {
    void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoCheckin', { enabled: autoCheckinOn })
    void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoTravel', { enabled: autoTravelOn })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpc])

  const checkinOne = async (id: string): Promise<void> => {
    setBusyId(id)
    const result = await rpc.call<{ accounts: Array<{ id: string, result?: string, error?: string }> }>(CODEBUDDY_AUTH_CHANNEL, 'checkin', { id })
    setBusyId(undefined)
    if (result.ok) {
      const row = result.value.accounts.find(item => item.id === id)
      notify(row?.result !== 'error', row?.result === 'already' ? t('checkinAlready') : row?.result === 'success' ? t('checkinDone') : row?.error ?? t('checkinFail'))
      onCheckinChange()
      reload()
    }
  }

  const switchOne = async (id: string): Promise<void> => {
    const result = await rpc.call<AccountsResult>(CODEBUDDY_AUTH_CHANNEL, 'switchAccount', { id })
    if (result.ok) {
      notify(true, t('switchDone'))
      reload()
    } else {
      notify(false, describeRpcError(result))
    }
  }

  // 首次加载才整页占位；刷新时保留已渲染的内容，只叠一层遮罩。
  // 整页替换会让所有卡片卸载重建、页面闪一下，滚动位置也会丢。
  if (loading && data === undefined) return <PageLoading variant="accounts" />
  return (
    <div className="dsh-codebuddy-panel-page">
      <PanelRefreshOverlay visible={loading} />
      <DshCard className="dsh-codebuddy-panel-action-card">
        <div className="dsh-codebuddy-panel-action-copy">
          <strong>{t('accountActionTitle')}</strong>
          <p className="dsh-codebuddy-muted">{t('accountActionDesc')}</p>
        </div>
        <div className="dsh-codebuddy-panel-action-cta">
          <DshButton
            size="small"
            theme="solid"
            type="primary"
            disabled={loginWaiting}
            onClick={onAddAccount}
          >
            {loginWaiting ? t('signingIn') : t('createUser')}
          </DshButton>
        </div>
      </DshCard>
      {loginWaiting ? (
        <div className="dsh-codebuddy-login-waiting">
          <span className="dsh-codebuddy-muted">{t('loginWaitingCopy')}</span>
          <DshButton
            size="small"
            theme="light"
            type="tertiary"
            disabled={loginLink === undefined}
            onClick={onCopyLoginLink}
          >
            {t('copyLoginLink')}
          </DshButton>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <DshEmpty title={t('accountsEmpty')} />
      ) : (
        <>
          <div className="dsh-codebuddy-panel-section-head">
            <div className="dsh-codebuddy-panel-section-title"><strong>{t('accountsTitle')}</strong><span>{rows.length}</span></div>
            <div className="dsh-codebuddy-accounts-head-actions">
              <AutoCheckinToggle
                checked={autoCheckinOn}
                t={t}
                onChange={(checked: boolean) => {
                  setAutoCheckinOn(checked)
                  setAutoCheckinPref(checked)
                  void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoCheckin', { enabled: checked })
                }}
              />
              <AutoTravelToggle
                checked={autoTravelOn}
                t={t}
                onChange={(checked: boolean) => {
                  setAutoTravelOn(checked)
                  setAutoTravelPref(checked)
                  void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoTravel', { enabled: checked })
                }}
              />
              <DshButton size="small" theme="light" icon={<DshIconRefresh />} onClick={reload}>{t('refresh')}</DshButton>
            </div>
          </div>
          <div className="dsh-codebuddy-panel-cards">
            {rows.map(row => (
            <AccountCard
              key={row.id}
              row={row}
              busy={busyId === row.id}
              autoCheckin={autoCheckinOn}
              resources={resourcesByAccount.get(row.id) ?? []}
              labels={{
                active: t('accountActive'),
                offline: t('accountOffline'),
                checkedIn: t('checkinDone'),
                unchecked: t('checkinTodo'),
                checkin: t('checkinDo'),
                remaining: t('remaining'),
                switchLabel: t('accountSwitch'),
                deleteLabel: t('accountRemove'),
                renameLabel: t('renameLabel'),
                resourcesLabel: t('resourcesTitle'),
                noBalanceHint: t('noBalanceHint'),
                travel: {
                  untraveled: t('travelUntraveled'),
                  noBuddy: t('travelNoBuddy'),
                  traveling: t('travelTraveling'),
                  arrivesIn: t('travelArrivesIn'),
                  dailyLimit: t('travelDailyLimit'),
                  reward: t('travelReward'),
                },
              }}
              onCheckin={(id) => { void checkinOne(id) }}
              onSwitch={(id) => { void switchOne(id) }}
              onDelete={(row_) => { onDelete(row_) }}
              onRename={(row_) => { onRename(row_) }}
              onOpenResources={(row_) => { setResourceTarget(row_) }}
            />
            ))}
          </div>
        </>
      )}
      <AccountResourcesModal
        row={resourceTarget}
        items={resourceTarget === undefined ? [] : resourcesByAccount.get(resourceTarget.id) ?? []}
        t={t}
        onClose={() => { setResourceTarget(undefined) }}
      />
    </div>
  )
}

function CreditsPage({ rpc, t, rosterTick }: { rpc: ConnectionRpc, t: Translate, rosterTick: number }): ReactNode {
  // 与账号页共用 panelStatus：账号增删/改名/登录完成后必须一起失效。
  // 此前这个 deps 是空的——那时页面每次进入都会重新挂载、顺带重拉，掩盖了
  // 缺陷；改成 keep-alive 后会一直显示旧账号，因此补上（见 rosterTick）。
  const { data, loading, reload } = usePanelData<{ accounts: PanelAccountRow[], currentId?: string }>(rpc, 'panelStatus', {}, [rosterTick])
  if (loading && data === undefined) return <PageLoading variant="accounts" />
  const rows = data?.accounts ?? []
  if (rows.length === 0) return <DshEmpty title={t('accountsEmpty')} />
  const totalRemaining = rows.reduce((sum, row) => sum + row.totalRemaining, 0)
  const resourceCount = rows.reduce((sum, row) => sum + row.resources.length, 0)
  const usableCount = rows.filter(row => row.usable).length
  const offlineCount = rows.filter(row => row.expired).length
  return (
    <div className="dsh-codebuddy-panel-page">
      <PanelRefreshOverlay visible={loading} />
      <div className="dsh-codebuddy-panel-section-head">
        <div>
          <strong>{t('creditTitle')}</strong>
          <p className="dsh-codebuddy-muted">{t('usageUnavailable')}</p>
        </div>
        <DshButton size="small" theme="light" icon={<DshIconRefresh />} onClick={reload}>{t('refresh')}</DshButton>
      </div>
      <DshCard className="dsh-codebuddy-panel-stat-card">
        <div className="dsh-codebuddy-panel-stat-grid">
          <StatMetric icon={<DshIconElementStroked />} label={t('remaining')} value={formatCredit(totalRemaining)} />
          <StatMetric icon={<DshIconElementStroked />} label={t('creditResourceCount')} value={String(resourceCount)} />
          <StatMetric icon={<DshIconUser />} label={t('creditUsable')} value={`${usableCount}/${rows.length}`} />
          <StatMetric icon={<DshIconElementStroked />} label={t('accountOffline')} value={String(offlineCount)} />
        </div>
      </DshCard>
      <div className="dsh-codebuddy-panel-section-title"><strong>{t('creditTitle')}</strong><span>{rows.length}</span></div>
      <div className="dsh-codebuddy-panel-cards">
        {rows.map(row => (
          <DshCard key={row.id} className={'dsh-codebuddy-panel-card' + (row.active ? ' dsh-codebuddy-panel-card-active' : '')}>
            <div className="dsh-codebuddy-account-card-title-row">
              <span className="dsh-codebuddy-account-name">{row.nickname}</span>
              {row.active ? <DshTag size="small" type="solid" color="green">{t('accountActive')}</DshTag> : null}
              {row.expired ? <DshTag size="small" type="light" color="orange">{t('accountOffline')}</DshTag> : null}
            </div>
            {!row.creditOk ? <div className="dsh-codebuddy-muted">积分查询失败</div> : row.resources.length === 0 ? <div className="dsh-codebuddy-muted">{t('usageUnavailable')}</div> : (
              row.resources.map(w => {
                const pct = w.remainingPct ?? 0
                return (
                  <div key={w.name} className="dsh-codebuddy-panel-credit-row">
                    <div className="dsh-codebuddy-usage-popover-heading"><span>{w.name}</span><span>{w.remaining !== null ? `${formatCredit(w.remaining)} / ${w.total !== null ? formatCredit(w.total) : '∞'}` : '—'}</span></div>
                    <DshProgress percent={pct} showInfo={false} stroke="var(--dsw-alias-state-success-primary)" orbitStroke="var(--dsw-alias-border-l3)" />
                    <span className="dsh-codebuddy-usage-popover-reset">{w.resetsAt !== null ? `${t('usageResets')} ${w.resetsAt}` : t('usageLongTerm')}</span>
                  </div>
                )
              })
            )}
          </DshCard>
        ))}
      </div>
    </div>
  )
}

/**
 * 时间范围选择器。
 *
 * 用 Semi 的 `ButtonGroup` 而不是一排独立按钮：这组按钮是**互斥单选**，同一时刻
 * 只有一个生效；`ButtonGroup` 会把相邻按钮的圆角合并成一条连续控件，视觉上直接
 * 表达「这是一组、只能选一个」，而散排按钮看起来像三个独立动作。
 *
 * 选项由调用方按面板职责给出（见 token-range.ts）：总览给「总计」、趋势给「本月」。
 */
function RangeToggle({ options, range, onChange, label, format }: {
  options: readonly TokenRangeKey[]
  range: TokenRangeKey
  onChange: (value: TokenRangeKey) => void
  label: string
  format: (key: TokenRangeKey) => string
}): ReactNode {
  return (
    <DshButtonGroup
      size="small"
      theme="light"
      className="dsh-codebuddy-panel-range"
      aria-label={label}
    >
      {options.map(key => (
        <DshButton
          key={key}
          size="small"
          // 选中项用实心主色，未选中用浅底：对比要一眼可辨，而不是靠细微色差。
          type={range === key ? 'primary' : 'tertiary'}
          theme={range === key ? 'solid' : 'light'}
          aria-pressed={range === key}
          onClick={() => { onChange(key) }}
        >
          {format(key)}
        </DshButton>
      ))}
    </DshButtonGroup>
  )
}

function BreakdownList({ items, empty }: { items: TokenStats['models'], empty: string }): ReactNode {
  if (items.length === 0) return <div className="dsh-codebuddy-token-empty">{empty}</div>
  return (
    <div className="dsh-codebuddy-token-breakdown-list">
      {items.slice(0, 6).map((item, index) => (
        <div key={item.name} className="dsh-codebuddy-token-breakdown-row">
          <div className="dsh-codebuddy-token-breakdown-label"><span className="dsh-codebuddy-token-rank">{String(index + 1).padStart(2, '0')}</span><DshTypography.Text strong className="dsh-codebuddy-token-breakdown-name" ellipsis={{ showTooltip: true }}>{item.name}</DshTypography.Text><small>{item.calls} 次</small></div>
          <div className="dsh-codebuddy-token-breakdown-track"><i style={{ width: `${Math.min(100, item.percent)}%` }} /></div>
          <span className="dsh-codebuddy-token-breakdown-value">{compact(item.total)}</span>
        </div>
      ))}
    </div>
  )
}

function WorkspaceList({ items, empty }: { items: TokenStats['workspaces'], empty: string }): ReactNode {
  if (items.length === 0) return <div className="dsh-codebuddy-token-empty">{empty}</div>
  return (
    <div className="dsh-codebuddy-token-breakdown-list">
      {items.slice(0, 6).map((item, index) => (
        <div key={`${item.name}-${item.path ?? ''}`} className="dsh-codebuddy-token-breakdown-row">
          <div className="dsh-codebuddy-token-breakdown-label"><span className="dsh-codebuddy-token-rank">{String(index + 1).padStart(2, '0')}</span><DshTypography.Text strong className="dsh-codebuddy-token-breakdown-name" ellipsis={{ showTooltip: { opts: { content: item.path ?? item.name } } }}>{item.name}</DshTypography.Text><small>{item.calls} 次</small></div>
          <div className="dsh-codebuddy-token-breakdown-track"><i style={{ width: `${Math.min(100, item.percent)}%` }} /></div>
          <span className="dsh-codebuddy-token-breakdown-value">{compact(item.total)}</span>
        </div>
      ))}
    </div>
  )
}

function SessionRanking({ items, empty, untitled, noWorkspace, callSuffix }: {
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

function activityWeekday(day: string): number {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number)
  return new Date(year, month - 1, date).getDay()
}

function ActivityGrid({ activity, callSuffix }: { activity: TokenStats['activity'], callSuffix: string }): ReactNode {
  const max = Math.max(1, ...activity.map(item => item.tokens))
  const leading = activity[0] === undefined ? 0 : activityWeekday(activity[0].day)
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
   *
   * 上下限的作用：低于 min 时格子会小到看不清，改由外层横向滚动承担；
   * 高于 max 时继续放大会让格子显得笨重，此时整块居中、留白比变形好看。
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
      // 列数只与数据有关，用内联样式声明（不放进量宽回调，免得被其提前 return 跳过）。
      // 月份行与热力图共用这个模板，两者才不会错列。
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

/**
 * 一个统计面板的外壳：标题 + 该面板**自己的**时间周期选择器 + 局部刷新。
 *
 * 时间周期必须落在每个面板内部（而不是页面顶部一个全局选择器）：总览、趋势、
 * 工作区分布、模型分布、会话排行各自回答不同问题，读者经常需要让它们停在
 * 不同窗口上对比——全局选择器会强迫所有面板同时跳变，反而看不出差异。
 *
 * 刷新只作用于本面板；遮罩只盖住面板内容，卡片外壳不参与重建。
 */
function TokenPanel({ title, hint, options, range, onRangeChange, rangeLabel, rangeFormat, refreshLabel, loading, onRefresh, children }: {
  title: string
  hint: string
  options: readonly TokenRangeKey[]
  range: TokenRangeKey
  onRangeChange: (value: TokenRangeKey) => void
  rangeLabel: string
  rangeFormat: (key: TokenRangeKey) => string
  refreshLabel: string
  loading: boolean
  onRefresh: () => void
  children: ReactNode
}): ReactNode {
  return (
    <section className="dsh-codebuddy-token-section">
      <div className="dsh-codebuddy-token-panel-head">
        <div className="dsh-codebuddy-panel-section-title"><strong>{title}</strong><span>{hint}</span></div>
        <div className="dsh-codebuddy-token-panel-actions">
          <RangeToggle options={options} range={range} onChange={onRangeChange} label={rangeLabel} format={rangeFormat} />
          <DshIconButton
            size="small"
            theme="borderless"
            type="tertiary"
            icon={<DshIconRefresh />}
            aria-label={refreshLabel}
            onClick={onRefresh}
          />
        </div>
      </div>
      <PanelBody loading={loading}>{children}</PanelBody>
    </section>
  )
}

function TokenStatsPage({ rpc, t }: { rpc: ConnectionRpc, t: Translate }): ReactNode {
  // 每个面板独立的周期，默认一律「近 7 天」——最近的用量才是常看的信息，
  // 30 天起步会让首屏数字偏大且迟缓。
  const [overviewRange, setOverviewRange] = useState<TokenRangeKey>(DEFAULT_TOKEN_RANGE)
  const [trendRange, setTrendRange] = useState<TokenRangeKey>(DEFAULT_TOKEN_RANGE)
  const [distributionRange, setDistributionRange] = useState<TokenRangeKey>(DEFAULT_TOKEN_RANGE)
  const [modelsRange, setModelsRange] = useState<TokenRangeKey>(DEFAULT_TOKEN_RANGE)
  const [sessionsRange, setSessionsRange] = useState<TokenRangeKey>(DEFAULT_TOKEN_RANGE)
  const store = useMemo(() => new TokenStatsStore(rpc), [rpc])
  const overview = useTokenStats(store, overviewRange)
  const trend = useTokenStats(store, trendRange)
  const distribution = useTokenStats(store, distributionRange)
  const models = useTokenStats(store, modelsRange)
  const sessions = useTokenStats(store, sessionsRange)

  // 刷新失败必须说出来。因为 reload 刻意保留旧数据（否则会整页闪烁），
  // 失败时界面看起来「什么都没发生」——静默失败比报错更糟。
  const panels = [overview, trend, distribution, models, sessions]
  const failureSignature = panels.map(panel => panel.error ?? '').join('|')
  const lastFailure = useRef('')
  useEffect(() => {
    if (failureSignature.replace(/\|/g, '') === '') return
    if (lastFailure.current === failureSignature) return
    lastFailure.current = failureSignature
    DshToast.warning({ content: t('tokenRefreshFailed') })
  }, [failureSignature, t])

  // 页面级渲染（空状态、活动判断）需要一个稳定依据。总览面板切到尚未加载过的
  // 范围时 overview.data 会短暂为 undefined，若直接用它会整页退回占位/空状态。
  // 因此粘住最后一次有效数据：整页只在「从未有过任何数据」时才占位。
  const lastData = useRef<TokenStats | undefined>(undefined)
  if (overview.data !== undefined) lastData.current = overview.data
  const data = overview.data ?? lastData.current

  if (data === undefined && overview.initialLoading) {
    return <PageLoading variant="tokens" />
  }
  if (data === undefined) {
    return <div className="dsh-codebuddy-panel-page"><DshEmpty title={t('usageUnavailable')} /></div>
  }

  const hasAnyActivity = data.activity.some(item => item.calls > 0)
  if (!hasAnyActivity) {
    return (
      <div className="dsh-codebuddy-panel-page dsh-codebuddy-panel-tokens">
        <DshCard className="dsh-codebuddy-token-empty-card">
          <DshEmpty
            image={<DshIconCommand size="extra-large" />}
            title={t('tokenNoDataTitle')}
            description={<span>{t('tokenNoDataDesc')}<small>{t('tokenNoDataHint')}</small></span>}
          >
            <DshButton type="primary" theme="light" icon={<DshIconRefresh />} onClick={overview.reload}>{t('refresh')}</DshButton>
          </DshEmpty>
        </DshCard>
      </div>
    )
  }

  // 指标到系列色的映射：与 CSS 中的 --dcb-series-* 保持一致（单一事实来源），
  // 这样总览、趋势图、分布图对同一指标永远用同一颜色。
  const cacheRateOf = (value: TokenStats): string => value.totals.cacheHitRate === undefined
    ? '—'
    : `${Math.round(value.totals.cacheHitRate * 100)}%`
  const SERIES = {
    input: 'var(--dcb-series-input)',
    output: 'var(--dcb-series-output)',
    cacheRead: 'var(--dcb-series-cache-read)',
    cacheWrite: 'var(--dcb-series-cache-write)',
  } as const
  const rangeLabel = t('tokenRangeLabel')
  // Translate 不接受插值参数，故标签由 token-range.ts 用前后缀/整词拼出。
  const rangeFormat = (key: TokenRangeKey): string => rangeLabelOf(key, t)
  const refreshPanel = t('tokenRefreshPanel')
  return (
    <div className="dsh-codebuddy-panel-page dsh-codebuddy-panel-tokens">
      <div className="dsh-codebuddy-token-toolbar">
        {/* 这里原先重复了页面 shell 已有的「Token 统计」标题与副标题；
            换成数据更新时间更有信息量：读者能判断看到的是不是最新一轮。 */}
        <p className="dsh-codebuddy-token-updated">{`${t('tokenUpdatedAt')}${formatUpdatedAt(data.generatedAt)}`}</p>
      </div>
      <TokenPanel
        title={t('tokenTotal')}
        hint={`${data.totals.sessions} ${t('tokenActiveSessions')}`}
        options={optionsFor('overview')}
        range={overviewRange}
        onRangeChange={setOverviewRange}
        rangeLabel={rangeLabel}
        rangeFormat={rangeFormat}
        refreshLabel={refreshPanel}
        loading={overview.loading}
        onRefresh={overview.reload}
      >
        <DshCard className="dsh-codebuddy-token-overview-card">
          {/* 面板内容只用**本范围**的数据：切到新范围时旧范围的数字不能顶着
              新标签显示——那会让人以为数字属于新范围。等数据到位期间由遮罩
              表达进度，卡片用 min-height 维持高度避免跳动。 */}
          {overview.data === undefined ? <div className="dsh-codebuddy-token-overview-pending" />
            : (
              <>
                <div className="dsh-codebuddy-token-overview-head">
                  <div>
                    <span>{t('tokenTotal')}</span>
                    <strong>{compact(overview.data.totals.total)}</strong>
                  </div>
                  <DshTag color="green" type="light">{rangeFormat(overviewRange)}</DshTag>
                </div>
                <SegmentBar segments={[
                  { label: t('tokenInput'), value: overview.data.totals.input, color: SERIES.input },
                  { label: t('tokenOutput'), value: overview.data.totals.output, color: SERIES.output },
                  { label: t('tokenCacheRead'), value: overview.data.totals.read, color: SERIES.cacheRead },
                  { label: t('tokenCacheWrite'), value: overview.data.totals.write, color: SERIES.cacheWrite },
                ]} />
                <div className="dsh-codebuddy-token-overview-stats">
                  <StatMetric icon={<DshIconArrowLeft />} label={t('tokenInput')} value={compact(overview.data.totals.input)} />
                  <StatMetric icon={<DshIconCommand />} label={t('tokenOutput')} value={compact(overview.data.totals.output)} />
                  <StatMetric icon={<DshIconElementStroked />} label={t('tokenCacheRate')} value={cacheRateOf(overview.data)} />
                  <StatMetric icon={<DshIconElementStroked />} label={t('tokenRecords')} value={compact(overview.data.totals.records)} />
                </div>
              </>
            )}
        </DshCard>
      </TokenPanel>
      <TokenPanel
        title={t('tokenTrend')}
        hint={trend.data === undefined ? '' : `${compact(trend.data.totals.total)} Token`}
        options={optionsFor('trend')}
        range={trendRange}
        onRangeChange={setTrendRange}
        rangeLabel={rangeLabel}
        rangeFormat={rangeFormat}
        refreshLabel={refreshPanel}
        loading={trend.loading}
        onRefresh={trend.reload}
      >
        <DshCard className="dsh-codebuddy-panel-chart-card">
          {trend.data === undefined
            ? <div className="dsh-codebuddy-panel-chart" />
            : <TokenUsageChart days={trend.data.days} inputLabel={t('tokenInput')} outputLabel={t('tokenOutput')} cacheReadLabel={t('tokenCacheRead')} cacheWriteLabel={t('tokenCacheWrite')} recordsLabel={t('tokenRecords')} />}
        </DshCard>
      </TokenPanel>
      <section className="dsh-codebuddy-token-section">
        <div className="dsh-codebuddy-panel-section-title"><strong>{t('tokenActivity')}</strong><span>{t('tokenDaily')}</span></div>
        <DshCard className="dsh-codebuddy-token-activity-card">
          <div className="dsh-codebuddy-token-activity-meta"><span>{t('tokenActivityRange')}</span><span>{compact(data.totals.records)} {t('tokenRecords')}</span></div>
          <ActivityGrid activity={data.activity} callSuffix={t('tokenCallSuffix')} />
          <div className="dsh-codebuddy-token-activity-scale"><span>少</span><i className="level-1" /><i className="level-2" /><i className="level-3" /><i className="level-4" /><span>多</span></div>
        </DshCard>
      </section>
      <div className="dsh-codebuddy-token-columns">
        <TokenPanel
          title={t('tokenDistribution')}
          hint={t('tokenByWorkspace')}
          options={optionsFor('other')}
          range={distributionRange}
          onRangeChange={setDistributionRange}
          rangeLabel={rangeLabel}
          rangeFormat={rangeFormat}
          refreshLabel={refreshPanel}
          loading={distribution.loading}
          onRefresh={distribution.reload}
        >
          <DshCard className="dsh-codebuddy-token-list-card">
            {distribution.data === undefined
              ? <div className="dsh-codebuddy-token-empty" />
              : <WorkspaceList items={distribution.data.workspaces} empty={t('tokenNoWorkspace')} />}
          </DshCard>
        </TokenPanel>
        <TokenPanel
          title={t('tokenModels')}
          hint={t('tokenByModel')}
          options={optionsFor('other')}
          range={modelsRange}
          onRangeChange={setModelsRange}
          rangeLabel={rangeLabel}
          rangeFormat={rangeFormat}
          refreshLabel={refreshPanel}
          loading={models.loading}
          onRefresh={models.reload}
        >
          <DshCard className="dsh-codebuddy-token-list-card">
            {models.data === undefined
              ? <div className="dsh-codebuddy-token-empty" />
              : <BreakdownList items={models.data.models} empty={t('tokenNoModel')} />}
          </DshCard>
        </TokenPanel>
      </div>
      <TokenPanel
        title={t('tokenTopSessions')}
        hint={t('tokenTopTen')}
        options={optionsFor('other')}
        range={sessionsRange}
        onRangeChange={setSessionsRange}
        rangeLabel={rangeLabel}
        rangeFormat={rangeFormat}
        refreshLabel={refreshPanel}
        loading={sessions.loading}
        onRefresh={sessions.reload}
      >
        <DshCard className="dsh-codebuddy-token-list-card">
          {sessions.data === undefined
            ? <div className="dsh-codebuddy-token-empty" />
            : (
              <SessionRanking
                items={sessions.data.sessions}
                empty={t('tokenNoSession')}
                untitled={t('tokenSessionUntitled')}
                noWorkspace={t('tokenNoWorkspaceName')}
                callSuffix={t('tokenCallSuffix')}
              />
            )}
        </DshCard>
      </TokenPanel>
    </div>
  )
}

/* ============================================================================
 * Token 用量柱状图（echarts，主题色从 DSH CSS 变量读取）
 * ========================================================================== */

interface TokenUsageChartProps {
  days: TokenStats['days']
  inputLabel: string
  outputLabel: string
  cacheReadLabel: string
  cacheWriteLabel: string
  recordsLabel: string
}

function cssVariable(element: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback
}

function TokenUsageChart({ days, inputLabel, outputLabel, cacheReadLabel, cacheWriteLabel, recordsLabel }: TokenUsageChartProps): ReactNode {
  const chartElement = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = chartElement.current
    if (element === null) return
    const textColor = cssVariable(element, '--dsw-alias-label-tertiary', '#8b93a7')
    const gridColor = cssVariable(element, '--dsw-alias-border-l3', 'rgba(139, 147, 167, 0.24)')
    // 四个系列色统一取 --dcb-series-*（定义在 .dsh-codebuddy-panel-tokens），
    // 与总览分段条/模型分布同色；不要在这里各写一个语义变量——那正是此前
    // 同一指标在不同面板颜色不一致的原因（缓存读曾用 label-tertiary，即灰色）。
    const inputColor = cssVariable(element, '--dcb-series-input', '#2aa3a3')
    const outputColor = cssVariable(element, '--dcb-series-output', '#7b61d8')
    const cacheReadColor = cssVariable(element, '--dcb-series-cache-read', '#e2823c')
    const cacheWriteColor = cssVariable(element, '--dcb-series-cache-write', '#d6538f')
    const chart: ECharts = initChart(element, undefined, { renderer: 'canvas' })
    chart.setOption({
      aria: { enabled: true },
      animation: false,
      grid: { top: 32, right: 12, bottom: 28, left: 12, containLabel: true },
      legend: { top: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: textColor } },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (value: string | number) => compact(Number(value)),
      },
      xAxis: {
        type: 'category',
        data: days.map(day => day.day.slice(5)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: textColor, fontSize: 10 },
      },
      yAxis: [
        {
          type: 'value',
          axisTick: { show: false },
          axisLine: { show: false },
          axisLabel: { color: textColor, formatter: (value: number) => compact(value) },
          splitLine: { lineStyle: { color: gridColor } },
        },
        {
          type: 'value',
          axisTick: { show: false },
          axisLine: { show: false },
          axisLabel: { color: textColor, formatter: (value: number) => compact(value) },
          splitLine: { show: false },
        },
      ],
      series: [
        // barMinHeight：每段柱体的最小像素高度。堆叠模式下 ECharts 对**每个分段**
        // 生效（源码按 stackStartValue 单独计算），因此缓存写这类占比极小的分段
        // 也始终可见——否则它的高度会被四舍五入成 0，整段从图例中「消失」。
        { name: inputLabel, type: 'bar', stack: 'tokens', barMaxWidth: 32, barMinHeight: 30, itemStyle: { color: inputColor }, data: days.map(day => day.input) },
        { name: outputLabel, type: 'bar', stack: 'tokens', barMaxWidth: 32, barMinHeight: 30, itemStyle: { color: outputColor }, data: days.map(day => day.output) },
        { name: cacheReadLabel, type: 'bar', stack: 'tokens', barMaxWidth: 32, barMinHeight: 30, itemStyle: { color: cacheReadColor }, data: days.map(day => day.read) },
        { name: cacheWriteLabel, type: 'bar', stack: 'tokens', barMaxWidth: 32, barMinHeight: 30, itemStyle: { color: cacheWriteColor, borderRadius: [3, 3, 0, 0] }, data: days.map(day => day.write) },
        { name: recordsLabel, type: 'line', yAxisIndex: 1, smooth: true, symbol: 'none', lineStyle: { type: 'dashed', width: 2 }, data: days.map(day => day.records) },
      ],
    })
    const resize = (): void => { chart.resize() }
    const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize)
    if (resizeObserver !== undefined) resizeObserver.observe(element)
    else window.addEventListener('resize', resize)
    /**
     * 页面被 keep-alive 保留后，从隐藏切回可见时容器会由 0 宽度变回真实宽度。
     * ResizeObserver 在多数浏览器会因此回调，但在「元素刚从 display:none 恢复」
     * 这一刻不保证一定触发——尤其图表初始化就发生在隐藏状态下（0×0）时，
     * 它会一直保持空白。因此额外观察承载页面的 hidden 变化，恢复可见时主动
     * resize 一次。
     */
    const view = element.closest('.dsh-codebuddy-panel-view')
    const visibilityObserver = typeof MutationObserver === 'undefined' || view === null
      ? undefined
      : new MutationObserver(() => {
        if ((view as HTMLElement).hidden) return
        // 等一帧后再量：hidden 刚被移除时容器尺寸可能尚未完成布局。
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(resize)
        else resize()
      })
    visibilityObserver?.observe(view as Node, { attributes: true, attributeFilter: ['hidden'] })
    return () => {
      resizeObserver?.disconnect()
      visibilityObserver?.disconnect()
      if (resizeObserver === undefined) window.removeEventListener('resize', resize)
      chart.dispose()
    }
  }, [days, inputLabel, outputLabel, cacheReadLabel, cacheWriteLabel, recordsLabel])
  return <div ref={chartElement} className="dsh-codebuddy-panel-chart" role="img" aria-label={`${inputLabel} and ${outputLabel}`} />
}

/* ============================================================================
 * 面板壳：左上返回 + 侧边导航 + 各页面（hash 路由隔离）
 * ========================================================================== */

export interface PanelPageProps {
  rpc: ConnectionRpc
  route: PanelRouteController
  t: Translate
}

export function CodeBuddyPanelPage({ rpc, route, t }: PanelPageProps): ReactNode {
  const snapshot = useSyncExternalStore(route.subscribe, route.getSnapshot, route.getSnapshot)
  const notify = useCallback((ok: boolean, text: string) => {
    if (ok) DshToast.success({ content: text })
    else DshToast.warning({ content: text })
  }, [])
  // 删除确认目标
  const [deleteTarget, setDeleteTarget] = useState<PanelAccountRow | undefined>(undefined)
  const [renaming, setRenaming] = useState<PanelAccountRow | undefined>(undefined)
  const [renameNote, setRenameNote] = useState('')
  // 添加账号弹框（与设置页共享同一组件）+ 登录等待状态。
  const [addOpen, setAddOpen] = useState(false)
  const [loginState, setLoginState] = useState<string | undefined>(undefined)
  const [loginLink, setLoginLink] = useState<string | undefined>(undefined)
  // 账号列表数据版本：登录完成 / 删除 / 改名后自增以触发面板重拉。
  const [rosterTick, setRosterTick] = useState(0)
  const bumpRoster = (): void => { setRosterTick(v => v + 1) }
  // 已进入过的页面：首次进入才挂载，之后一直保留（keep-alive，见下方渲染处）。
  const [visited, setVisited] = useState<ReadonlySet<PanelRoute>>(() => new Set([snapshot.page]))
  useEffect(() => {
    setVisited(prev => prev.has(snapshot.page) ? prev : new Set([...prev, snapshot.page]))
  }, [snapshot.page])

  const doRename = async (): Promise<void> => {
    const target = renaming
    if (target === undefined) return
    setRenaming(undefined)
    const result = await rpc.call<AccountsResult>(CODEBUDDY_AUTH_CHANNEL, 'renameLabel', { id: target.id, label: renameNote })
    if (result.ok) {
      notify(true, t('renameDone'))
      bumpRoster()
    } else {
      notify(false, describeRpcError(result))
    }
  }
  const openRename = (row: PanelAccountRow): void => {
    setRenaming(row)
    setRenameNote(row.nickname)
  }
  const openDelete = (row: PanelAccountRow): void => { setDeleteTarget(row) }
  const confirmDelete = async (): Promise<void> => {
    const target = deleteTarget
    setDeleteTarget(undefined)
    if (target === undefined) return
    const result = await rpc.call<AccountsResult>(CODEBUDDY_AUTH_CHANNEL, 'removeAccount', { id: target.id })
    if (result.ok) {
      // 账号已移除：其资源台账不再有归属，一并清掉。
      forgetResources(target.id)
      notify(true, t('accountRemoved'))
      bumpRoster()
    } else {
      notify(false, describeRpcError(result))
    }
  }

  // 添加账号：浏览器打开授权页，进入等待并轮询完成，完成/超时后刷新列表。
  const onAddLoginStart = useCallback((start: { authUrl: string, state: string }) => {
    window.open(start.authUrl, '_blank', 'noopener')
    setLoginLink(start.authUrl)
    setLoginState(start.state)
  }, [])
  const cbCopyLoginLink = (): void => {
    if (loginLink === undefined) return
    void navigator.clipboard?.writeText(loginLink)
      .then(() => { notify(true, t('copyLoginLinkDone')) })
      .catch(() => { notify(false, t('copyLoginLinkDoneFail')) })
  }
  useEffect(() => {
    if (loginState === undefined) return
    return startLoginPolling(
      rpc,
      loginState,
      () => { setLoginState(undefined); bumpRoster() },
      () => {
        setLoginState(undefined)
        notify(false, t('timeout'))
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginState, rpc])

  if (!snapshot.active) return null

  const pageTitle = snapshot.page === 'accounts'
    ? t('accountsTitle')
    : snapshot.page === 'credits' ? t('creditTitle') : t('tokenTitle')
  // 副标题只在真有补充信息时才渲染。Token 页原先标题与描述同为 tokenTitle，
  // 于是 h1 下方又重复印了一遍「Token 统计」；既然没有额外信息可讲，就不渲染，
  // 由页面工具栏的「数据更新于 …」承担这一行的信息。
  const pageDescription = snapshot.page === 'accounts'
    ? t('accountsDesc')
    : snapshot.page === 'credits' ? t('creditResourceCount') : undefined

  const items = [
    { itemKey: 'accounts', text: t('accountsTitle'), icon: <DshIconUser /> },
    { itemKey: 'tokens', text: t('tokenTitle'), icon: <DshIconCommand /> },
    { itemKey: 'credits', text: t('creditTitle'), icon: <DshIconElementStroked /> },
  ]

  return (
    <div className="dsh-codebuddy-panel" role="dialog" aria-label="CodeBuddy 管理面板">
      <DshLayout>
        <DshLayout.Sider>
          <DshNav
            className="dsh-codebuddy-panel-nav"
            selectedKeys={[snapshot.page]}
            items={items}
            onSelect={(data_: { itemKey: string }) => { route.open(data_.itemKey as PanelRoute) }}
            footer={{ collapseButton: false }}
            header={{ logo: <CodeBuddyLogo size={28} />, text: 'CodeBuddy' }}
          />
        </DshLayout.Sider>
        <DshLayout.Content className="dsh-codebuddy-panel-content">
          {/* 左上返回 + 页面标题；右侧仅保留刷新等当前页动作 */}
          <div className="dsh-codebuddy-panel-toolbar">
            <DshIconButton
              type="tertiary"
              theme="borderless"
              icon={<DshIconArrowLeft aria-label={t('back')} />}
              onClick={() => { route.close() }}
            />
            <div className="dsh-codebuddy-panel-heading">
              <h1 className="dsh-codebuddy-panel-title">{pageTitle}</h1>
              {pageDescription === undefined ? null : <p className="dsh-codebuddy-muted">{pageDescription}</p>}
            </div>
            <div style={{ flex: 1 }} />
          </div>

          {/*
           * keep-alive：三个页面都保持挂载，只把非当前页隐藏。
           *
           * 原先用条件渲染（`page === 'x' ? <XPage/> : null`），切走即卸载：
           * 页面内的 useState（Token 各面板的已选范围）与 useMemo 里的
           * TokenStatsStore、已拉到的数据、echarts 实例全部销毁，切回只能重新
           * 请求并重建图表——这正是「每次进菜单都重新拉取」的原因。
           *
           * 用 `hidden` 属性而不是只写 CSS display：hidden 会把子树从可访问性树
           * 移除且不可聚焦，隐藏页里的按钮不会被 Tab 选中；只控制显示会留下
           * 「隐藏但仍可聚焦」的缺口。
           *
           * 按 visited 惰性挂载：首次进入某页才真正渲染，避免一进面板就并发拉
           * 三页数据。
           */}
          <div className="dsh-codebuddy-panel-views">
            {visited.has('accounts') ? (
              <div className="dsh-codebuddy-panel-view" hidden={snapshot.page !== 'accounts'}>
                <AccountsPage
                  rpc={rpc}
                  t={t}
                  notify={notify}
                  rosterTick={rosterTick}
                  loginWaiting={loginState !== undefined}
                  {...loginLink === undefined ? {} : { loginLink }}
                  onCopyLoginLink={cbCopyLoginLink}
                  onRename={openRename}
                  onDelete={openDelete}
                  onAddAccount={() => { setAddOpen(true) }}
                  onCheckinChange={bumpRoster}
                />
              </div>
            ) : null}
            {visited.has('credits') ? (
              <div className="dsh-codebuddy-panel-view" hidden={snapshot.page !== 'credits'}>
                <CreditsPage rpc={rpc} t={t} rosterTick={rosterTick} />
              </div>
            ) : null}
            {visited.has('tokens') ? (
              <div className="dsh-codebuddy-panel-view" hidden={snapshot.page !== 'tokens'}>
                <TokenStatsPage rpc={rpc} t={t} />
              </div>
            ) : null}
          </div>
        </DshLayout.Content>
      </DshLayout>

      {/* 添加账号（共享设置页弹框组件） */}
      <AddAccountModal
        rpc={rpc}
        t={t}
        visible={addOpen}
        onLoginStart={onAddLoginStart}
        onCancel={() => { setAddOpen(false) }}
      />

      {/* 删除账号确认 */}
      <DshModal
        title={t('accountRemove')}
        visible={deleteTarget !== undefined}
        okText={t('accountRemove')}
        cancelText={t('cancel')}
        okButtonProps={{ type: 'danger', theme: 'solid' }}
        onCancel={() => { setDeleteTarget(undefined) }}
        onOk={() => { void confirmDelete() }}
      >
        <p>{t('accountRemoveConfirm')}</p>
      </DshModal>

      {/* 修改备注名（header 铅笔入口打开） */}
      <DshModal
        title={t('renameLabel')}
        visible={renaming !== undefined}
        okText={t('confirm')}
        cancelText={t('cancel')}
        onCancel={() => { setRenaming(undefined) }}
        onOk={() => { void doRename() }}
      >
        <DshInput
          className="dsh-codebuddy-pref-control-wide"
          value={renameNote}
          onChange={setRenameNote}
          placeholder={t('labelPlaceholder')}
          showClear
          maxLength={30}
        />
      </DshModal>
    </div>
  )
}

/** 自动签到偏好（与设置页同一键）。 */
const autoCheckinPref = (): boolean => getAutoCheckinPref()

/** 自动旅行偏好（与设置页同一键）。 */
const autoTravelPref = (): boolean => getAutoTravelPref()

/** 自动签到开关（账号页标题行）。受控组件：状态由 AccountsPage 持有并在
 *  切换时同步到 host（localStorage 与设置页共享）。 */
function AutoCheckinToggle({ checked, t, onChange }: {
  checked: boolean
  t: Translate
  onChange: (checked: boolean) => void
}): ReactNode {
  return (
    <span className="dsh-codebuddy-auto-checkin-toggle">
      <span className="dsh-codebuddy-muted">{t('autoCheckin')}</span>
      <DshSwitch
        size="small"
        checked={checked}
        onChange={onChange}
        aria-label={t('autoCheckin')}
      />
    </span>
  )
}

/** 自动旅行开关（账号页标题行，自动签到右侧）。受控组件：状态由
 *  AccountsPage 持有并在切换时同步到 host。 */
function AutoTravelToggle({ checked, t, onChange }: {
  checked: boolean
  t: Translate
  onChange: (checked: boolean) => void
}): ReactNode {
  return (
    <DshTooltip content={t('travelAutoDesc')}>
      <span className="dsh-codebuddy-auto-checkin-toggle">
        <span className="dsh-codebuddy-muted">{t('travelAuto')}</span>
        <DshSwitch
          size="small"
          checked={checked}
          onChange={onChange}
          aria-label={t('travelAuto')}
        />
      </span>
    </DshTooltip>
  )
}
