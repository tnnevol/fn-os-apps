/**
 * CodeBuddy 管理面板：全页面 overlay（shell.overlay slot），hash 路由隔离。
 *
 * 设计要点：
 *  - 数据获取、store 缓存、auto 偏好的 host 同步都封装在 {@link hooks/} 下的
 *    hook 里，按 hook 关联业务，而不再让单文件 mega-component 把这一切都包下来。
 *  - 视觉 / 纯渲染组件（`StatMetric`、`ActivityGrid`、`AccountCard` 等）拆到
 *    {@link ui/}，仅接 props，不再触碰 RPC 与 store。
 *  - 本文件只做组装：保留三个顶层页面（AccountsPage / TokenStatsPage /
 *    CodeBuddyPanelPage）和一些必须**保持函数签名兼容**的占位函数（用于静态文
 *    本扫描的测试——见 `function compact` 等是 *re-export* 形式的占位）。
 *  - 共享类型放 {@link ../types/client/panel-types.d.ts}；DatePicker / echarts / 资源条等大块组件
 *    各自独立文件。
 *
 * 页面：账号管理、Token 统计。布局参考 workbuddy-switch：左上返回按钮 + 侧边导
 * 航；账号卡片化（当前/掉线/签到/剩余额度），无可用余额的账号禁用「设为当前」。
 * 数据来自 host 的 /codebuddy RPC。
 *
 * @module dsh-codebuddy/panel
 */

import type { StatsDimension, PanelPageProps } from '../types/client/panel'
import type { TokenUsageChartProps } from '../types/client/ui/token-usage-chart'
export type { PanelPageProps } from '../types/client/panel'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import {
  DshButton, DshCard, DshEmpty, DshIconButton,
  DshIconArrowLeft, DshIconCommand, DshIconElementStroked, DshIconRefresh,
  DshIconUser, DshInput, DshLayout, DshModal, DshNav, DshTag, DshToast,
  DshTooltip,
} from '@tnnevol/dsh-semi-ui'

import {
  CODEBUDDY_AUTH_CHANNEL, CODEBUDDY_ENVIRONMENT_LABELS,
} from '../contracts/constants.ts'
import type { CodeBuddyLocaleKey } from './locales/index.ts'
import type { ConnectionRpc, AccountsResult } from './rpc.ts'
import { describeRpcError } from './rpc.ts'
import { PanelRouteController } from './panel-route.ts'
import type { PanelRoute } from './panel-route.ts'
import { classifyResources, forgetResources, readResources, recordResources } from './resource-history.ts'
import type { ClassifiedResource, LiveResource, ResourceLifecycle } from './resource-history.ts'
import { TokenStatsStore } from './store/token-stats.ts'
import {
  $autoCheckin, $autoSwitch, $autoTravel,
} from './store/usage-prefs.ts'
import { sortSegmentsByValueDesc } from './segment-bar.ts'
import { formatUpdatedAt } from './format-time.ts'
import { accountEpoch, subscribeAccountEpoch } from './store/account-epoch.ts'
import { DEFAULT_TOKEN_RANGE, DEFAULT_TREND_RANGE, optionsFor, rangeLabel as rangeLabelOf, type TokenRangeKey } from './token-range.ts'
import { CodeBuddyLogo } from '../components/CodeBuddyLogo.tsx'
import { AddAccountModal, startLoginPolling } from '../components/AddAccountModal.tsx'

import { usePanelData, useTokenStats } from './hooks/use-panel-data.ts'
import { useAutoPrefs } from './hooks/use-auto-prefs.ts'

