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
import type { ReactNode } from 'react'
import {
  DshButton,
  DshCard,
  DshDescriptions,
  DshEmpty,
  DshIconButton,
  DshIconArrowLeft,
  DshIconCommand,
  DshIconElementStroked,
  DshIconList,
  DshIconRefresh,
  DshIconUser,
  DshInput,
  DshLayout,
  DshModal,
  DshNav,
  DshProgress,
  DshSpin,
  DshSwitch,
  DshTag,
  DshToast,
} from '@tnnevol/dsh-semi-ui'
import { CODEBUDDY_AUTH_CHANNEL } from './constants.ts'
import { CODEBUDDY_ENVIRONMENT_LABELS } from '../constants.ts'
import type { CodeBuddyLocaleKey } from './locales.ts'
import type { ConnectionRpc, AccountsResult } from './rpc.ts'
import { describeRpcError } from './rpc.ts'
import { PanelRouteController } from './panel-route.ts'
import type { PanelRoute } from './panel-route.ts'
import { AddAccountModal, startLoginPolling } from '../components/AddAccountModal.tsx'
import { getAutoCheckinPref, getAutoSwitchPref, setAutoCheckinPref, setAutoSwitchPref } from './usage-prefs.ts'

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

function StatMetric({ icon, label, value }: { icon: ReactNode, label: string, value: string }): ReactNode {
  return (
    <div className="dsh-codebuddy-panel-stat">
      <div className="dsh-codebuddy-panel-stat-label">{icon}<span>{label}</span></div>
      <strong className="dsh-codebuddy-panel-stat-value">{value}</strong>
    </div>
  )
}

function SegmentBar({ segments }: { segments: Array<{ label: string, value: number, color: string }> }): ReactNode {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)
  return (
    <div className="dsh-codebuddy-panel-segment-wrap">
      <div className="dsh-codebuddy-panel-segment-bar" role="img" aria-label={segments.map(segment => `${segment.label} ${compact(segment.value)}`).join('，')}>
        {segments.map(segment => (
          <span key={segment.label} title={`${segment.label}: ${compact(segment.value)}`} style={{ width: total > 0 ? `${(Math.max(0, segment.value) / total) * 100}%` : '0%', background: segment.color }} />
        ))}
      </div>
      <div className="dsh-codebuddy-panel-segment-legend">
        {segments.map(segment => <span key={segment.label}><i style={{ background: segment.color }} />{segment.label}</span>)}
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
    remaining: string
    switchLabel: string
    deleteLabel: string
    noBalanceHint: string
  }
  busy: boolean
  onCheckin: (id: string) => void
  onSwitch: (id: string) => void
  onDelete: (row: PanelAccountRow) => void
  onRename: (row: PanelAccountRow) => void
}

