/**
 * CodeBuddy 设置区块：应用内 OAuth 登录以及纯 UI 的用量偏好。
 *
 * 渲染在 `settings.section` 列表插槽中（保持原有界面），
 * 实时用量读数则移到了会话输入框中。
 */

import type { Phase, CodeBuddySectionProps } from '../types/components/CodeBuddySection'
export type { CodeBuddySectionProps } from '../types/components/CodeBuddySection'
import { useCallback, useEffect, useState } from 'react'
import { useStore } from '@nanostores/react'
import {
  DshButton,
  DshCollapse,
  DshDescriptions,
  DshIconButton,
  DshForm,
  DshIconAlertCircle,
  DshIconEdit,
  DshInput,
  DshModal,
  DshSlider,
  DshSwitch,
  DshTag,
  DshTooltip,
  DshTypography,
} from '@tnnevol/dsh-semi-ui'
import { CODEBUDDY_AUTH_CHANNEL } from '../contracts/constants.ts'


import type { AccountView, AccountsResult, AuthStatus, RpcErr } from '../client/rpc.ts'
import { describeRpcError } from '../client/rpc.ts'
import { AddAccountModal, startLoginPolling } from './AddAccountModal.tsx'
import { CodeBuddyLogo } from './CodeBuddyLogo.tsx'
import { PreferenceLabel } from './PreferenceLabel.tsx'
import {
  $autoCheckin,
  $autoSwitch,
  $autoSwitchThreshold,
  $autoTravel,
  $showUsage,
  adoptHostPrefs,
  setThreshold,
} from '../client/store/usage-prefs.ts'

/** 解码 CodeBuddy 的 base64 编码 UTF-8 `departmentFullName`。 */
function decodeDepartment(raw: string): string {
  try {
    const decoded = atob(raw)
    return new TextDecoder().decode(Uint8Array.from(decoded, (c) => c.charCodeAt(0)))
  } catch {
    return raw
  }
}

function describeError(result: RpcErr): string {
  return describeRpcError(result)
}

/** 剩余额度格式化（与面板卡片同一口径：万/亿）。 */
function formatBalance(n: number): string {
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}亿`
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`
  return String(Math.round(n))
}