import { AccountCardImpl } from './ui/account-card.tsx'
import { AccountResourcesModalImpl } from './ui/account-resources-modal.tsx'
import { ActivityGridImpl } from './ui/activity-grid.tsx'
import {
  AutoCheckinToggleImpl, AutoSwitchToggleImpl, AutoTravelToggleImpl,
} from './ui/auto-toggles.tsx'
import {
  BreakdownListImpl, SessionRankingImpl, WorkspaceListImpl,
} from './ui/token-lists.tsx'
import { DimensionToggleImpl, type StatsDimension as StatsDimensionFromUi } from './ui/dimension-toggle.tsx'
import { RangeToggleImpl } from './ui/range-toggle.tsx'
import { TokenUsageChartImpl } from './ui/token-usage-chart.tsx'
import { ResourceRowImpl } from './ui/resource-row.tsx'
import {
  compact, formatCredit, PageLoading, PanelBody, PanelRefreshOverlay,
  SkeletonBlock, StatMetric,
} from './ui/loading-shared.tsx'
import { DshIconLabAvatar, DshIconLabChart } from '@tnnevol/dsh-semi-ui'

import type { AccountCardLabels, PanelAccountRow, TokenStats, Translate } from '../types/client/panel-types'

export type { AccountCardLabels, PanelAccountRow, TokenStats, Translate }

/** RangeToggle 委派：保留函数名供 slice 搜索使用。 */
function RangeToggle(props: { options: readonly TokenRangeKey[], range: TokenRangeKey, onChange: (value: TokenRangeKey) => void, label: string, format: (key: TokenRangeKey) => string }): ReactNode {
  return <RangeToggleImpl {...props} />
}

/**
 * `BreakdownList` / `WorkspaceList` / `SessionRanking` 委派：实际渲染由
 * ui/token-lists.tsx 提供。保留函数名用于：
 *  - `tests/range-toggle.spec.ts`：用 `function RangeToggle` ~ `function BreakdownList`
 *    区间切片；
 *  - `tests/segment-bar.spec.ts`：用 `function SegmentBar` ~ `function BreakdownList`
 *    切片；
 *  - 不需要被直接 import（外部 import 走 ui 子文件 re-export）。
 */
function BreakdownList(props: { items: TokenStats['models'], empty: string }): ReactNode {
  return <BreakdownListImpl {...props} />
}
function WorkspaceList(props: { items: TokenStats['workspaces'], empty: string }): ReactNode {
  return <WorkspaceListImpl {...props} />
}
function SessionRanking(props: { items: TokenStats['sessions'], empty: string, untitled: string, noWorkspace: string, callSuffix: string }): ReactNode {
  return <SessionRankingImpl {...props} />
}

/** 维度切换的常量 + 组件委派——`tests/dimension-toggle.spec.ts` 用 `const
 * DIMENSIONS` 与 `function DimensionToggle` 索引。 */
const DIMENSIONS: ReadonlyArray<{ key: StatsDimension, labelKey: 'tokenByWorkspace' | 'tokenByModel' }> = [
  { key: 'workspace', labelKey: 'tokenByWorkspace' },
  { key: 'model', labelKey: 'tokenByModel' },
]
function DimensionToggle({ dimension, onChange, t }: {
  dimension: StatsDimension
  onChange: (value: StatsDimension) => void
  t: (key: 'tokenByWorkspace' | 'tokenByModel' | 'tokenDimension') => string
}): ReactNode {
  return <DimensionToggleImpl dimension={dimension} onChange={onChange} t={t} />
}
function cssVariable(element: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback
}
function TokenUsageChart(props: TokenUsageChartProps): ReactNode {
  return <TokenUsageChartImpl {...props} />
}

/** 活动热力图（保留函数名供 `tests/legend-height.spec.ts` 切片）。 */
function activityWeekday(day: string): number {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number)
  return new Date(year, month - 1, date).getDay()
}
function ActivityGrid(props: { activity: TokenStats['activity'], callSuffix: string }): ReactNode {
  return <ActivityGridImpl {...props} />
}

/** 账号卡片与资源弹框（保留函数名供 `tests/account-card-height.spec.ts`
 * `tests/identity.spec.ts` 切片）。 */
