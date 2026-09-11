/**
 * CodeBuddy 管理面板：全页面 overlay（shell.overlay slot），hash 路由隔离。
 * 页面：账号管理、积分统计、Token 统计。布局参考 workbuddy-switch：
 * 左上返回按钮 + 侧边导航；账号卡片化（当前/掉线/签到/剩余额度），
 * 无可用余额的账号禁用「设为当前」。数据来自 host 的 /codebuddy RPC。
 *
 * @module dsh-codebuddy/panel
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useStore } from '@nanostores/react'
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
  DshDatePicker,
  DshDescriptions,
  DshDropdown,
  DshEmpty,
  DshIconButton,
  DshIconLabAvatar,
  DshIconLabChart,
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
import { CODEBUDDY_AUTH_CHANNEL, CODEBUDDY_ENVIRONMENT_LABELS } from '../contracts/constants.ts'
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
import {
  CODEBUDDY_CLIENT_LABELS,
  CODEBUDDY_CLIENT_VERSIONS,
  normalizeClientId,
  type CodeBuddyClientId,
} from '../contracts/constants.ts'
import { formatProbeAge, formatResetDate, formatUpdatedAt } from './format-time.ts'
import { identityRows, type AccountIdentityDetail } from './identity.ts'
import { accountEpoch, subscribeAccountEpoch } from './account-epoch.ts'
import { DEFAULT_TOKEN_RANGE, optionsFor, rangeLabel as rangeLabelOf, setCustomRangeDays, type TokenRangeKey } from './token-range.ts'
import { CodeBuddyLogo } from '../components/CodeBuddyLogo.tsx'
import { AddAccountModal, startLoginPolling } from '../components/AddAccountModal.tsx'
import {
  $autoCheckin,
  $autoSwitch,
  $autoTravel,
  subscribeUsagePref,
} from './usage-prefs.ts'

useECharts([BarChart, LineChart, AriaComponent, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

type Translate = (key: CodeBuddyLocaleKey) => string

/** 一个账号的完整卡片数据（host panelStatus 聚合返回）。 */
interface PanelAccountRow {
  id: string
  name: string
  nickname: string
  environment?: string
  /** 登录该账号所用客户端（`cli` / `workbuddy`）；历史条目缺省视为 cli。 */
  client?: CodeBuddyClientId
  /** 该客户端的固定版本号（CLI 2.145.0 / WorkBuddy 5.5.4）。 */
  clientVersion?: string
  /** 账户身份明细，供「账户信息」弹框展示完整资料。 */
  account?: AccountIdentityDetail
  /** 该账号实际请求的服务端点（企业账号常为专享/自建地址）。 */
  endpoint?: string
  active: boolean
  expired: boolean
  /** 企业账号：不支持签到（隐藏签到入口、跳过签到与自动签到）。 */
  enterprise: boolean
  creditOk: boolean
  /**
   * 该额度数据的产出时刻（epoch ms）。
   *
   * 面板**没有自动刷新**（只有输入框旁的用量指示器每 60s 拉一次），因此面板
   * 开着不动时数据可以陈旧很久；叠加统探测的 30s TTL 缓存，用户看到「8649」
   * 时也无法判断这是 3 秒前还是 5 分钟前的数据。据此显示陈旧提示。
   */
  probedAt?: number
  /** 该数据是否来自统探测缓存（而非本次真实请求）。 */
  probedFromCache?: boolean
  /** 探测失败的原因；与「额度为 0」严格区分。 */
  probeError?: string | null
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
  totals: { total: number, input: number, output: number, read: number, records: number, sessions: number, cacheHitRate?: number }
  days: Array<{ day: string, total: number, input: number, output: number, read: number, records: number, activeSessions: number }>
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
          {/* 与真实页面对齐：先积分总览卡，再区块头（标题 + 右侧动作区）。
          操作卡已移除，骨架里不能再画它，否则加载完成时会跳一下。 */}
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
    /** 套餐无到期日时的文案。 */
    longTerm: string
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
  /** 自动切换开启时不渲染「设为当前账号」入口（见 AutoSwitchToggle 注释）。 */
  autoSwitch: boolean
  onDelete: (row: PanelAccountRow) => void
  onRename: (row: PanelAccountRow) => void
  /** 点击卡片主体查看该账号全部资源包。 */
  onOpenResources: (row: PanelAccountRow) => void
}

