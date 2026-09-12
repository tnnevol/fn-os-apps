/**
 * Token 资源包展示：
 *  - `ResourceRowImpl`：单行资源包，左侧状态条 + 名称与用量 + 剩余/总量；
 *  - `ResourceGroupImpl`：一个生命周期分组的内容；
 *  - `liveResourcesOfImpl`：把账号行里的实时资源包转成台账输入；
 *  - `RESOURCE_LIFECYCLE_META`：三个生命周期的标签/颜色配置。
 *
 * 卡片与弹框共用同一组组件（参见 ui/account-resources-modal.tsx）。
 *
 * @module dsh-codebuddy/ui/resource-row
 */

import type { CSSProperties, ReactNode } from 'react'
import { DshProgress, DshTypography } from '@tnnevol/dsh-semi-ui'
import type { CodeBuddyLocaleKey } from '../locales/index.ts'
import type { ClassifiedResource, LiveResource, ResourceLifecycle } from '../resource-history.ts'
import type { PanelAccountRow, Translate } from '../panel-types.ts'
import { formatCredit } from './loading-shared.tsx'

/** 资源包生命周期元数据：标签、空态文案、主题色。 */
export const RESOURCE_LIFECYCLE_META_IMPL: Record<ResourceLifecycle, { labelKey: CodeBuddyLocaleKey, emptyKey: CodeBuddyLocaleKey, color: string }> = {
  usable: { labelKey: 'resourcesUsable', emptyKey: 'resourcesEmptyUsable', color: 'var(--dsw-alias-state-success-primary)' },
  depleted: { labelKey: 'resourcesDepleted', emptyKey: 'resourcesEmptyDepleted', color: 'var(--dsw-alias-state-warn-primary)' },
  expired: { labelKey: 'resourcesExpired', emptyKey: 'resourcesEmptyExpired', color: 'var(--dsw-alias-label-tertiary)' },
}

/** 卡片行优先展示的套餐数：卡片是概览，全量台账在弹框里。 */
export const CARD_RESOURCE_LIMIT_IMPL = 2

/** 把一个账号的实时资源包转成台账输入（卡片与弹框共用同一映射）。 */
export function liveResourcesOfImpl(row: PanelAccountRow): LiveResource[] {
  return row.resources.map(r => ({
    name: r.name,
    total: r.total,
    remaining: r.remaining,
    resetsAt: r.resetsAt,
  }))
}

/** 一行资源包：左侧状态条 + 名称与用量 + 右侧剩余/总量。 */
export function ResourceRowImpl({ item, t }: {
  item: ClassifiedResource
  t: Translate
}): ReactNode {
  const meta = RESOURCE_LIFECYCLE_META_IMPL[item.lifecycle]
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
export function ResourceGroupImpl({ items, lifecycle, t }: {
  items: ClassifiedResource[]
  lifecycle: ResourceLifecycle
  t: Translate
}): ReactNode {
  const meta = RESOURCE_LIFECYCLE_META_IMPL[lifecycle]
  if (items.length === 0) {
    return <p className="dsh-codebuddy-resource-empty">{t(meta.emptyKey)}</p>
  }
  return (
    <div className="dsh-codebuddy-resource-list">
      {items.map(item => <ResourceRowImpl key={item.key} item={item} t={t} />)}
    </div>
  )
}