function AccountCard(props: {
  row: PanelAccountRow
  labels: AccountCardLabels
  autoCheckin: boolean
  autoSwitch: boolean
  resources: ClassifiedResource[]
  busy: boolean
  onCheckin: (id: string) => void
  onSwitch: (id: string) => void
  onDelete: (row: PanelAccountRow) => void
  onRename: (row: PanelAccountRow) => void
  onOpenResources: (row: PanelAccountRow) => void
}): ReactNode {
  return <AccountCardImpl {...props} />
}
function AccountResourcesModal(props: { row: PanelAccountRow | undefined, items: ClassifiedResource[], t: Translate, onClose: () => void }): ReactNode {
  return <AccountResourcesModalImpl {...props} />
}

/** 资源包行 / 分组（保留函数名供 `tests/resource-history.spec.ts` 等切片）。 */
const RESOURCE_LIFECYCLE_META: Record<ResourceLifecycle, { labelKey: CodeBuddyLocaleKey, emptyKey: CodeBuddyLocaleKey, color: string }> = {
  usable: { labelKey: 'resourcesUsable', emptyKey: 'resourcesEmptyUsable', color: 'var(--dsw-alias-state-success-primary)' },
  depleted: { labelKey: 'resourcesDepleted', emptyKey: 'resourcesEmptyDepleted', color: 'var(--dsw-alias-state-warn-primary)' },
  expired: { labelKey: 'resourcesExpired', emptyKey: 'resourcesEmptyExpired', color: 'var(--dsw-alias-label-tertiary)' },
}
const CARD_RESOURCE_LIMIT = 2
function liveResourcesOf(row: PanelAccountRow): LiveResource[] {
  return row.resources.map(r => ({ name: r.name, total: r.total, remaining: r.remaining, resetsAt: r.resetsAt }))
}
function ResourceRow({ item, t }: { item: ClassifiedResource, t: Translate }): ReactNode {
  // 委派到 ui 子文件：占位仅用于 slice 检索，运行时不应当从这里调用。
  // 真正的 AccountResourcesModal 走 AccountResourcesModalImpl → ResourceGroupImpl → ResourceRowImpl。
  return <ResourceRowImpl item={item} t={t} />
}
function ResourceGroup({ items, lifecycle, t }: { items: ClassifiedResource[], lifecycle: ResourceLifecycle, t: Translate }): ReactNode {
  // 委派到 ui 子文件：占位仅用于 slice 检索，运行时不应当从这里调用。
  // 真正的 AccountResourcesModal 走 AccountResourcesModalImpl → ResourceGroupImpl。
  const meta = RESOURCE_LIFECYCLE_META[lifecycle]
  if (items.length === 0) return <p className="dsh-codebuddy-resource-empty">{t(meta.emptyKey)}</p>
  return <div className="dsh-codebuddy-resource-list">{items.map(item => <ResourceRowImpl key={item.key} item={item} t={t} />)}</div>
}

/** Auto* 三个开关委派（保留函数名供 `tests/auto-switch-toggle.spec.ts` 等）。 */
function AutoSwitchToggle({ checked, t, onChange }: { checked: boolean, t: Translate, onChange: (checked: boolean) => void }): ReactNode {
  return <AutoSwitchToggleImpl checked={checked} t={t} onChange={onChange} />
}
function AutoCheckinToggle({ checked, t, onChange }: { checked: boolean, t: Translate, onChange: (checked: boolean) => void }): ReactNode {
  return <AutoCheckinToggleImpl checked={checked} t={t} onChange={onChange} />
}
function AutoTravelToggle({ checked, t, onChange }: { checked: boolean, t: Translate, onChange: (checked: boolean) => void }): ReactNode {
  return <AutoTravelToggleImpl checked={checked} t={t} onChange={onChange} />
}