function AccountCard({ row, labels, busy, onCheckin, onSwitch, onDelete, onRename }: AccountCardProps): ReactNode {
  const env = row.environment
  const name = row.nickname
  const { active, offline, checkedIn, unchecked, remaining, switchLabel, deleteLabel, noBalanceHint } = labels
  const totalPct = row.totalCapacity > 0 ? Math.max(0, Math.min(100, (row.totalRemaining / row.totalCapacity) * 100)) : null
  const remainingSum = row.totalRemaining
  return (
    <DshCard className={'dsh-codebuddy-panel-card' + (row.active ? ' dsh-codebuddy-panel-card-active' : '')}>
      {/* 头部：头像 + 名称/环境 + 状态 chips + 更多（改备注名/删除） */}
      <div className="dsh-codebuddy-account-card-head">
        <span className="dsh-codebuddy-account-card-avatar" aria-hidden>{name.charAt(0).toUpperCase()}</span>
        <div className="dsh-codebuddy-account-card-main">
          <div className="dsh-codebuddy-account-card-title-row">
            <span className="dsh-codebuddy-account-name" title={name}>{name}</span>
            {row.active ? <DshTag size="small" type="solid" color="green">{active}</DshTag> : null}
            {row.expired ? <DshTag size="small" type="light" color="orange">{offline}</DshTag> : null}
            {env !== undefined
              ? <DshTag size="small" type="light">{CODEBUDDY_ENVIRONMENT_LABELS[env as keyof typeof CODEBUDDY_ENVIRONMENT_LABELS] ?? env}</DshTag>
              : null}
          </div>
          <div className="dsh-codebuddy-account-card-chips">
            {row.checkinOk
              ? (
                  <span className={'dsh-codebuddy-checkin-chip' + (row.todayCheckedIn === true ? ' dsh-codebuddy-checkin-chip-done' : '')}>
                    {row.todayCheckedIn === true ? checkedIn : unchecked}
                  </span>
                )
              : row.checkinError !== null
                ? <span className="dsh-codebuddy-muted">{row.checkinError}</span>
                : null}
          </div>
        </div>
        <span className="dsh-codebuddy-account-card-more">
          <DshButton size="small" type="tertiary" theme="light" onClick={() => { onRename(row) }}>{labels.active === '' ? '' : '改备注'}</DshButton>
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
                    <span className="dsh-codebuddy-muted">{row.resources.length} 个资源包</span>
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
                  {row.resources.slice(0, 2).map((r) => (
                    <div key={r.name} className="dsh-codebuddy-credit-resource-row">
                      <span className="dsh-codebuddy-credit-resource-name" title={r.name}>{r.name}</span>
                      <span className="dsh-codebuddy-credit-resource-meta">
                        {r.remaining !== null ? formatCredit(r.remaining) : '—'} / {r.total !== null ? formatCredit(r.total) : '∞'}
                        {r.resetsAt !== null ? ` · ${r.resetsAt}` : ''}
                      </span>
                    </div>
                  ))}
                </>
              )}
        </div>
      ) : (
        <div className="dsh-codebuddy-account-expired-pad">{offline}，请重新登录</div>
      )}

      {/* 操作：签到（未登录也保留手动）、设为当前（无余额禁用）、删除 */}
      <div className="dsh-codebuddy-account-card-footer">
        <DshButton size="small" theme="light" type="secondary" loading={busy} disabled={row.expired || !row.checkinOk} onClick={() => { onCheckin(row.id) }}>
          {row.todayCheckedIn === true ? checkedIn : unchecked}
        </DshButton>
        {row.active ? null : (
          <DshButton
            size="small"
            theme="light"
            type="secondary"
            disabled={!row.usable || row.expired}
            title={row.usable ? '' : noBalanceHint}
            onClick={() => { onSwitch(row.id) }}
          >
            {switchLabel}
          </DshButton>
        )}
        <div style={{ flex: 1 }} />
        <DshButton size="small" type="danger" theme="borderless" onClick={() => { onDelete(row) }}>{deleteLabel}</DshButton>
      </div>
    </DshCard>
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

  if (loading) return <DshSpin size="large" />
  const rows = data?.accounts ?? []
  return (
    <div className="dsh-codebuddy-panel-page">
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
            <DshButton size="small" theme="light" icon={<DshIconRefresh />} onClick={reload}>{t('refresh')}</DshButton>
          </div>
          <div className="dsh-codebuddy-panel-cards">
            {rows.map(row => (
            <AccountCard
              key={row.id}
              row={row}
              busy={busyId === row.id}
              labels={{
                active: t('accountActive'),
                offline: t('accountOffline'),
                checkedIn: t('checkinDone'),
                unchecked: t('checkinTodo'),
                remaining: t('remaining'),
                switchLabel: t('accountSwitch'),
                deleteLabel: t('accountRemove'),
                noBalanceHint: t('noBalanceHint'),
              }}
              onCheckin={(id) => { void checkinOne(id) }}
              onSwitch={(id) => { void switchOne(id) }}
              onDelete={(row_) => { onDelete(row_) }}
              onRename={(row_) => { onRename(row_) }}
            />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function CreditsPage({ rpc, t }: { rpc: ConnectionRpc, t: Translate }): ReactNode {
  const { data, loading, reload } = usePanelData<{ accounts: PanelAccountRow[], currentId?: string }>(rpc, 'panelStatus', {}, [])
  if (loading) return <DshSpin size="large" />
  const rows = data?.accounts ?? []
  if (rows.length === 0) return <DshEmpty title={t('accountsEmpty')} />
  const totalRemaining = rows.reduce((sum, row) => sum + row.totalRemaining, 0)
  const resourceCount = rows.reduce((sum, row) => sum + row.resources.length, 0)
  const usableCount = rows.filter(row => row.usable).length
  const offlineCount = rows.filter(row => row.expired).length
  return (
    <div className="dsh-codebuddy-panel-page">
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

function RangeToggle({ range, onChange }: { range: number, onChange: (value: number) => void }): ReactNode {
  return (
    <div className="dsh-codebuddy-panel-range" role="group" aria-label="统计时间范围">
      {[7, 30, 90].map(days => (
        <DshButton key={days} size="small" type={range === days ? 'primary' : 'secondary'} theme={range === days ? 'solid' : 'light'} onClick={() => { onChange(days) }}>
          {days === 7 ? '近 7 天' : days === 30 ? '近 30 天' : '近 90 天'}
        </DshButton>
      ))}
    </div>
  )
}

function BreakdownList({ items, empty }: { items: TokenStats['models'], empty: string }): ReactNode {
  if (items.length === 0) return <div className="dsh-codebuddy-token-empty">{empty}</div>
  return (
    <div className="dsh-codebuddy-token-breakdown-list">
      {items.slice(0, 6).map((item, index) => (
        <div key={item.name} className="dsh-codebuddy-token-breakdown-row">
          <div className="dsh-codebuddy-token-breakdown-label"><span className="dsh-codebuddy-token-rank">{String(index + 1).padStart(2, '0')}</span><strong title={item.name}>{item.name}</strong><small>{item.calls} 次</small></div>
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
          <div className="dsh-codebuddy-token-breakdown-label"><span className="dsh-codebuddy-token-rank">{String(index + 1).padStart(2, '0')}</span><strong title={item.path ?? item.name}>{item.name}</strong><small>{item.calls} 次</small></div>
          <div className="dsh-codebuddy-token-breakdown-track"><i style={{ width: `${Math.min(100, item.percent)}%` }} /></div>
          <span className="dsh-codebuddy-token-breakdown-value">{compact(item.total)}</span>
        </div>
      ))}
    </div>
  )
}

function SessionRanking({ items, empty }: { items: TokenStats['sessions'], empty: string }): ReactNode {
  if (items.length === 0) return <div className="dsh-codebuddy-token-empty">{empty}</div>
  return (
    <div className="dsh-codebuddy-token-session-list">
      {items.slice(0, 8).map((item, index) => (
        <div key={item.id} className="dsh-codebuddy-token-session-row">
          <span className="dsh-codebuddy-token-rank">{String(index + 1).padStart(2, '0')}</span>
          <div className="dsh-codebuddy-token-session-main"><strong title={item.title}>{item.title}</strong><small title={item.workspace}>{item.workspace ?? '未指定工作区'} · {item.calls} 次调用</small></div>
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

function ActivityGrid({ activity }: { activity: TokenStats['activity'] }): ReactNode {
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

  return (
    <div className="dsh-codebuddy-token-activity-shell">
      <div className="dsh-codebuddy-token-weekdays" aria-hidden="true"><span /><span>一</span><span /><span>三</span><span /><span>五</span><span /></div>
      <div className="dsh-codebuddy-token-activity-scroll">
        <div className="dsh-codebuddy-token-months" style={{ gridTemplateColumns: `repeat(${weekCount}, 12px)` }} aria-hidden="true">
          {monthLabels.map((label, index) => <span key={`${index}-${label}`}>{label}</span>)}
        </div>
        <div className="dsh-codebuddy-token-activity-grid" style={{ gridTemplateColumns: `repeat(${weekCount}, 12px)` }} role="img" aria-label="最近一年 CodeBuddy Token 活动热力图">
          {cells.map((item, index) => {
            if (item === undefined) return <span key={`padding-${index}`} className="is-padding" aria-hidden="true" />
            const level = item.tokens === 0 ? 0 : Math.min(4, Math.ceil((item.tokens / max) * 4))
            return <span key={item.day} className={`level-${level}`} title={`${item.day} · ${compact(item.tokens)} · ${item.calls} 次调用`} />
          })}
        </div>
      </div>
    </div>
  )
}

function TokenStatsPage({ rpc, t }: { rpc: ConnectionRpc, t: Translate }): ReactNode {
  const [range, setRange] = useState<number>(30)
  const { data, loading, reload } = usePanelData<TokenStats>(rpc, 'tokenStats', { days: range }, [range])

  if (loading) {
    return <div className="dsh-codebuddy-panel-page dsh-codebuddy-token-loading"><DshSpin size="large" /></div>
  }
  if (data === undefined) {
    return <div className="dsh-codebuddy-panel-page"><DshEmpty title={t('usageUnavailable')} /></div>
  }

  const toolbar = (
    <div className="dsh-codebuddy-token-toolbar">
      <div>
        <strong>{t('tokenOverview')}</strong>
        <p className="dsh-codebuddy-muted">{t('tokenProviderSubtitle')}</p>
      </div>
      <div className="dsh-codebuddy-token-toolbar-actions">
        <RangeToggle range={range} onChange={setRange} />
        <DshButton size="small" theme="light" icon={<DshIconRefresh />} onClick={reload}>{t('refresh')}</DshButton>
      </div>
    </div>
  )

  const hasAnyActivity = data.activity.some(item => item.calls > 0)
  if (!hasAnyActivity) {
    return (
      <div className="dsh-codebuddy-panel-page dsh-codebuddy-panel-tokens">
        {toolbar}
        <DshCard className="dsh-codebuddy-token-empty-card">
          <DshEmpty
            image={<DshIconCommand size="extra-large" />}
            title={t('tokenNoDataTitle')}
            description={<span>{t('tokenNoDataDesc')}<small>{t('tokenNoDataHint')}</small></span>}
          >
            <DshButton type="primary" theme="light" icon={<DshIconRefresh />} onClick={reload}>{t('refresh')}</DshButton>
          </DshEmpty>
        </DshCard>
      </div>
    )
  }

  const cacheRate = data.totals.cacheHitRate === undefined ? '—' : `${Math.round(data.totals.cacheHitRate * 100)}%`
  const colors = ['var(--dcb-signal)', 'var(--dcb-violet)', 'var(--dcb-amber)', 'var(--dcb-mint)']
  return (
    <div className="dsh-codebuddy-panel-page dsh-codebuddy-panel-tokens">
      {toolbar}
      <DshCard className="dsh-codebuddy-token-overview-card">
        <div className="dsh-codebuddy-token-overview-head">
          <div>
            <span>{t('tokenTotal')}</span>
            <strong>{compact(data.totals.total)}</strong>
          </div>
          <DshTag color="green" type="light">{data.totals.sessions} {t('tokenActiveSessions')}</DshTag>
        </div>
        <SegmentBar segments={[
          { label: t('tokenInput'), value: data.totals.input, color: colors[0]! },
          { label: t('tokenOutput'), value: data.totals.output, color: colors[1]! },
          { label: t('tokenCacheRead'), value: data.totals.read, color: colors[2]! },
          { label: t('tokenCacheWrite'), value: data.totals.write, color: colors[3]! },
        ]} />
        <div className="dsh-codebuddy-token-overview-stats">
          <StatMetric icon={<DshIconArrowLeft />} label={t('tokenInput')} value={compact(data.totals.input)} />
          <StatMetric icon={<DshIconCommand />} label={t('tokenOutput')} value={compact(data.totals.output)} />
          <StatMetric icon={<DshIconElementStroked />} label={t('tokenCacheRate')} value={cacheRate} />
          <StatMetric icon={<DshIconElementStroked />} label={t('tokenRecords')} value={compact(data.totals.records)} />
        </div>
      </DshCard>
      <section className="dsh-codebuddy-token-section">
        <div className="dsh-codebuddy-panel-section-title"><strong>{t('tokenTrend')}</strong><span>{compact(data.totals.total)} Token</span></div>
        <DshCard className="dsh-codebuddy-panel-chart-card">
          <TokenUsageChart days={data.days} inputLabel={t('tokenInput')} outputLabel={t('tokenOutput')} cacheReadLabel={t('tokenCacheRead')} cacheWriteLabel={t('tokenCacheWrite')} recordsLabel={t('tokenRecords')} />
        </DshCard>
      </section>
      <section className="dsh-codebuddy-token-section">
        <div className="dsh-codebuddy-panel-section-title"><strong>{t('tokenActivity')}</strong><span>{t('tokenDaily')}</span></div>
        <DshCard className="dsh-codebuddy-token-activity-card">
          <div className="dsh-codebuddy-token-activity-meta"><span>{t('tokenActivityRange')}</span><span>{compact(data.totals.records)} {t('tokenRecords')}</span></div>
          <ActivityGrid activity={data.activity} />
          <div className="dsh-codebuddy-token-activity-scale"><span>少</span><i className="level-1" /><i className="level-2" /><i className="level-3" /><i className="level-4" /><span>多</span></div>
        </DshCard>
      </section>
      <div className="dsh-codebuddy-token-columns">
        <section className="dsh-codebuddy-token-section">
          <div className="dsh-codebuddy-panel-section-title"><strong>{t('tokenDistribution')}</strong><span>{t('tokenByWorkspace')}</span></div>
          <DshCard className="dsh-codebuddy-token-list-card"><WorkspaceList items={data.workspaces} empty={t('tokenNoWorkspace')} /></DshCard>
        </section>
        <section className="dsh-codebuddy-token-section">
          <div className="dsh-codebuddy-panel-section-title"><strong>{t('tokenModels')}</strong><span>{t('tokenByModel')}</span></div>
          <DshCard className="dsh-codebuddy-token-list-card"><BreakdownList items={data.models} empty={t('tokenNoModel')} /></DshCard>
        </section>
      </div>
      <section className="dsh-codebuddy-token-section">
        <div className="dsh-codebuddy-panel-section-title"><strong>{t('tokenTopSessions')}</strong><span>{t('tokenTopTen')}</span></div>
        <DshCard className="dsh-codebuddy-token-list-card"><SessionRanking items={data.sessions} empty={t('tokenNoSession')} /></DshCard>
      </section>
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
    const inputColor = cssVariable(element, '--dsw-alias-brand-primary', '#4f7cff')
    const outputColor = cssVariable(element, '--dsw-alias-state-success-primary', '#26a269')
    const cacheReadColor = cssVariable(element, '--dsw-alias-label-tertiary', '#8b93a7')
    const cacheWriteColor = cssVariable(element, '--dsw-alias-state-warn-primary', '#e8a317')
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
        { name: inputLabel, type: 'bar', stack: 'tokens', barMaxWidth: 32, itemStyle: { color: inputColor }, data: days.map(day => day.input) },
        { name: outputLabel, type: 'bar', stack: 'tokens', barMaxWidth: 32, itemStyle: { color: outputColor }, data: days.map(day => day.output) },
        { name: cacheReadLabel, type: 'bar', stack: 'tokens', barMaxWidth: 32, itemStyle: { color: cacheReadColor }, data: days.map(day => day.read) },
        { name: cacheWriteLabel, type: 'bar', stack: 'tokens', barMaxWidth: 32, itemStyle: { color: cacheWriteColor, borderRadius: [3, 3, 0, 0] }, data: days.map(day => day.write) },
        { name: recordsLabel, type: 'line', yAxisIndex: 1, smooth: true, symbol: 'none', lineStyle: { type: 'dashed', width: 2 }, data: days.map(day => day.records) },
      ],
    })
    const resize = (): void => { chart.resize() }
    const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize)
    if (resizeObserver !== undefined) resizeObserver.observe(element)
    else window.addEventListener('resize', resize)
    return () => {
      resizeObserver?.disconnect()
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
  const pageDescription = snapshot.page === 'accounts'
    ? t('accountsDesc')
    : snapshot.page === 'credits' ? t('creditResourceCount') : t('tokenTitle')

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
            header={{ text: 'CodeBuddy' }}
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
              <p className="dsh-codebuddy-muted">{pageDescription}</p>
            </div>
            <div style={{ flex: 1 }} />
            {snapshot.page === 'accounts' ? (
              <CodeBuddyPreferenceToggles rpc={rpc} t={t} />
            ) : null}
          </div>

          {snapshot.page === 'accounts' ? (
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
          ) : null}
          {snapshot.page === 'credits' ? <CreditsPage rpc={rpc} t={t} /> : null}
          {snapshot.page === 'tokens' ? <TokenStatsPage rpc={rpc} t={t} /> : null}
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

/** 自动切换偏好（与设置页同一键）。 */
const autoSwitchPref = (): boolean => getAutoSwitchPref()

/** 自动签到偏好（与设置页同一键）。 */
const autoCheckinPref = (): boolean => getAutoCheckinPref()

/** 账号页右上偏好开关：自动切换 + 自动签到。状态写入 localStorage（与设置页
 *  共享）并同步到 host；host 在开关打开时维护每日/周期签到循环。 */
function CodeBuddyPreferenceToggles({ rpc, t }: { rpc: ConnectionRpc, t: Translate }): ReactNode {
  const [autoSwitchOn, setAutoSwitchOn] = useState<boolean>(autoSwitchPref())
  const [autoCheckinOn, setAutoCheckinOn] = useState<boolean>(autoCheckinPref())
  // 打开面板即把本地偏好同步到 host（host 冷启动默认开）。
  useEffect(() => {
    void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoSwitch', { enabled: autoSwitchOn })
    void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoCheckin', { enabled: autoCheckinOn })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpc])
  const setSwitch = (checked: boolean): void => {
    setAutoSwitchOn(checked)
    setAutoSwitchPref(checked)
    void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoSwitch', { enabled: checked })
  }
  const setCheckin = (checked: boolean): void => {
    setAutoCheckinOn(checked)
    setAutoCheckinPref(checked)
    void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoCheckin', { enabled: checked })
  }
  return (
    <span className="dsh-codebuddy-panel-auto-switch">
      <span className="dsh-codebuddy-muted">{t('autoSwitch')}</span>
      <DshSwitch
        size="small"
        checked={autoSwitchOn}
        onChange={(checked: boolean) => { setSwitch(checked) }}
        aria-label={t('autoSwitch')}
      />
      <span className="dsh-codebuddy-muted">{t('autoCheckin')}</span>
      <DshSwitch
        size="small"
        checked={autoCheckinOn}
        onChange={(checked: boolean) => { setCheckin(checked) }}
        aria-label={t('autoCheckin')}
      />
    </span>
  )
}
