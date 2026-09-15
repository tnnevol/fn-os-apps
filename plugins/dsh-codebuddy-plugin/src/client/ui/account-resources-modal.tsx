/**
 * 账号资源包弹框：身份信息 + 用量信息两级 Tab。
 *
 * 关注点：弹框的视觉与状态——它消费 AccountRow + 分类后的资源包，但自己不发起
 * RPC；切换账号即换 row，从 props 拿数据。
 *
 * 为什么把身份信息也做成 Tab（而不是与台账上下堆叠）：身份字段有 8–10 项，用
 * Semi `Descriptions` 的**默认纵向布局**时每项占「key 一行 + value 一行」，单是
 * 这一段就有约 400px，加上顶部摘要与台账列表会逼近视口高度。改成 Tab 后同一时刻
 * 只渲染一页，弹框高度由最高的那一页决定。
 *
 * @module dsh-codebuddy/ui/account-resources-modal
 */

import type { TopTab } from '../../types/client/ui/account-resources-modal'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { DshDescriptions, DshModal, DshTabs, DshTag, DshTypography } from '@tnnevol/dsh-semi-ui'
import {
  CODEBUDDY_CLIENT_LABELS, CODEBUDDY_CLIENT_VERSIONS, CODEBUDDY_ENVIRONMENT_LABELS,
  normalizeClientId,
} from '../../contracts/constants.ts'
import type { ClassifiedResource, ResourceLifecycle } from '../resource-history.ts'
import { identityRows } from '../identity.ts'
import type { PanelAccountRow, Translate } from '../../types/client/panel-types'
import type { ConnectionRpc } from '../rpc.ts'
import { formatCredit } from './loading-shared.tsx'
import { RESOURCE_LIFECYCLE_META_IMPL, ResourceGroupImpl } from './resource-row.tsx'
import { GrowthTaskList } from './growth-task-list.tsx'

export function AccountResourcesModalImpl({ row, items, t, rpc, notify, onClose, onOpenLog }: {
  row: PanelAccountRow | undefined
  items: ClassifiedResource[]
  t: Translate
  rpc: ConnectionRpc
  notify: (ok: boolean, text: string) => void
  onClose: () => void
  /** 单项任务执行时打开日志抽屉（抽屉挂在面板层，见 panel.tsx）。 */
  onOpenLog?: () => void
}): ReactNode {
  const [topKey, setTopKey] = useState<TopTab>('identity')
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
      ...identityRows((row.account ?? { uid: '—', nickname: '' }) as Parameters<typeof identityRows>[0], {
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
      ...row.endpoint === undefined ? [] : [{ key: t('serviceEndpoint'), value: row.endpoint }],
      ...row.creditOk && row.totalCapacity > 0
        ? [{ key: t('quotaCapacity'), value: formatCredit(row.totalCapacity) }]
        : [],
      // ── 当前状态 ──
      ...row.checkinOk
        ? [{ key: t('checkinStatus'), value: row.todayCheckedIn === true ? t('checkinDone') : t('checkinTodo') }]
        : [],
    ]

  return (
    <DshModal
      title={t('accountInfoTitle')}
      visible={row !== undefined}
      footer={null}
      size="large"
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
                      tab={<span className="dsh-codebuddy-resource-tab">{t(RESOURCE_LIFECYCLE_META_IMPL[lifecycle].labelKey)}<i>{groups[lifecycle].length}</i></span>}
                    >
                      <ResourceGroupImpl items={groups[lifecycle]} lifecycle={lifecycle} t={t} />
                    </DshTabs.TabPane>
                  ))}
                </DshTabs>
              </div>
            </DshTabs.TabPane>
            <DshTabs.TabPane
              itemKey="growth"
              tab={<span className="dsh-codebuddy-resource-tab">{t('growthTasksTitle')}</span>}
            >
              <GrowthTaskList
                rpc={rpc}
                t={t}
                accountId={row.id}
                accountName={row.name}
                notify={notify}
                {...onOpenLog === undefined ? {} : { onOpenLog }}
              />
            </DshTabs.TabPane>
          </DshTabs>
        </div>
      )}
    </DshModal>
  )
}