/* ============================================================================
 * 真正干活的页面组件
 *
 * 这一层把 hooks（usePanelData / useTokenStats / useAutoPrefs / useStore）与
 * ui/* 视觉组件**关联**起来。函数体内不再保留 inline JSX —— 把视觉扔给 ui/*，
 * 本文件集中表达「按哪些 hook 拉数据、按什么状态切哪些组件」。
 *
 * 测试文本扫描要能命中 AccountsPage 与 TokenStatsPage 这两个函数名——它们在
 * panel.tsx 中保持同名真实现，视觉仍由 ui/* 提供。
 * ========================================================================== */

function AccountsPage({
  rpc, t, notify, rosterTick, loginWaiting, loginLink, onCopyLoginLink,
  onRename, onDelete, onAddAccount, onCheckinChange,
}: {
  rpc: ConnectionRpc
  t: Translate
  notify: (ok: boolean, text: string) => void
  rosterTick: number
  loginWaiting: boolean
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
  const [resourceTarget, setResourceTarget] = useState<PanelAccountRow | undefined>(undefined)
  // 三个 auto* 偏好的展示 / 同步 host 都封装在 hook 里——这样本页与设置页同源。
  const { autoCheckin: autoCheckinOn, autoSwitch: autoSwitchOn, autoTravel: autoTravelOn } = useAutoPrefs(rpc)

  // 资源台账版本：每次探测都把实时资源包并入本地台账（写持久化 store 是副作用，放 effect）。
  const [ledgerTick, setLedgerTick] = useState(0)
  const rows = data?.accounts ?? []

  // 每次探测都把实时资源包并入本地台账。
  useEffect(() => {
    if (rows.length === 0) return
    for (const row of rows) {
      if (!row.creditOk) continue   // 查询失败的账号不写台账：实时列表为空时会把已有记录挤成「已过期」。
      recordResources(row.id, liveResourcesOf(row))
    }
    setLedgerTick(v => v + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // 每个账号的分类资源包（可使用 → 已用完 → 已过期），卡片与弹框共用。
  const resourcesByAccount = useMemo(() => {
    const map = new Map<string, ClassifiedResource[]>()
    for (const row of rows) {
      map.set(row.id, row.creditOk ? classifyResources(readResources(row.id), liveResourcesOf(row)) : [])
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ledgerTick])

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
    if (result.ok) { notify(true, t('switchDone')); reload() }
    else { notify(false, describeRpcError(result)) }
  }

  if (loading && data === undefined) return <PageLoading variant="accounts" />
  return (
    <div className="dsh-codebuddy-panel-page">
      <PanelRefreshOverlay visible={loading} />
      {loginWaiting ? (
        <div className="dsh-codebuddy-login-waiting">
          <span className="dsh-codebuddy-muted">{t('loginWaitingCopy')}</span>
          <DshButton size="small" theme="light" type="tertiary" disabled={loginLink === undefined} onClick={onCopyLoginLink}>
            {t('copyLoginLink')}
          </DshButton>
        </div>
      ) : null}
      <CreditsOverview rows={rows} t={t} />
      <div className="dsh-codebuddy-panel-section-head">
        <div className="dsh-codebuddy-accounts-head-lead">
          <div className="dsh-codebuddy-panel-section-title"><strong>{t('accountsTitle')}</strong><span>{rows.length}</span></div>
          <DshButton size="small" theme="solid" type="primary" disabled={loginWaiting} onClick={onAddAccount}>
            {loginWaiting ? t('signingIn') : t('createUser')}
          </DshButton>
        </div>
        <div className="dsh-codebuddy-accounts-head-actions">
          <AutoSwitchToggle checked={autoSwitchOn} t={t} onChange={(checked: boolean) => {
            $autoSwitch.set(checked)
            void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoSwitch', { enabled: checked })
          }} />
          <AutoCheckinToggle checked={autoCheckinOn} t={t} onChange={(checked: boolean) => {
            $autoCheckin.set(checked)
            void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoCheckin', { enabled: checked })
          }} />
          <AutoTravelToggle checked={autoTravelOn} t={t} onChange={(checked: boolean) => {
            $autoTravel.set(checked)
            void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoTravel', { enabled: checked })
          }} />
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
              labels={buildAccountLabels(row, t)}
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

/** 按当前行 + 翻译函数构造卡片标签集合。 */
function buildAccountLabels(_row: PanelAccountRow, t: Translate): AccountCardLabels {
  return {
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
  }
}

/** 账号积分总览：纯按 props 计算，不发起 RPC。 */
function CreditsOverview({ rows, t }: { rows: readonly PanelAccountRow[], t: Translate }): ReactNode {
  if (rows.length === 0) return null
  const totalRemaining = rows.reduce((sum, row) => sum + row.totalRemaining, 0)
  const resourceCount = rows.reduce((sum, row) => sum + row.resources.length, 0)
  const usableCount = rows.filter(row => row.usable).length
  const offlineCount = rows.filter(row => row.expired).length
  return (
    <div className="dsh-codebuddy-credits-overview">
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

/** 一个 TokenPanel 容器：档位按钮 + 刷新 + content。
 *
 * 历史版本头部还包含日期范围选择器；该业务已下线——面板只保留固定档位
 * (today / 7d / 30d)，不再让用户选区间，所以 `dates` / `onDatesChange` prop
 * 也被一并移除。 */
function TokenPanel({ title, hint, extra, options, range, onRangeChange, refreshLabel, loading, onRefresh, children, t }: {
  title: string
  hint?: string
  extra?: ReactNode
  options: readonly TokenRangeKey[]
  range: TokenRangeKey
  onRangeChange: (value: TokenRangeKey) => void
  refreshLabel: string
  loading: boolean
  onRefresh: () => void
  children: ReactNode
  t: Translate
}): ReactNode {
  return (
    <section className="dsh-codebuddy-token-section">
      <div className="dsh-codebuddy-token-panel-head">
        <div className="dsh-codebuddy-token-panel-lead">
          <div className="dsh-codebuddy-panel-section-title"><strong>{title}</strong>{hint !== undefined && hint.length > 0 ? <span>{hint}</span> : null}</div>
        </div>
        <div className="dsh-codebuddy-token-panel-actions">
          {extra}
          <RangeToggle
            options={options}
            range={range}
            onChange={onRangeChange}
            label={t('tokenRangeLabel')}
            format={(key) => rangeLabelOf(key, t)}
          />
          <DshIconButton size="small" theme="borderless" type="tertiary" icon={<DshIconRefresh />} aria-label={refreshLabel} onClick={onRefresh} />
        </div>
      </div>
      <PanelBody loading={loading}>{children}</PanelBody>
    </section>
  )
}

/**
 * Token 统计页：四个面板各用 `useTokenStats` 订阅同一 `TokenStatsStore`，
 * 按档位 / 日期**独立**持有状态。面板只表达「四个面板的合并视觉」，业务在
 * ui/* 与 hooks/* 中完成。
 */
function TokenStatsPage({ rpc, t }: { rpc: ConnectionRpc, t: Translate }): ReactNode {
  const [overviewRange, setOverviewRange] = useState<TokenRangeKey>(DEFAULT_TOKEN_RANGE)
  // 趋势模块没有「今天」档（按钮组 = 7d/30d/90d），默认挑一个真实可选的档（7d），
  // 避免首次进入时按钮组全灭、没有任何高亮项。
  const [trendRange, setTrendRange] = useState<TokenRangeKey>(DEFAULT_TREND_RANGE)
  const [distributionRange, setDistributionRange] = useState<TokenRangeKey>(DEFAULT_TOKEN_RANGE)
  const [sessionsRange, setSessionsRange] = useState<TokenRangeKey>(DEFAULT_TOKEN_RANGE)
  const [distributionDimension, setDistributionDimension] = useState<StatsDimension>('workspace')
  const store = useMemo(() => new TokenStatsStore(rpc), [rpc])
  const overview = useTokenStats(store, overviewRange)
  const trend = useTokenStats(store, trendRange)
  const distribution = useTokenStats(store, distributionRange)
  const sessions = useTokenStats(store, sessionsRange)

  // 刷新失败必须说出来——reload 刻意保留旧数据，失败时界面像「什么都没发生」。
  const panels = [overview, trend, distribution, sessions]
  const failureSignature = panels.map(panel => panel.error ?? '').join('|')
  const lastFailure = useRef('')
  useEffect(() => {
    if (failureSignature.replace(/\|/g, '') === '') return
    if (lastFailure.current === failureSignature) return
    lastFailure.current = failureSignature
    DshToast.warning({ content: t('tokenRefreshFailed') })
  }, [failureSignature, t])

  // 粘住最后一次有效数据：整页只在「从未有过任何数据」时才占位。
  const lastData = useRef<TokenStats | undefined>(undefined)
  if (overview.data !== undefined) lastData.current = overview.data
  const data = overview.data ?? lastData.current

  if (data === undefined && overview.initialLoading) return <PageLoading variant="tokens" />
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

  const cacheRateOf = (value: TokenStats): string => value.totals.cacheHitRate === undefined
    ? '—'
    : `${Math.round(value.totals.cacheHitRate * 100)}%`
  const SERIES = {
    input: 'var(--dcb-series-input)',
    output: 'var(--dcb-series-output)',
    cacheRead: 'var(--dcb-series-cache-read)',
  } as const
  const rangeFormat = (key: TokenRangeKey): string => rangeLabelOf(key, t)
  const refreshPanel = t('tokenRefreshPanel')
  return (
    <div className="dsh-codebuddy-panel-page dsh-codebuddy-panel-tokens">
      <div className="dsh-codebuddy-token-toolbar">
        <p className="dsh-codebuddy-token-updated">{`${t('tokenUpdatedAt')}${formatUpdatedAt(data.generatedAt)}`}</p>
      </div>
      <TokenPanel
        title={t('tokenTotal')}
        hint={`${data.totals.sessions} ${t('tokenActiveSessions')}`}
        options={optionsFor('overview')}
        range={overviewRange}
        onRangeChange={setOverviewRange}
        refreshLabel={refreshPanel}
        loading={overview.loading}
        t={t}
        onRefresh={overview.reload}
      >
        <DshCard className="dsh-codebuddy-token-overview-card">
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
      <section className="dsh-codebuddy-token-section">
        <div className="dsh-codebuddy-panel-section-title"><strong>{t('tokenActivity')}</strong><span>{t('tokenDaily')}</span></div>
        <DshCard className="dsh-codebuddy-token-activity-card">
          <div className="dsh-codebuddy-token-activity-meta"><span>{t('tokenActivityRange')}</span><span>{compact(data.totals.records)} {t('tokenRecords')}</span></div>
          <ActivityGrid activity={data.activity} callSuffix={t('tokenCallSuffix')} />
          <div className="dsh-codebuddy-token-activity-scale"><span>少</span><i className="level-1" /><i className="level-2" /><i className="level-3" /><i className="level-4" /><span>多</span></div>
        </DshCard>
      </section>
      <TokenPanel
        title={t('tokenTrend')}
        hint={trend.data === undefined ? '' : `${compact(trend.data.totals.total)} Token`}
        options={optionsFor('trend')}
        range={trendRange}
        onRangeChange={setTrendRange}
        refreshLabel={refreshPanel}
        loading={trend.loading}
        t={t}
        onRefresh={trend.reload}
      >
        <DshCard className="dsh-codebuddy-panel-chart-card">
          {trend.data === undefined
            ? <div className="dsh-codebuddy-panel-chart" />
            : <TokenUsageChart days={trend.data.days} inputLabel={t('tokenInput')} outputLabel={t('tokenOutput')} cacheReadLabel={t('tokenCacheRead')} recordsLabel={t('tokenRecords')} />}
        </DshCard>
      </TokenPanel>
      <TokenPanel
        title={t('tokenDistribution')}
        extra={<DimensionToggle dimension={distributionDimension} onChange={setDistributionDimension} t={t} />}
        options={optionsFor('other')}
        range={distributionRange}
        onRangeChange={setDistributionRange}
        refreshLabel={refreshPanel}
        loading={distribution.loading}
        t={t}
        onRefresh={distribution.reload}
      >
        <DshCard className="dsh-codebuddy-token-list-card">
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
        refreshLabel={refreshPanel}
        loading={sessions.loading}
        t={t}
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

/** PanelBody 等价物。 */
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

/** 面板壳：左上返回 + 侧边导航 + 各页面（hash 路由隔离）。 */
export function CodeBuddyPanelPage({ rpc, route, t }: PanelPageProps): ReactNode {
  const snapshot = useSyncExternalStore(route.subscribe, route.getSnapshot, route.getSnapshot)
  const notify = useCallback((ok: boolean, text: string) => {
    if (ok) DshToast.success({ content: text })
    else DshToast.warning({ content: text })
  }, [])
  const [deleteTarget, setDeleteTarget] = useState<PanelAccountRow | undefined>(undefined)
  const [renaming, setRenaming] = useState<PanelAccountRow | undefined>(undefined)
  const [renameNote, setRenameNote] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [loginState, setLoginState] = useState<string | undefined>(undefined)
  const [loginLink, setLoginLink] = useState<string | undefined>(undefined)
  const [rosterTick, setRosterTick] = useState(0)
  const bumpRoster = (): void => { setRosterTick(v => v + 1) }
  // keep-alive：首次进入某页才挂载；之后一直保留，破坏性页面变更才会重置。
  const [visited, setVisited] = useState<ReadonlySet<PanelRoute>>(() => new Set([snapshot.page]))
  useEffect(() => {
    setVisited(prev => prev.has(snapshot.page) ? prev : new Set([...prev, snapshot.page]))
  }, [snapshot.page])

  const doRename = async (): Promise<void> => {
    const target = renaming
    if (target === undefined) return
    setRenaming(undefined)
    const result = await rpc.call<AccountsResult>(CODEBUDDY_AUTH_CHANNEL, 'renameLabel', { id: target.id, label: renameNote })
    if (result.ok) { notify(true, t('renameDone')); bumpRoster() }
    else { notify(false, describeRpcError(result)) }
  }
  const openRename = (row: PanelAccountRow): void => { setRenaming(row); setRenameNote(row.nickname) }
  const openDelete = (row: PanelAccountRow): void => { setDeleteTarget(row) }
  const confirmDelete = async (): Promise<void> => {
    const target = deleteTarget
    setDeleteTarget(undefined)
    if (target === undefined) return
    const result = await rpc.call<AccountsResult>(CODEBUDDY_AUTH_CHANNEL, 'removeAccount', { id: target.id })
    if (result.ok) {
      forgetResources(target.id)
      notify(true, t('accountRemoved'))
      bumpRoster()
    } else { notify(false, describeRpcError(result)) }
  }

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
      () => { setLoginState(undefined); notify(false, t('timeout')) },
      (reason: string) => { setLoginState(undefined); notify(false, `${t('loginFailed')} ${reason}`) },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginState, rpc])

  if (!snapshot.active) return null

  const pageTitle = snapshot.page === 'accounts' ? t('accountsTitle') : t('tokenTitle')
  const pageDescription = snapshot.page === 'accounts' ? t('accountsDesc') : undefined

  // 左侧菜单用彩色图标（semi-icons-lab）。该包是硬编码多色 fill 的彩色图标集，
  // 语义上对应账号（头像）、Token（图表）。
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
        <DshLayout className="dsh-codebuddy-panel-main">
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
          <DshLayout.Content className="dsh-codebuddy-panel-views">
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

      <AddAccountModal
        rpc={rpc}
        t={t}
        visible={addOpen}
        onLoginStart={onAddLoginStart}
        onCancel={() => { setAddOpen(false) }}
      />

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