export function CodeBuddySection({ rpc, t, panelRoute, close }: CodeBuddySectionProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [status, setStatus] = useState<AuthStatus | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [loginState, setLoginState] = useState<string | undefined>(undefined)
  /** 弹框发起的登录是否在途（该流程由弹框自己轮询与提示）。 */
  const [addWaiting, setAddWaiting] = useState(false)
  // 来自 host `accounts` 端点的多账号名册。
  const [accounts, setAccounts] = useState<AccountView[]>([])
  const [switchingId, setSwitchingId] = useState<string | undefined>(undefined)
  // 添加账号弹框（共享组件：备注名 + 环境 + 自定义 endpoint + 企业账号开关）。
  const [addOpen, setAddOpen] = useState(false)
  // 删除确认目标账号 id。
  const [removeTarget, setRemoveTarget] = useState<string | undefined>(undefined)
  // 五个偏好多直接来自持久化 store。useStore 内部是 useSyncExternalStore，
  // 因此设置页与后台面板里任一处的写入（含跨标签）都会自动反映过来，
  // 原先「手写订阅 effect + setState 镜像」的整套逻辑可以去掉。
  const showUsage = useStore($showUsage)
  const autoSwitch = useStore($autoSwitch)
  const autoSwitchPct = useStore($autoSwitchThreshold)
  const [editTarget, setEditTarget] = useState<string | undefined>(undefined)
  const [editNote, setEditNote] = useState('')
  // 各账号剩余额度快照（设置页用户信息面板展示；来源 panelStatus）。
  const [balanceByAccount, setBalanceByAccount] = useState<Record<string, { remaining: number, capacity: number, usable: boolean }>>({})

  const refresh = useCallback(async () => {
    const [statusResult, accountsResult] = await Promise.all([
      rpc.call<AuthStatus>(CODEBUDDY_AUTH_CHANNEL, 'status', {}),
      rpc.call<AccountsResult>(CODEBUDDY_AUTH_CHANNEL, 'accounts', {}),
    ])
    if (statusResult.ok) {
      setStatus(statusResult.value)
      setPhase('idle')
    } else {
      setError(describeError(statusResult))
      setPhase('error')
    }
    if (accountsResult.ok) {
      setAccounts(accountsResult.value.accounts)
    }
    // 用户信息面板「剩余额度」：并行拉取聚合状态，按账号 id 缓存。
    const balanceResult = await rpc.call<{ accounts: Array<{ id: string, totalRemaining: number, totalCapacity: number, usable: boolean }> }>(CODEBUDDY_AUTH_CHANNEL, 'panelStatus', {})
    if (balanceResult.ok) {
      const next: Record<string, { remaining: number, capacity: number, usable: boolean }> = {}
      for (const row of balanceResult.value.accounts) {
        next[row.id] = { remaining: row.totalRemaining, capacity: row.totalCapacity, usable: row.usable }
      }
      setBalanceByAccount(next)
    }
  }, [rpc])

  // 编辑备注名弹框打开时：捕获阶段拦截 ESC（Semi 的 Modal ESC 监听挂载在
  // document 上，捕获先于目标阶段触发，stopPropagation 阻止底层弹框/面板的
  // ESC 处理器收到事件——编辑弹框自己不带 closeOnEsc，由本监听器关闭）。
  useEffect(() => {
    if (editTarget === undefined) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' || event.keyCode === 27) {
        event.stopImmediatePropagation()
        setEditTarget(undefined)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('keydown', onKey, true) }
  }, [editTarget])

  // 挂载时加载一次状态，然后采纳 **Host** 的自动切换配置。
  //
  // 曾经这里是反的：挂载时把 localStorage 的值推给 Host。那会让 Host 上更新的
  // 值被旧 localStorage 静默覆盖（实测：Host 为 false/25 被上推成 true/10）。
  // 现在方向改为「读 Host → 写本地 store」：
  //   · Host 已有磁盘配置（hasStoredPrefs）→ 一律以 Host 为准；
  //   · Host 没有（老用户首次升级）→ 把 localStorage 的既有值一次性迁移上去。
  // store 的 set 带相等性检查，值相同时不通知，因此不会触发回写循环。
  useEffect(() => {
    void refresh()
    void rpc.call<{
      autoSwitch: boolean
      autoSwitchThresholdPct: number
      autoCheckin: boolean
      autoTravel: boolean
      hasStoredPrefs: boolean
    }>(CODEBUDDY_AUTH_CHANNEL, 'autoPrefs', {}).then((result) => {
      if (!result.ok) return
      const host = result.value
      if (host.hasStoredPrefs) {
        /**
         * Host 是权威：整组原子采纳它的值（可能来自另一个窗口的修改）。
         *
         * 与面板 hook 共用 `adoptHostPrefs`：这段逻辑原先两边各写一份，于是悄悄
         * 漂移了（这里采纳 4 项含阈值，hook 只采纳 3 个开关）。同一件事写两遍就
         * 会出现这种分歧，因此收敛到 store 模块里的单一实现。
         *
         * 它还负责整组抑制回推：这些是**共享的持久化 atom**，逐个裸 `set` 会同步
         * 触发别处的回推订阅（`useAutoPrefs` 挂在常驻的管理面板上），而回推读的是
         * 「当前全部偏好」——第一个 `set` 触发时其余尚未采纳，会把本地旧值推给
         * Host，把刚采纳的值又覆盖回去。
         */
        adoptHostPrefs(host)
        return
      }
      // 老用户升级路径：Host 尚无配置，把本地既有值迁移上去，只此一次。
      void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoSwitch', {
        enabled: $autoSwitch.get(),
        thresholdPct: $autoSwitchThreshold.get(),
      })
      void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoCheckin', { enabled: $autoCheckin.get() })
      void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoTravel', { enabled: $autoTravel.get() })
    })
  }, [refresh, rpc])

  // 轮询进行中的登录，直到完成或超过截止时间。
  useEffect(() => {
    if (loginState === undefined) return
    return startLoginPolling(
      rpc,
      loginState,
      () => { setLoginState(undefined); void refresh() },
      () => {
        setLoginState(undefined)
        setError(t('timeout'))
        setPhase('error')
      },
      // 宿主判定失败时立即把原因显示出来，不必等到超时。
      (reason: string) => {
        setLoginState(undefined)
        setError(`${t('loginFailed')} ${reason}`)
        setPhase('error')
      },
    )
  }, [loginState, rpc, refresh, t])

  /**
   * 接收共享添加账号弹框发起的登录：打开浏览器，并把「登录中」反映到本区块。
   *
   * 不把 state 交给本组件的轮询 effect：弹框自己已经在轮询它，两处同时轮询会
   * 对 `pollLogin` 发双份请求，并各自判定落定导致提示出现两次。本组件的轮询
   * 仍然保留，服务它自己发起的「重新登录」（`startRelogin`）。
   */
  const onAddLoginStart = useCallback((start: { authUrl: string, state: string }) => {
    // 开窗必须留在宿主：弹框只管握手与反馈，自己不碰 window。漏掉这一句的后果
    // 是登录页永远不出现，而按钮一直 loading 到十分钟超时，用户看不出原因。
    window.open(start.authUrl, '_blank', 'noopener')
    setAddWaiting(true)
  }, [])
  /** 弹框侧登录落定：成功则刷新名册；提示已由弹框给出，这里不重复。 */
  const onAddFinished = useCallback((ok: boolean) => {
    setAddWaiting(false)
    if (ok) void refresh()
  }, [refresh])

  // 掉线账号重新登录：保留其环境信息，直接发起握手（不激活为新当前账号）。
  const startRelogin = useCallback(async (account: AccountView) => {
    const result = await rpc.call<{ authUrl: string, state: string }>(CODEBUDDY_AUTH_CHANNEL, 'startLogin', {
      ...(account.label !== undefined ? { label: account.label } : {}),
      ...(account.environment !== undefined ? { environment: account.environment } : {}),
      activate: false,
    })
    if (!result.ok) {
      setError(describeRpcError(result))
      setPhase('error')
      return
    }
    window.open(result.value.authUrl, '_blank', 'noopener')
    setLoginState(result.value.state)
  }, [rpc])

  const toggleAutoSwitch = useCallback((enabled: boolean) => {
    $autoSwitch.set(enabled)
    void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoSwitch', { enabled, thresholdPct: autoSwitchPct })
  }, [rpc, autoSwitchPct])

  const changeAutoSwitchThreshold = useCallback((pct: number) => {
    // 走归一化写入：Slider 可能给出小数，直接 set 会让内存与存储不一致。
    setThreshold(pct)
    if (autoSwitch) {
      void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoSwitch', { enabled: true, thresholdPct: pct })
    }
  }, [rpc, autoSwitch])

  const renameLabel = useCallback(async (id: string, label: string) => {
    setError(undefined)
    const result = await rpc.call<AccountsResult>(CODEBUDDY_AUTH_CHANNEL, 'renameLabel', { id, label })
    if (result.ok) {
      setAccounts(result.value.accounts)
    } else {
      setError(describeError(result))
    }
  }, [rpc])

  const switchAccount = useCallback(async (id: string) => {
    setError(undefined)
    setSwitchingId(id)
    const result = await rpc.call<AccountsResult>(CODEBUDDY_AUTH_CHANNEL, 'switchAccount', { id })
    if (result.ok) {
      setAccounts(result.value.accounts)
    } else {
      setError(describeError(result))
    }
    setSwitchingId(undefined)
  }, [rpc])

  const removeAccount = useCallback(async (id: string) => {
    setError(undefined)
    const result = await rpc.call<AccountsResult>(CODEBUDDY_AUTH_CHANNEL, 'removeAccount', { id })
    if (result.ok) {
      setAccounts(result.value.accounts)
      await refresh()
    } else {
      setError(describeError(result))
    }
  }, [rpc, refresh])

  if (phase === 'loading') {
    return <div className="dsh-codebuddy-section"><p className="dsh-codebuddy-muted">{t('loading')}</p></div>
  }

  const signedIn = status?.loggedIn === true
  const hasAccounts = accounts.length > 0
  /**
   * 是否有任一登录流程在途：本区块的「重新登录」（`loginState`）或弹框的
   * 「添加账号」（`addWaiting`）。两者都应禁用添加按钮并显示「登录中」。
   */
  const busyLogin = loginState !== undefined || addWaiting

  return (
    <div className="dsh-codebuddy-section">
      <div className="dsh-codebuddy-title-row">
        <CodeBuddyLogo size={18} />
        <h2 className="dsh-codebuddy-title">CodeBuddy</h2>
      </div>
      {!signedIn ? <p className="dsh-codebuddy-desc">{t('intro')}</p> : null}
      {error !== undefined ? <p className="dsh-codebuddy-error">{error}</p> : null}

      {/* 多账号名册：每个已登录账号一个折叠面板。
          头部显示它是谁、是否当前、是否已掉线（refresh token 过期）；
          展开体承载账号资料、切换动作与移除。 */}
      <div className="dsh-codebuddy-accounts">
        <div className="dsh-codebuddy-accounts-head">
          <span className="dsh-codebuddy-accounts-title">{t('accountsTitle')}</span>
          <span className="dsh-codebuddy-accounts-head-actions">
            {panelRoute !== undefined ? (
              <DshButton
                htmlType="button"
                size="small"
                theme="light"
                type="secondary"
                onClick={() => { close?.(); panelRoute.open('accounts') }}
              >
                {t('managePanel')}
              </DshButton>
            ) : null}
            <DshButton
              htmlType="button"
              size="small"
              theme="solid"
              type="primary"
              disabled={busyLogin}
              onClick={() => { setAddOpen(true) }}
            >
              {busyLogin ? t('signingIn') : t('createUser')}
            </DshButton>
          </span>
        </div>
        <p className="dsh-codebuddy-accounts-desc">{busyLogin ? t('waiting') : t('accountsDesc')}</p>
        {/* 「重新登录」流程的等待提示。添加账号流程的反馈在弹框内（按钮 loading
            + 落定通知），不需要这条。 */}
        {loginState !== undefined ? <p className="dsh-codebuddy-muted">{t('waiting')}</p> : null}
        {hasAccounts
          ? (
              <>
                {(() => {
                  const offlineActive = accounts.find(account => account.active && account.expired)
                  const takeoverBy = offlineActive !== undefined
                    ? accounts.find(account => !account.expired && account.id !== offlineActive.id)
                    : undefined
                  return offlineActive !== undefined && takeoverBy !== undefined
                    ? (
                        <div className="dsh-codebuddy-account-takeover">
                          <DshIconAlertCircle aria-hidden />
                          <span>{t('accountTakeover')}</span>
                        </div>
                      )
                    : null
                })()}
                <DshCollapse className="dsh-codebuddy-accounts-collapse" expandIconPosition="left">
                  {accounts.map(account => {
                    const displayName = account.label !== undefined ? account.label : account.nickname
                    const balance = balanceByAccount[account.id]
                    return (
                      <DshCollapse.Panel
                        key={account.id}
                        itemKey={account.id}
                        header={(
                          <span className="dsh-codebuddy-account-header">
                            {/* 备注名可能很长：Typography.Text 截断，溢出时才挂 Tooltip。 */}
                            <DshTypography.Text className="dsh-codebuddy-account-name" ellipsis={{ showTooltip: true }}>{displayName}</DshTypography.Text>
                            {account.expired
                              ? <DshTag size="small" type="light" color="orange">{t('accountOffline')}</DshTag>
                              : account.active ? <DshTag size="small" type="solid" color="green">{t('accountActive')}</DshTag> : null}
                            <span className="dsh-codebuddy-account-header-actions">
                              {/* 编辑备注名始终在 collapse header（Semi 的 extra 在自定义 header
                                  下不渲染，故内联到 header 的 flex 流中） */}
                              <DshIconButton
                                size="small"
                                type="secondary"
                                theme="borderless"
                                icon={<DshIconEdit />}
                                aria-label={t('renameLabel')}
                                onClick={(event) => { event.stopPropagation(); setEditTarget(account.id); setEditNote(account.label ?? account.nickname) }}
                              />
                              {account.expired ? (
                                <DshButton size="small" theme="solid" type="primary" onClick={(event) => { event.stopPropagation(); void startRelogin(account) }}>
                                  {t('accountRelogin')}
                                </DshButton>
                              ) : null}
                            </span>
                          </span>
                        )}
                      >
                        {account.expired
                          ? (
                              <div className="dsh-codebuddy-account-expired">
                                <span className="dsh-codebuddy-account-expired-text">{t('accountExpiredDesc')}</span>
                                <DshButton
                                  htmlType="button"
                                  size="small"
                                  theme="solid"
                                  type="primary"
                                  onClick={() => { void startRelogin(account) }}
                                >
                                  {t('accountRelogin')}
                                </DshButton>
                              </div>
                            )
                          : (
                              <div className="dsh-codebuddy-account-body">
                                <DshDescriptions
                                  className="dsh-codebuddy-account-descriptions"
                                  align="left"
                                  size="small"
                                  data={([
                                    { key: t('uid'), value: account.uid },
                                    account.uin !== undefined ? { key: t('uin'), value: account.uin } : undefined,
                                    account.enterpriseName !== undefined ? { key: t('enterprise'), value: account.enterpriseName } : undefined,
                                    account.enterpriseId !== undefined ? { key: t('enterpriseId'), value: account.enterpriseId } : undefined,
                                    account.enterpriseUserName !== undefined ? { key: t('enterpriseUser'), value: account.enterpriseUserName } : undefined,
                                    account.departmentFullName !== undefined ? { key: t('department'), value: decodeDepartment(account.departmentFullName) } : undefined,
                                    // 剩余额度固定在最后一行
                                    { key: t('remaining'), value: balance !== undefined ? (balance.capacity > 0 ? formatBalance(balance.remaining) : t('usageUnavailable')) : t('usageUnavailable') },
                                  ] satisfies Array<{ key: string, value: string } | undefined>).filter((item): item is { key: string, value: string } => item !== undefined)}
                                />
                                <div className="dsh-codebuddy-account-remove">
                                  {/* 无可用余额时按钮被禁用，DOM title 在禁用按钮上
                                      不可靠（且与 Tooltip 组件不一致）：用 Tooltip 包裹
                                      说明禁用原因；有余额时直接渲染按钮，不挂 Tooltip。 */}
                                  {(() => {
                                    /**
                                     * 该账号正在切换中：显示转圈 + 「切换中…」并禁用。
                                     * 既解释这次请求为何短暂停顿，也避免重复点击——重复
                                     * 点击会让 host 连续换号，最终停在哪个账号取决于网络
                                     * 返回顺序。
                                     *
                                     * Semi 的 `loading` 只在「图标位」渲染转圈、文案照常
                                     * 显示，且**不会**自动禁用按钮（源码：`isLoading &&
                                     * !isDisabled` 才走 IconButton 分支），所以 disabled
                                     * 必须显式传。
                                     */
                                    const switching = switchingId === account.id
                                    /**
                                      * 开启自动切换时，**所有**账号都不渲染「选择账号」。
                                      *
                                      * 那时账号由策略按剩余额度接管，手动指定会被下一次自动
                                      * 切换覆盖，留一个按不动的按钮只会让人以为设置没生效。
                                      * 管理面板的「设为当前」菜单项本来就是这个语义
                                      * （`!row.active && !autoSwitch`），这里对齐。
                                      */
                                    const hideForAutoSwitch = autoSwitch && !switching
                                    /**
                                      * 已选中账号不渲染「选择账号」。
                                      *
                                      * 对当前账号来说这个按钮点了是自己切自己，没有任何
                                      * 效果；而它此前在非切换状态下是**可点**的（disabled
                                      * 里的 `account.id !== activeId` 分支对当前账号恒为
                                      * false，只剩 switching），于是卡片上摆着一个点了
                                      * 没反应的按钮。
                                      *
                                      * `switching` 要一起保留（上面两处都有它）：切换在途
                                      * 时该账号尚未成为当前账号（`setAccounts` 在响应回来
                                      * 后才更新），此时仍要渲染转圈与「切换中…」，否则用户
                                      * 点了按钮它就直接消失，看不出请求是否发出去了。
                                      */
                                    const isActive = account.id === accounts.find(item => item.active)?.id
                                    const button = (
                                      <DshButton
                                        htmlType="button"
                                        size="small"
                                        type="secondary"
                                        theme="borderless"
                                        loading={switching}
                                        /**
                                         * 禁用原因只剩「切换中」与「该账号无可用余额」。
                                         *
                                         * 原先这里还含 `autoSwitch`——自动切换开启时禁用而非
                                         * 隐藏。现在该情形整体不渲染（见上），故从禁用条件里
                                         * 去掉，避免两处表达同一件事、日后改动只改一处。
                                         *
                                         * `&& !isActive` 这一项**是冗余的**，如实记下以免后人
                                         * 误以为它在起作用：当前账号已在下方直接返回 null，
                                         * 非当前账号上 `!isActive` 恒为 true，而当前账号仅
                                         * `switching` 时渲染、那时 disabled 本就为真。保留
                                         * 它是因为它让「当前账号不需要手动切换」这条规则自身
                                         * 完整，不依赖渲染层的隐藏；若日后有人改回渲染该按钮，
                                         * 禁用行为依然正确。
                                         */
                                        disabled={switching || ((balance !== undefined && !balance.usable) && !isActive)}
                                        onClick={() => { void switchAccount(account.id) }}
                                      >
                                        {switching ? t('accountSwitching') : t('selectAccount')}
                                      </DshButton>
                                    )
                                    // 自动切换接管时全隐藏；已选中的账号也隐藏（`switching`
                                    // 期间除外，见上——那两处都为此放行了 switching）。
                                    if (hideForAutoSwitch || (isActive && !switching)) return null
                                    return balance !== undefined && !balance.usable
                                      ? <DshTooltip content={t('noBalanceHint')}>{button}</DshTooltip>
                                      : button
                                  })()}
                                  <DshButton
                                    htmlType="button"
                                    size="small"
                                    type="danger"
                                    theme="borderless"
                                    onClick={() => { setRemoveTarget(account.id) }}
                                  >
                                    {t('accountRemove')}
                                  </DshButton>
                                </div>
                              </div>
                            )}
                      </DshCollapse.Panel>
                    )
                  })}
                </DshCollapse>
              </>
            )
          : <p className="dsh-codebuddy-muted">{t('accountsEmpty')}</p>}
      </div>

      {/* 添加账号弹框（与后台管理面板共享同一组件）：提交后打开浏览器 OAuth，
          页面进入下方「登录中状态卡」，复制按钮在该卡片上（链接真实有效）。 */}
      <AddAccountModal
        rpc={rpc}
        t={t}
        visible={addOpen}
        onLoginStart={onAddLoginStart}
        onFinished={onAddFinished}
        onCancel={() => { setAddOpen(false) }}
      />

      {/* 删除确认 Modal。 */}
      <DshModal
        title={t('accountRemove')}
        type="warning"
        visible={removeTarget !== undefined}
        closeOnEsc
        okText={t('accountRemove')}
        cancelText="取消"
        okButtonProps={{ type: 'danger', theme: 'solid' }}
        onCancel={() => { setRemoveTarget(undefined) }}
        onOk={() => {
          const id = removeTarget
          setRemoveTarget(undefined)
          if (id !== undefined) void removeAccount(id)
        }}
      >
        <p>{t('accountRemoveConfirm')}</p>
      </DshModal>

      {/* 修改备注名弹框：捕获阶段拦截 ESC，避免连关闭底层设置面板；输入框回车即确认。 */}
      <DshModal
        title={t('renameLabel')}
        visible={editTarget !== undefined}
        okText={t('confirm')}
        cancelText={t('cancel')}
        onCancel={() => { setEditTarget(undefined) }}
        onOk={() => {
          const id = editTarget
          const label = editNote
          setEditTarget(undefined)
          if (id !== undefined) void renameLabel(id, label)
        }}
      >
        <DshInput
          className="dsh-codebuddy-pref-control-wide"
          value={editNote}
          onChange={setEditNote}
          placeholder={t('labelPlaceholder')}
          showClear
          maxLength={30}
          onEnterPress={() => {
            const id = editTarget
            const label = editNote
            setEditTarget(undefined)
            if (id !== undefined) void renameLabel(id, label)
          }}
        />
      </DshModal>

      {/* 用量偏好：纯 UI，登录与否都可配置。
          表单保持紧凑的标签 / 控件栅格；布局由 Semi 驱动，
          各插件的行能自然对齐，无需逐行样式。 */}
      <DshForm className="dsh-codebuddy-pref-form" labelPosition="left">
        <DshForm.Slot
          label={<PreferenceLabel title={t('autoSwitch')} />}
        >
          <DshSwitch
            checked={autoSwitch}
            onChange={(checked: boolean) => { toggleAutoSwitch(checked) }}
            aria-label={t('autoSwitch')}
          />
        </DshForm.Slot>
        <DshForm.Slot
          label={<PreferenceLabel title={t('autoSwitchPct')} />}
        >
          <div className="dsh-codebuddy-pref-slider">
            <DshSlider
              value={autoSwitchPct}
              min={0}
              max={100}
              step={1}
              onChange={(value: number | [number, number]) => {
                if (typeof value === 'number') changeAutoSwitchThreshold(value)
              }}
              aria-label={t('autoSwitchPct')}
            />
            <span className="dsh-codebuddy-pref-slider-value">{autoSwitchPct}%</span>
          </div>
        </DshForm.Slot>
        <DshForm.Slot
          label={<PreferenceLabel title={t('showUsage')} description={t('showUsageDesc')} />}
        >
          <DshSwitch
            checked={showUsage}
            onChange={(checked: boolean) => { $showUsage.set(checked) }}
            aria-label={t('showUsage')}
          />
        </DshForm.Slot>
      </DshForm>
    </div>
  )
}
