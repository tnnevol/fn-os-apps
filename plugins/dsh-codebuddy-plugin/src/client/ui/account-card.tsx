/**
 * 账号卡片：在 panel.tsx 中保留同名简短的委派函数（兼容静态文本扫描的测试），
 * 实际渲染逻辑全部在本文件。
 *
 * 关注点：账号单卡的视觉（头像 / 名称 / 状态 chips / 剩余额度 / 资源条 / 操作
 * 菜单），通过 props 接收数据（不再触碰 RPC 或 store）。
 *
 * @module dsh-codebuddy/ui/account-card
 */

import type { AccountCardProps } from '../../types/client/ui/account-card'
export type { AccountCardProps } from '../../types/client/ui/account-card'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import {
  DshCard, DshDropdown, DshIconButton, DshIconClose, DshIconEdit, DshIconMore, DshIconRefresh, DshIconSetting,
  DshProgress, DshTag, DshTooltip, DshTypography,
} from '@tnnevol/dsh-semi-ui'
import {
  CODEBUDDY_CLIENT_LABELS, CODEBUDDY_CLIENT_VERSIONS, CODEBUDDY_ENVIRONMENT_LABELS,
  normalizeClientId,
} from '../../contracts/constants.ts'
import { formatProbeAge, formatResetDate } from '../format-time.ts'


import { formatCredit } from './loading-shared.tsx'

export function AccountCardImpl({ row, labels, autoCheckin, autoSwitch, resources, busy, onCheckin, onSwitch, onDelete, onRename, onOpenResources }: AccountCardProps): ReactNode {
  const env = row.environment
  // 历史条目没有 client 字段（那时只有 CLI），缺省按 cli 展示。
  const clientId = normalizeClientId(row.client)
  const clientVersion = row.clientVersion ?? CODEBUDDY_CLIENT_VERSIONS[clientId]
  const name = row.nickname
  const { active, offline, checkedIn, unchecked, checkin, remaining, switchLabel, deleteLabel, renameLabel, longTerm } = labels
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
  const cardResources = resources.slice(0, 2)
  // 旅行状态 chip：只在能表达有用信息时渲染（企业账号没有成长中心）。
  const travelChip = ((): ReactNode => {
    const travel = row.travel
    if (row.enterprise || travel === null) return null
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
        <div className="dsh-codebuddy-account-card-head">
          <span className="dsh-codebuddy-account-card-avatar" aria-hidden>{name.charAt(0).toUpperCase()}</span>
          <div className="dsh-codebuddy-account-card-main">
            <div className="dsh-codebuddy-account-card-title-row">
              <DshTypography.Text className="dsh-codebuddy-account-name" ellipsis={{ showTooltip: true }}>
                {name}
              </DshTypography.Text>
            </div>
            <div className="dsh-codebuddy-account-card-tags">
              {row.active ? <DshTag size="small" type="solid" color="green">{active}</DshTag> : null}
              {row.expired ? <DshTag size="small" type="light" color="orange">{offline}</DshTag> : null}
              <DshTooltip content={`${CODEBUDDY_CLIENT_LABELS[clientId]} · v${clientVersion}`}>
                <DshTag size="small" type="light" className="dsh-codebuddy-client-tag">
                  {CODEBUDDY_CLIENT_LABELS[clientId]}
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

        {!row.expired ? (
          <div className="dsh-codebuddy-account-card-body">
            {!row.creditOk
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
                  <div className="dsh-codebuddy-account-card-resources">
                    {cardResources.map((r) => (
                      <div key={r.key} className={`dsh-codebuddy-credit-resource-row is-${r.lifecycle}`}>
                        <DshTypography.Text className="dsh-codebuddy-credit-resource-name" ellipsis={{ showTooltip: true }}>
                          {r.name}
                        </DshTypography.Text>
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
          <div className="dsh-codebuddy-account-body-state dsh-codebuddy-account-expired-pad">
            <span className="dsh-codebuddy-muted">{offline}，请重新登录</span>
          </div>
        )}
      </DshCard>
    </div>
  )
}