function AccountCard({ row, labels, autoCheckin, autoSwitch, resources, busy, onCheckin, onSwitch, onDelete, onRename, onOpenResources }: AccountCardProps): ReactNode {
  const env = row.environment
  // 历史条目没有 client 字段（那时只有 CLI），缺省按 cli 展示。
  const clientId = normalizeClientId(row.client)
  const clientVersion = row.clientVersion ?? CODEBUDDY_CLIENT_VERSIONS[clientId]
  const name = row.nickname
  const { active, offline, checkedIn, unchecked, checkin, remaining, switchLabel, deleteLabel, renameLabel, longTerm, noBalanceHint } = labels
  const totalPct = row.totalCapacity > 0 ? Math.max(0, Math.min(100, (row.totalRemaining / row.totalCapacity) * 100)) : null
  /**
   * 额度数据的陈旧提示（够新时为 null，不占位）。
   *
   * 阈值与文案见 formatProbeAge：面板无自动刷新，正常情况不提示，只在陈旧到
   * 值得点刷新时出现。
   */
  const probeAge = formatProbeAge(row.probedAt)
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
  // 自动切换开启时隐藏手动入口：那时账号由客户端按阈值自动切换，手动指定会被
  // 下一次自动切换覆盖，留着只会让用户以为设置没生效。
  if (!row.active && !autoSwitch) {
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
            {/* 客户端标识：账号用哪个客户端登录（CLI / WorkBuddy），并带上其
                固定版本号。用户据此分辨账号来源——两个客户端的登录页与用量
                平面不同，出问题时这是第一个要看的信息。 */}
            <DshTooltip content={`${CODEBUDDY_CLIENT_LABELS[clientId]} · v${clientVersion}`}>
              <DshTag size="small" type="light" className="dsh-codebuddy-client-tag">
                {CODEBUDDY_CLIENT_LABELS[clientId]} · v{clientVersion}
              </DshTag>
            </DshTooltip>
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
            // 拉取失败时正文只剩一行，用与正常卡片等高的状态块占位，
            // 保证同一栅格行内所有卡片高度一致（否则这张会明显更矮、布局参差）。
            //
            // 用 tooltip 承载失败原因：卡片上只放一句「积分查询失败」保持简洁，
            // 但把 meter 的原话留在悬浮里 —— 排查「为什么查不到」时需要它，
            // 而它与「额度为 0」（正常卡片显示 0）是两种完全不同的状态。
            ? (
                <div className="dsh-codebuddy-account-body-state">
                  {row.probeError === undefined || row.probeError === null
                    ? <span className="dsh-codebuddy-muted">积分查询失败</span>
                    : (
                        <DshTooltip content={row.probeError}>
                          <span className="dsh-codebuddy-muted">积分查询失败</span>
                        </DshTooltip>
                      )}
                </div>
              )
            : (
                <>
                  <div className="dsh-codebuddy-account-card-credits">
                    <strong className="dsh-codebuddy-account-card-credits-value">{formatCredit(remainingSum)}</strong>
                    <span className="dsh-codebuddy-muted">{remaining}</span>
                    <span className="dsh-codebuddy-muted">{resources.length} 个资源包</span>
                    {/* 陈旧提示：默认不显示（见 formatProbeAge）——面板没有自动刷新，
                        数据本来就有一定年纪，正常情况下提示是噪音。只在陈旧到值得
                        点刷新时出现，并说明是否来自缓存（「刷新了但拿的是缓存」与
                        「一直没刷新」是两种不同的陈旧）。 */}
                    {probeAge !== null && (
                      <span className="dsh-codebuddy-account-card-stale">
                        {row.probedFromCache === true ? `缓存于 ${probeAge}` : probeAge}
                      </span>
                    )}
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
                        {/* 卡片只列套餐名与到期日：卡片是概览，用量数字在读「还有
                            哪些套餐能用」时是干扰——同一账号的额度合计已在上方大字给出，
                            逐个套餐的剩余/总量留给详情弹框（那里还有进度条做比例表达）。
                            到期日只到日：秒级精度读不出也占宽度，同一天到期的多个套餐
                            还会因时分秒不同而看似不同日期。 */}
                        <span className="dsh-codebuddy-credit-resource-meta">
                          {r.resetsAt === null ? longTerm : formatResetDate(r.resetsAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
        </div>
      ) : (
        // 已离线同样只有一行：走同一套等高状态块（不另套一层容器）。
        <div className="dsh-codebuddy-account-body-state dsh-codebuddy-account-expired-pad">
          <span className="dsh-codebuddy-muted">{offline}，请重新登录</span>
        </div>
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
/**
 * 账户信息弹框：身份资料与资源包台账分页展示。
 *
 * 为什么把身份信息也做成 Tab（而不是与台账上下堆叠）：身份字段有 8–10 项，用
 * Semi `Descriptions` 的**默认纵向布局**时每项占「key 一行 + value 一行」，单是
 * 这一段就有约 400px，加上顶部摘要与台账列表会逼近视口高度。改成 Tab 后同一时刻
 * 只渲染一页，弹框高度由最高的那一页决定，身份信息与各生命周期台账互不挤占。
 */
/**
 * 账户信息弹框：两级 Tab。
 *
 * ```
 * [身份信息]  [用量信息]
 *              └ [套餐状态]        ← 用量信息之下的二级 Tab
 *                 ├ [可使用 n]
 *                 ├ [已用完 n]
 *                 └ [已过期 n]
 * ```
 *
 * 为什么要分两级：顶层按「账号是什么」与「账号用了多少」划分，语义上互斥；
 * 套餐的三个生命周期是**用量**这一侧的分类，直接放到顶层会让读者以为
 * 「可使用/已用完」与「身份信息」是同一层级的概念。
 *
 * 分层同时解决高度问题：同一时刻只渲染一条路径，弹框高度由当前页决定。
 * （身份表 8–10 项若用 Semi Descriptions 的默认纵向布局约占 400px，因此身份页
 * 内仍用 horizontal 横向多列。）
 */
function AccountResourcesModal({ row, items, t, onClose }: {
  row: PanelAccountRow | undefined
  /** 该账号已分类的资源包（由 AccountsPage 统一计算，与卡片同源）。 */
  items: ClassifiedResource[]
  t: Translate
  onClose: () => void
}): ReactNode {
  /** 顶层：身份信息 / 用量信息。 */
  type TopTab = 'identity' | 'usage'
  const [topKey, setTopKey] = useState<TopTab>('identity')
  /** 二级（用量之下的套餐状态）：三个生命周期。 */
  const [statusKey, setStatusKey] = useState<ResourceLifecycle>('usable')
  // 换账号时回到首屏：Tab 是这次查看的临时状态，不跟着上一个账号走。
  useEffect(() => { setTopKey('identity'); setStatusKey('usable') }, [row?.id])
  const groups = useMemo(() => ({
    usable: items.filter(item => item.lifecycle === 'usable'),
    depleted: items.filter(item => item.lifecycle === 'depleted'),
    expired: items.filter(item => item.lifecycle === 'expired'),
  }), [items])

  /**
   * 身份页的全部字段，合并成**一张**单列表。
   *
   * 顺序按读者的追问链排：先「这是谁」（标识），再「属于哪里 / 连到哪」（归属与
   * 服务），最后「当前状态」。分多张表会读成几个割裂的片段，而它们是同一个账号
   * 的一组事实。
   */
  const identityData = row === undefined
    ? []
    : [
        // ── 标识 ──
        ...identityRows(row.account ?? { uid: '—', nickname: row.nickname }, {
          uid: t('uid'),
          nickname: t('nickname'),
          label: t('renameLabel'),
          uin: t('uin'),
          enterprise: t('enterprise'),
          enterpriseId: t('enterpriseId'),
          enterpriseUser: t('enterpriseUser'),
          department: t('department'),
        }),
        // ── 归属与服务 ──
        // 账号类型：企业与个人在签到、成长中心、额度平面上行为不同，
        // 这句话解释了下面为什么有些行不出现。
        { key: t('accountType'), value: row.enterprise ? t('accountTypeEnterprise') : t('accountTypePersonal') },
        {
          key: t('clientLabel'),
          value: `${CODEBUDDY_CLIENT_LABELS[normalizeClientId(row.client)]} · v${row.clientVersion ?? CODEBUDDY_CLIENT_VERSIONS[normalizeClientId(row.client)]}`,
        },
        ...row.environment === undefined
          ? []
          : [{
              key: t('environmentLabel'),
              value: CODEBUDDY_ENVIRONMENT_LABELS[row.environment as keyof typeof CODEBUDDY_ENVIRONMENT_LABELS] ?? row.environment,
            }],
        // 服务端点：企业账号的自建/专享地址体现在这里。
        ...row.endpoint === undefined ? [] : [{ key: t('serviceEndpoint'), value: row.endpoint }],
        // 额度上限与顶部「剩余额度」配对——只看剩余量无法判断还剩几成。
        // 仅在额度查询成功时列出：失败时该值为 0，展示会误导。
        ...row.creditOk && row.totalCapacity > 0
          ? [{ key: t('quotaCapacity'), value: formatCredit(row.totalCapacity) }]
          : [],
        // ── 当前状态 ──
        // 企业账号不支持签到（checkinOk 为 false），因此该行按能力条件渲染，
        // 而不是显示一行「不支持」这种否定信息。
        ...row.checkinOk
          ? [{ key: t('checkinStatus'), value: row.todayCheckedIn === true ? t('checkinDone') : t('checkinTodo') }]
          : [],
      ]

  return (
    <DshModal
      title={t('accountInfoTitle')}
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
            activeKey={topKey}
            onChange={(key: string) => { setTopKey(key as TopTab) }}
          >
            <DshTabs.TabPane
              itemKey="identity"
              tab={<span className="dsh-codebuddy-resource-tab">{t('accountIdentity')}<i>{identityData.length}</i></span>}
            >
              <div className="dsh-codebuddy-account-identity">
                {/* 单列：key 在左、value 在右，一行一项。多列会让列宽被最长的一项
                    （企业全名）撑开、短项留出大片空白，反而不如单列整齐。
                    layout 仍显式写 horizontal —— 默认的 vertical 是 key/value
                    上下排，一行会变成两行、高度翻倍。 */}
                <DshDescriptions
                  className="dsh-codebuddy-account-descriptions"
                  align="left"
                  size="small"
                  layout="horizontal"
                  column={1}
                  data={identityData}
                />
              </div>
            </DshTabs.TabPane>
            <DshTabs.TabPane
              itemKey="usage"
              tab={<span className="dsh-codebuddy-resource-tab">{t('accountUsage')}<i>{items.length}</i></span>}
            >
              {/* 二级 Tab：套餐的三种状态。用 button 型与顶层 line 型区分层级——
                  同一套线型会让两层看起来平级。 */}
              <div className="dsh-codebuddy-resource-status">
                <div className="dsh-codebuddy-panel-section-title">
                  <strong>{t('accountResourceStatus')}</strong>
                </div>
                <DshTabs
                  type="button"
                  size="small"
                  activeKey={statusKey}
                  onChange={(key: string) => { setStatusKey(key as ResourceLifecycle) }}
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
            </DshTabs.TabPane>
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
  // 同时依赖账号代际（accountEpoch）：设置页切换、或宿主自动切换当前账号时，
  // 面板不会重挂载（keep-alive），只有代际变化才能让它重取 —— 否则「当前账号」
  // 徽标与「设为当前账号」的可用状态会停留旧值，直到手动刷新。
  const accountVersion = useSyncExternalStore(subscribeAccountEpoch, accountEpoch, accountEpoch)
  const { data, loading, reload } = usePanelData<{ accounts: PanelAccountRow[], currentId?: string }>(
    rpc, 'panelStatus', {}, [rosterTick, accountVersion],
  )
  const [busyId, setBusyId] = useState<string | undefined>(undefined)
  // 资源包弹框目标账号。
  const [resourceTarget, setResourceTarget] = useState<PanelAccountRow | undefined>(undefined)
  // 自动签到开关状态：开启时隐藏手动签到动作。
  // 三个开关直接来自持久化 store：useStore 内部即 useSyncExternalStore，因此
  // 设置页或后台面板任一处的写入（含跨标签）都会自动反映到这里。
  // 自动签到开启时隐藏手动签到动作；自动切换开启时隐藏「设为当前账号」。
  const autoCheckinOn = useStore($autoCheckin)
  const autoSwitchOn = useStore($autoSwitch)
  const autoTravelOn = useStore($autoTravel)
  // 资源台账版本：记录完本次探测结果后自增，让卡片用上最新的分类。
  const [ledgerTick, setLedgerTick] = useState(0)
  const rows = data?.accounts ?? []

  // 每次探测都把实时资源包并入本地台账（写持久化 store 属于副作用，放 effect）。
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
    // 挂载时**从 Host 采纳**配置，而不是把本地的推上去。
    //
    // 曾经这里把三个开关的持久化值推给主机，会让 Host 上更新的值被旧 localStorage
    // 静默覆盖（与设置页同一问题）。现在方向统一为「Host 为准」；store 的 set 带
    // 相等性检查，值相同时不通知，因此不会触发回写循环。
    void rpc.call<{
      autoSwitch: boolean
      autoSwitchThresholdPct: number
      autoCheckin: boolean
      autoTravel: boolean
      hasStoredPrefs: boolean
    }>(CODEBUDDY_AUTH_CHANNEL, 'autoPrefs', {}).then((result) => {
      if (!result.ok) return
      const host = result.value
      if (!host.hasStoredPrefs) return   // 老用户升级由设置页负责迁移，面板不重复推
      $autoSwitch.set(host.autoSwitch)
      $autoCheckin.set(host.autoCheckin)
      $autoTravel.set(host.autoTravel)
    })
    // 偏好变化后把新值同步给 host。展示值本身由 store 驱动（见上面的 useStore），
    // 这里只负责 host 侧：面板关闭时组件仍挂载，设置页改动的开关必须让 host 也知道。
    return subscribeUsagePref(() => {
      void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoCheckin', { enabled: $autoCheckin.get() })
      void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoTravel', { enabled: $autoTravel.get() })
      void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoSwitch', { enabled: $autoSwitch.get() })
    })
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
      {/* 原「积分管理」页的账号积分总览，迁入本页顶部：四张指标卡与账号列表
          同源同屏，读者不必在两个菜单之间来回切换。 */}
      <CreditsOverview rows={rows} t={t} />
      {/* 区块头常驻（不随「有账号」条件渲染）：添加账号按钮放在标题右侧，
          空列表时必须仍可用——那正是最需要添加入口的情形。 */}
      <div className="dsh-codebuddy-panel-section-head">
        {/* 左端：标题 + 主操作。添加账号紧贴标题右侧，与右端动作区两端对齐。
            主操作放左端而非右端：右侧是开关与刷新这类次级控件，主操作混在其中
            会被削弱；贴标题则与「这一屏在管什么」直接相邻。 */}
        <div className="dsh-codebuddy-accounts-head-lead">
          <div className="dsh-codebuddy-panel-section-title"><strong>{t('accountsTitle')}</strong><span>{rows.length}</span></div>
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
        {/* 右端：次级控件。 */}
        <div className="dsh-codebuddy-accounts-head-actions">
          <AutoSwitchToggle
            checked={autoSwitchOn}
            t={t}
            onChange={(checked: boolean) => {
              $autoSwitch.set(checked)
              // 只传 enabled：阈值由设置页维护，主机侧缺省沿用当前值，避免这里
              // 把用户在设置页调好的阈值覆盖回默认。
              void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoSwitch', { enabled: checked })
            }}
          />
          <AutoCheckinToggle
            checked={autoCheckinOn}
            t={t}
            onChange={(checked: boolean) => {
              $autoCheckin.set(checked)
              void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoCheckin', { enabled: checked })
            }}
          />
          <AutoTravelToggle
            checked={autoTravelOn}
            t={t}
            onChange={(checked: boolean) => {
              $autoTravel.set(checked)
              void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoTravel', { enabled: checked })
            }}
          />
          <DshButton size="small" theme="light" icon={<DshIconRefresh />} onClick={reload}>{t('refresh')}</DshButton>
        </div>
      </div>
      {rows.length === 0 ? (
        <DshEmpty title={t('accountsEmpty')} />
      ) : (
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
                longTerm: t('resourceLongTerm'),
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
              autoSwitch={autoSwitchOn}
              onSwitch={(id) => { void switchOne(id) }}
              onDelete={(row_) => { onDelete(row_) }}
              onRename={(row_) => { onRename(row_) }}
              onOpenResources={(row_) => { setResourceTarget(row_) }}
            />
          ))}
        </div>
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

/**
 * 账号积分总览（原「积分管理」页的主要内容，现迁入「账号管理」页顶部）。
 *
 * 数据由调用方以 props 传入而非自己拉取：账号页已经通过 `panelStatus` 拿到了
 * 同一份 `PanelAccountRow[]`（含 `resources`），再拉一次既浪费一次 RPC，
 * 也会让两处数据出现短暂不一致。因此这里只负责呈现。
 *
 * 展示四张指标：剩余额度、积分包总数、可用账号、已掉线。
 */
function CreditsOverview({ rows, t }: { rows: readonly PanelAccountRow[], t: Translate }): ReactNode {
  if (rows.length === 0) return null
  const totalRemaining = rows.reduce((sum, row) => sum + row.totalRemaining, 0)
  const resourceCount = rows.reduce((sum, row) => sum + row.resources.length, 0)
  const usableCount = rows.filter(row => row.usable).length
  const offlineCount = rows.filter(row => row.expired).length
  return (
    <div className="dsh-codebuddy-credits-overview">
      {/* 区块标题沿用页面既有写法（strong + 计数），与下方「账号管理」区块同级，
          读者一眼看出这组指标属于积分而非账号。
          计数用**账号数**而非积分包数：后者已作为「积分包」指标出现在卡片里，
          重复显示同一个数字没有增量信息。 */}
      <div className="dsh-codebuddy-panel-section-title">
        <strong>{t('creditTitle')}</strong>
        <span>{rows.length}</span>
      </div>
      <DshCard className="dsh-codebuddy-panel-stat-card">
        <div className="dsh-codebuddy-panel-stat-grid">
          <StatMetric icon={<DshIconElementStroked />} label={t('remaining')} value={formatCredit(totalRemaining)} />
          <StatMetric icon={<DshIconElementStroked />} label={t('creditResourceCount')} value={String(resourceCount)} />
          <StatMetric icon={<DshIconUser />} label={t('creditUsable')} value={`${usableCount}/${rows.length}`} />
          <StatMetric icon={<DshIconElementStroked />} label={t('accountOffline')} value={String(offlineCount)} />
        </div>
      </DshCard>
    </div>
  )
}

/**
 * 时间范围选择器：互斥单选的按钮组。
 *
 * 完全使用 Semi 原生样式，插件侧不写任何 CSS 覆盖：
 *
 * - 激活项 `theme="solid" type="primary"`，未激活项 `theme="borderless"`。
 * - 激活态的「底色 + 文字色」由 DSH 主题指定（见 packages/dsh-semi-ui 的
 *   theme.scss）：浅色主题是近黑底 + 白字，深色主题是白底 + 近黑字——两套都是
 *   硬编码的高对比配对。注意**不能**依赖 Semi 自身的实心按钮配色：它写死
 *   `color: rgba(var(--semi-white), 1)`，而 DSH 深色主题下主色填充是浅色，
 *   白字对比度仅 1.08:1。所幸主题层已正确处理，插件无需再介入。
 *
 * **组上不传 `theme` / `type`**：ButtonGroup 合并子 props 的顺序是
 * `{disabled,size,type}` → `itm.props` → `rest`，而 `theme` 不在它解构出的键里，
 * 于是落进 `rest` 并排在子按钮自身 props 之后——组上的值会逐个覆盖子按钮的值，
 * 激活态就永远显不出来。（`size` 被解构出去，可以安全地传。）
 *
 * 组件选取：用 ButtonGroup（本仓库 `DshButtonGroup`），不是 SplitButtonGroup。
 * 前者把相邻按钮的圆角相接成一条连续控件，符合「互斥单选一组」的语义。
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
    <DshButtonGroup size="small" className="dsh-codebuddy-panel-range" aria-label={label}>
      {options.map(key => (
        <DshButton
          key={key}
          size="small"
          // solid = 当前档位；borderless = 其余选项。
          theme={range === key ? 'solid' : 'borderless'}
          type={range === key ? 'primary' : 'tertiary'}
          // aria-pressed 给读屏表达选中态（纯视觉的 theme 切换对辅助技术不可见）。
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

/** 统计面板的维度：按工作区还是按模型聚合。 */
type StatsDimension = 'workspace' | 'model'

/** 维度切换的两个档位与文案键，顺序稳定（工作区在前）。 */
const DIMENSIONS: ReadonlyArray<{ key: StatsDimension, labelKey: 'tokenByWorkspace' | 'tokenByModel' }> = [
  { key: 'workspace', labelKey: 'tokenByWorkspace' },
  { key: 'model', labelKey: 'tokenByModel' },
]

/**
 * 日期范围选择器的**本地 props**。
 *
 * 为什么不直接用 `DshDatePickerProps`：本仓库的 pnpm 结构里
 * `@douyinfe/semi-foundation`（承载 DatePickerProps 的接口继承链）**无法被 TS
 * 解析**——它的 package.json 没有 main/module/types/exports 任何入口字段，是纯
 * 内容包；`skipLibCheck` 让这个解析失败被静默跳过，结果是 `DatePickerProps` 的
 * 继承链断裂、除自有字段外全部丢失（`type`、`density` 等全在 foundation 上）。
 * 已尝试把 foundation 加进 catalog 与两侧 devDependencies，均无效（插件视角仍
 * 解析不到）。
 *
 * 因此这里只声明**本面板实际用到的字段**（运行时 props 由 Semi 的 PropTypes 与
 * 内部实现正常消费，不受类型缺失影响）；styles 里对配色只改 semi 变量、不覆盖
 * 组件样式。若上游修好了入口字段，删掉本接口、恢复直接用 DshDatePickerProps。
 */
interface DatePickerRangeProps {
  type?: 'date' | 'dateRange'
  size?: 'small' | 'default' | 'large'
  density?: 'default' | 'compact'
  placeholder?: [string, string] | string
  value?: [Date, Date]
  onChange?: (date: Date | string | [Date, Date], ...rest: unknown[]) => void
  format?: string
  'aria-label'?: string
}

/** 维度切换（按工作区 / 按模型）。
 *
 * 交互复用时间周期的 `RangeToggle`：同一形态的互斥单选、同一种 solid/borderless
 * 激活表达，读者学一次就两个地方都会用。放在**面板内部**而不是页面级——两个面板
 * 可以各自停在维度上对比，与时间周期独立面板的理由相同。
 */
function DimensionToggle({ dimension, onChange, t }: {
  dimension: StatsDimension
  onChange: (value: StatsDimension) => void
  t: Translate
}): ReactNode {
  return (
    <DshButtonGroup size="small" className="dsh-codebuddy-panel-dimension" aria-label={t('tokenDimension')}>
      {DIMENSIONS.map(({ key, labelKey }) => (
        <DshButton
          key={key}
          size="small"
          theme={dimension === key ? 'solid' : 'borderless'}
          type={dimension === key ? 'primary' : 'tertiary'}
          aria-pressed={dimension === key}
          onClick={() => { onChange(key) }}
        >
          {t(labelKey)}
        </DshButton>
      ))}
    </DshButtonGroup>
  )
}

/**
 * 自定义日期范围选择器（Semi DatePicker `type="dateRange"` 的类型化薄包装）。
 *
 * 类型问题的背景见 `DatePickerRangeProps` 注释：semi-foundation 的类型链在本仓库
 * 无法解析，`DatePickerProps` 缺失大部分字段。包装在这里是为了让「值形状
 * （[Date, Date]）」与「清空语义」只有一处定义。
 *
 * 配色约束（用户要求）：**只改 semi 变量，不覆盖组件样式** —— 见
 * styles/panel-layout.scss 中 `.dsh-codebuddy-token-datepicker-scope` 的说明。
 */
function CustomRangePicker({ value, onChange, startPlaceholder, endPlaceholder, label }: {
  value: [Date, Date] | undefined
  onChange: (range: [Date, Date] | undefined) => void
  startPlaceholder: string
  endPlaceholder: string
  label: string
}): ReactNode {
  return (
    <DshDatePicker
      {...({
        type: 'dateRange',
        size: 'small',
        density: 'compact',
        placeholder: [startPlaceholder, endPlaceholder],
        value,
        onChange: (date: Date | string | [Date, Date] | undefined) => {
          // Semi dateRange 的值是 [Date, Date]；清空时是空串。
          const range = Array.isArray(date) && date[0] instanceof Date ? date as [Date, Date] : undefined
          onChange(range)
        },
        'aria-label': label,
      } as DatePickerRangeProps & { 'aria-label': string })}
    />
  )
}

/**
 * 一个统计面板的外壳：标题 + 该面板**自己的**时间周期选择器 + 局部刷新。
 *
 * 时间周期必须落在每个面板内部（而不是页面顶部一个全局选择器）：总览、趋势、
 * 工作区分布、模型分布、会话排行各自回答不同问题，读者经常需要让它们停在
 * 不同窗口上对比——全局选择器会强迫所有面板同时跳变，反而看不出差异。
 *
 * `hint`（副标题）已随「维度改为面板内切换」一并移除：维度以前就写在副标题里
 * （「按工作区」「按模型」），现在成了可切换的控件，再用一行小字重复它只会
 * 占掉一行高度；时间周期信息也一直由选择器自身表达。
 *
 * 刷新只作用于本面板；遮罩只盖住面板内容，卡片外壳不参与重建。
 */
function TokenPanel({ title, hint, extra, options, range, onRangeChange, rangeLabel, rangeFormat, refreshLabel, loading, onRefresh, children }: {
  title: string
  /**
   * 副标题（标题旁的小字）。
   *
   * 只保留**数据型**副标题（如「N 个活跃会话」「总计 X Token」——它们随数据变化、
   * 有信息量）。静态的维度副标题已删：那两处（用量分布/模型排行）的维度改成了
   * 面板内切换控件，再用小字重复一遍只会占高度。
   */
  hint?: string
  /** 面板内部的附加控件（如维度切换），渲染在标题行右侧、时间周期选择器之前。 */
  extra?: ReactNode
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
        <div className="dsh-codebuddy-panel-section-title"><strong>{title}</strong>{hint !== undefined && hint.length > 0 ? <span>{hint}</span> : null}</div>
        <div className="dsh-codebuddy-token-panel-actions">
          {extra}
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
  const [sessionsRange, setSessionsRange] = useState<TokenRangeKey>(DEFAULT_TOKEN_RANGE)
  /**
   * 用量分布与模型排行的维度（按工作区 / 按模型），各面板**独立**。
   *
   * 默认档沿用两个面板过去的固定视角（分布=工作区、排行=模型）——老读者打开页面
   * 看到的内容与之前一致，切换只是新增能力而不改变默认。
   */
  const [distributionDimension, setDistributionDimension] = useState<StatsDimension>('workspace')
  /**
   * 日期范围选择器的值（起点，终点为今天）。
   *
   * 选了自定义区间后 `distributionRange` 进入 'custom' 档；把按钮组切回任一固定档
   * 即退出自定义（选择器的值保留，便于再次进入）。
   */
  const [distributionDates, setDistributionDates] = useState<[Date, Date] | undefined>(undefined)
  const store = useMemo(() => new TokenStatsStore(rpc), [rpc])
  const overview = useTokenStats(store, overviewRange)
  const trend = useTokenStats(store, trendRange)
  const distribution = useTokenStats(store, distributionRange)
  const sessions = useTokenStats(store, sessionsRange)

  // 刷新失败必须说出来。因为 reload 刻意保留旧数据（否则会整页闪烁），
  // 失败时界面看起来「什么都没发生」——静默失败比报错更糟。
  const panels = [overview, trend, distribution, sessions]
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
  // 缓存写不再统计，因此没有对应系列。
  const cacheRateOf = (value: TokenStats): string => value.totals.cacheHitRate === undefined
    ? '—'
    : `${Math.round(value.totals.cacheHitRate * 100)}%`
  const SERIES = {
    input: 'var(--dcb-series-input)',
    output: 'var(--dcb-series-output)',
    cacheRead: 'var(--dcb-series-cache-read)',
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
            : <TokenUsageChart days={trend.data.days} inputLabel={t('tokenInput')} outputLabel={t('tokenOutput')} cacheReadLabel={t('tokenCacheRead')} recordsLabel={t('tokenRecords')} />}
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
      {/* 用量分布：独占一行。
          「模型用量排行」面板已移除 —— 它与分布面板共用同一份聚合
          （`TokenStats.workspaces` / `TokenStats.models`），维度改为可切换后
          两者能力完全重合，保留两个只会让同屏出现两份镜像数据。
          「按模型」视角保留在维度切换的第二档里。 */}
      <TokenPanel
        title={t('tokenDistribution')}
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
          {/* 维度切换放在**排行卡片内部**：它切换的是这份列表的统计口径，
              与列表是同一个整体；放面板头部会显得像在控制整个面板（含周期）。 */}
          <div className="dsh-codebuddy-token-card-toolbar">
            <DimensionToggle dimension={distributionDimension} onChange={setDistributionDimension} t={t} />
            <CustomRangePicker
              value={distributionDates}
              onChange={(range) => {
                if (range !== undefined) {
                  // 终点视为今天：窗口 = 起点相对今天的天数（至少 1）。
                  const days = Math.max(1, Math.ceil((Date.now() - range[0].getTime()) / 86_400_000) + 1)
                  setCustomRangeDays(days)
                  setDistributionRange('custom')
                } else {
                  // 清空选择 → 回到默认档。
                  setDistributionRange(DEFAULT_TOKEN_RANGE)
                }
              }}
              startPlaceholder={t('tokenDateStart')}
              endPlaceholder={t('tokenDateEnd')}
              label={t('tokenDateRange')}
            />
          </div>
          {distribution.data === undefined
            ? <div className="dsh-codebuddy-token-empty" />
            : distributionDimension === 'workspace'
              ? <WorkspaceList items={distribution.data.workspaces} empty={t('tokenNoWorkspace')} />
              : <BreakdownList items={distribution.data.models} empty={t('tokenNoModel')} />}
        </DshCard>
      </TokenPanel>
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
  recordsLabel: string
}

function cssVariable(element: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback
}

function TokenUsageChart({ days, inputLabel, outputLabel, cacheReadLabel, recordsLabel }: TokenUsageChartProps): ReactNode {
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
    const chart: ECharts = initChart(element, undefined, { renderer: 'canvas' })
    chart.setOption({
      aria: { enabled: true },
      animation: false,
      grid: { top: 32, right: 12, bottom: 28, left: 12, containLabel: true },
      // 图例：每个系列的 item 至少 20px 高，保证四个指标（输入/输出/缓存读/缓存写）
      // 都有足够的点击与辨认区域。
      //
      // itemWidth 必须与 itemHeight **相等**：ECharts 的图例色块是 roundRect，
      // 按 (itemWidth, itemHeight) 直接铺开，不保持宽高比——实测 path 数据：
      //   itemWidth 10 + itemHeight 20 → "M2.5 0L7.5 0 … L10 17.5 … L2.5 20 …"
      //   即 10 宽 20 高的竖条（色块被拉长）；
      //   20 × 20 → "M5 0L15 0 … L20 15 … L5 20 …" 即正方形。
      // 另测 symbolKeepAspect: true 对 roundRect 图标**无效**（path 完全不变），
      // 所以不能靠它补救，只能让宽高相等。
      legend: { top: 0, itemWidth: 20, itemHeight: 20, itemGap: 16, textStyle: { color: textColor } },
      // 窄屏下四个图例项会折成两行，压住绘图区。实测图例高度：
      //   单行 25px（itemWidth 10 时是 17px）／双行 61px，
      // 而 grid.top 固定 32px —— 双行时重叠 29px。
      // 用 media 按宽度抬高绘图区：单行保持紧凑，折行时自动让位。
      // 阈值取 420px：实测英文长标签（Cache write）在 itemWidth 20 下约 340px 处开始折行，
      // 留出余量以覆盖中文/其他语言与字体差异。
      media: [
        { query: { maxWidth: 420 }, option: { grid: { top: 68 } } },
      ],
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
        // 生效（源码按 stackStartValue 单独计算），因此占比极小的分段也始终可见
        // ——否则它的高度会被四舍五入成 0，整段从图例中「消失」。
        // 缓存写不再统计，故无该系列；顶部圆角改由最后一段（缓存读）承担。
        { name: inputLabel, type: 'bar', stack: 'tokens', barMaxWidth: 32, barMinHeight: 30, itemStyle: { color: inputColor }, data: days.map(day => day.input) },
        { name: outputLabel, type: 'bar', stack: 'tokens', barMaxWidth: 32, barMinHeight: 30, itemStyle: { color: outputColor }, data: days.map(day => day.output) },
        { name: cacheReadLabel, type: 'bar', stack: 'tokens', barMaxWidth: 32, barMinHeight: 30, itemStyle: { color: cacheReadColor, borderRadius: [3, 3, 0, 0] }, data: days.map(day => day.read) },
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
  }, [days, inputLabel, outputLabel, cacheReadLabel, recordsLabel])
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
      // 宿主判定失败时立即提示原因，而不是让用户等到 10 分钟超时。
      (reason: string) => {
        setLoginState(undefined)
        notify(false, `${t('loginFailed')} ${reason}`)
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginState, rpc])

  if (!snapshot.active) return null

  const pageTitle = snapshot.page === 'accounts' ? t('accountsTitle') : t('tokenTitle')
  // 副标题只在真有补充信息时才渲染。Token 页原先标题与描述同为 tokenTitle，
  // 于是 h1 下方又重复印了一遍「Token 统计」；既然没有额外信息可讲，就不渲染，
  // 由页面工具栏的「数据更新于 …」承担这一行的信息。
  const pageDescription = snapshot.page === 'accounts' ? t('accountsDesc') : undefined

  // 左侧菜单用彩色图标（semi-icons-lab）：该包是硬编码多色 fill 的彩色图标集，
  // 语义上分别对应账号（头像）、Token（图表）、积分（代币）。
  // 不能用 semi-icons —— 它（含 IconAI*）全部走 currentColor，是单色图标。
  const items = [
    { itemKey: 'accounts', text: t('accountsTitle'), icon: <DshIconLabAvatar /> },
    { itemKey: 'tokens', text: t('tokenTitle'), icon: <DshIconLabChart /> },
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
        {/* 右侧内容区：内层 Layout（不含 Sider）自动是 column，即上下布局。
            外层 Layout 含 Sider，Semi 会加 .semi-layout-has-sider 切成 row，
            于是整体就是「左菜单 + 右内容」，不需要自建 flex 容器。 */}
        <DshLayout className="dsh-codebuddy-panel-main">
          {/* header：固定不滚动（Layout.Header 渲染为语义化的 <header>）。 */}
          <DshLayout.Header className="dsh-codebuddy-panel-toolbar">
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
          </DshLayout.Header>

          {/* Content：唯一滚动容器（渲染为 <main>）。
              header 在它之外，因此滚动时保持固定。 */}
          <DshLayout.Content className="dsh-codebuddy-panel-views">
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
          {visited.has('tokens') ? (
            <div className="dsh-codebuddy-panel-view" hidden={snapshot.page !== 'tokens'}>
              <TokenStatsPage rpc={rpc} t={t} />
            </div>
          ) : null}
          </DshLayout.Content>
        </DshLayout>
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
/** 自动切换账号开关（账号页标题行）。与自动签到/自动旅行同构：受控组件，
 *  状态来自共享的持久化 store，切换时写 store 并同步到 host。
 *
 *  开启后本页隐藏「设为当前账号」入口——那时账号由客户端按剩余额度自动切换，
 *  手动指定会被下一次自动切换覆盖，留着这个按钮只会让用户以为设置没生效。 */
function AutoSwitchToggle({ checked, t, onChange }: {
  checked: boolean
  t: Translate
  onChange: (checked: boolean) => void
}): ReactNode {
  return (
    <DshTooltip content={t('autoSwitchDesc')}>
      <span className="dsh-codebuddy-auto-checkin-toggle">
        <span className="dsh-codebuddy-muted">{t('autoSwitch')}</span>
        <DshSwitch
          size="small"
          checked={checked}
          onChange={onChange}
          aria-label={t('autoSwitch')}
        />
      </span>
    </DshTooltip>
  )
}

/** 自动签到开关（账号页标题行）。受控组件：状态由 AccountsPage 持有并在
 *  切换时同步到 host（走共享的持久化 store，与设置页一致）。 */
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
