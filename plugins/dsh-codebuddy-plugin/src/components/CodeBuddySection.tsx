/**
 * CodeBuddy settings section: in-app OAuth login plus the UI-only usage
 * preferences.
 *
 * Rendered inside the `settings.section` list slot (same original surface),
 * while the live usage readout now lives in the conversation composer.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  DshButton,
  DshCollapse,
  DshDescriptions,
  DshIconButton,
  DshForm,
  DshIconAlertCircle,
  DshIconCopy,
  DshIconEdit,
  DshIconList,
  DshInput,
  DshModal,
  DshSlider,
  DshSwitch,
  DshTag,
  DshToast,
  DshTypography,
} from '@tnnevol/dsh-semi-ui'
import { CODEBUDDY_AUTH_CHANNEL } from '../client/constants.ts'
import type { PanelRouteController } from '../client/panel-route.ts'

import type { CodeBuddyLocaleKey } from '../client/locales.ts'
import type { AccountView, AccountsResult, AuthStatus, ConnectionRpc, RpcErr } from '../client/rpc.ts'
import { describeRpcError } from '../client/rpc.ts'
import { AddAccountModal, startLoginPolling } from './AddAccountModal.tsx'
import { CodeBuddyLogo } from './CodeBuddyLogo.tsx'
import { PreferenceLabel } from './PreferenceLabel.tsx'
import {
  getAutoCheckinPref,
  getAutoSwitchPref,
  getAutoSwitchThresholdPref,
  getAutoTravelPref,
  getUsagePref,
  setAutoCheckinPref,
  setAutoSwitchPref,
  setAutoSwitchThresholdPref,
  setAutoTravelPref,
  setUsagePref,
  subscribeUsagePref,
} from '../client/usage-prefs.ts'

type Translate = (key: CodeBuddyLocaleKey) => string

/** UI phase the page cycles through. */
type Phase = 'loading' | 'idle' | 'error'

/** Decode CodeBuddy's base64-encoded UTF-8 `departmentFullName`. */
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

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="dsh-codebuddy-row">
      <span className="dsh-codebuddy-row-label">{label}</span>
      <span className="dsh-codebuddy-row-value">{value}</span>
    </div>
  )
}

export interface CodeBuddySectionProps {
  rpc: ConnectionRpc
  t: Translate
  /** 管理面板路由；由 client 注入，点击头部按钮打开全页面。 */
  panelRoute?: PanelRouteController
  /** Settings shell close callback; open the overlay without leaving the dialog behind. */
  close?: () => void
}

export function CodeBuddySection({ rpc, t, panelRoute, close }: CodeBuddySectionProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [status, setStatus] = useState<AuthStatus | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [loginState, setLoginState] = useState<string | undefined>(undefined)
  // Multi-account roster from the host `accounts` endpoint.
  const [accounts, setAccounts] = useState<AccountView[]>([])
  const [switchingId, setSwitchingId] = useState<string | undefined>(undefined)
  // 添加账号弹框（共享组件：备注名 + 环境 + 自定义 endpoint + 企业账号开关）。
  const [addOpen, setAddOpen] = useState(false)
  // 删除确认目标账号 id。
  const [removeTarget, setRemoveTarget] = useState<string | undefined>(undefined)
  // 登录中握手返回的真实 authUrl——复制按钮与「打开登录页」共用同一链接。
  const [loginLink, setLoginLink] = useState<string | undefined>(undefined)
  const [showUsage, setShowUsage] = useState<boolean>(getUsagePref())
  const [autoSwitch, setAutoSwitchState] = useState<boolean>(getAutoSwitchPref())
  const [autoSwitchPct, setAutoSwitchPctState] = useState<number>(getAutoSwitchThresholdPref())
  const [autoCheckin, setAutoCheckinState] = useState<boolean>(getAutoCheckinPref())
  const [autoTravel, setAutoTravelState] = useState<boolean>(getAutoTravelPref())
  const [editTarget, setEditTarget] = useState<string | undefined>(undefined)
  const [editNote, setEditNote] = useState('')
  // 各账号剩余额度快照（设置页用户信息面板展示；来源 panelStatus）。
  const [balanceByAccount, setBalanceByAccount] = useState<Record<string, { remaining: number, capacity: number, usable: boolean }>>({})

  useEffect(() => subscribeUsagePref(() => {
    setShowUsage(getUsagePref())
    const nextAuto = getAutoSwitchPref()
    setAutoSwitchState(nextAuto)
    void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoSwitch', { enabled: nextAuto })
    const nextCheckin = getAutoCheckinPref()
    setAutoCheckinState(nextCheckin)
    void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoCheckin', { enabled: nextCheckin })
    const nextTravel = getAutoTravelPref()
    setAutoTravelState(nextTravel)
    void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoTravel', { enabled: nextTravel })
  }), [])

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

  // Load status once on mount; sync the persisted auto-switch flag to the host.
  useEffect(() => {
    void refresh()
    void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoSwitch', {
      enabled: getAutoSwitchPref(),
      thresholdPct: getAutoSwitchThresholdPref(),
    })
  }, [refresh, rpc])

  // Poll an in-flight login until it completes or the deadline passes.
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
    )
  }, [loginState, rpc, refresh, t])

  // 接收共享添加账号弹框发起的登录：打开浏览器，展示等待卡片并轮询完成。
  const onAddLoginStart = useCallback((start: { authUrl: string, state: string }) => {
    window.open(start.authUrl, '_blank', 'noopener')
    setLoginLink(start.authUrl)
    setLoginState(start.state)
  }, [])

  // 复制登录链接：写入当前握手返回的真实 authUrl（与「打开登录页」打开的
  // 链接完全一致，同一 state），供其他设备打开完成同一份授权。
  const cbCopyLoginLink = (link: string): void => {
    void navigator.clipboard?.writeText(link)
      .then(() => { DshToast.success({ content: t('copyLoginLinkDone') }) })
      .catch(() => { DshToast.warning({ content: t('copyLoginLinkDoneFail') }) })
  }

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
    setLoginLink(result.value.authUrl)
    setLoginState(result.value.state)
  }, [rpc])

  const toggleAutoSwitch = useCallback((enabled: boolean) => {
    setAutoSwitchState(enabled)
    setAutoSwitchPref(enabled)
    void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoSwitch', { enabled, thresholdPct: autoSwitchPct })
  }, [rpc, autoSwitchPct])

  const toggleAutoCheckin = useCallback((enabled: boolean) => {
    setAutoCheckinState(enabled)
    setAutoCheckinPref(enabled)
    void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoCheckin', { enabled })
  }, [rpc])

  const toggleAutoTravel = useCallback((enabled: boolean) => {
    setAutoTravelState(enabled)
    setAutoTravelPref(enabled)
    void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoTravel', { enabled })
  }, [rpc])

  const changeAutoSwitchThreshold = useCallback((pct: number) => {
    setAutoSwitchPctState(pct)
    setAutoSwitchThresholdPref(pct)
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

  return (
    <div className="dsh-codebuddy-section">
      <div className="dsh-codebuddy-title-row">
        <CodeBuddyLogo size={18} />
        <h2 className="dsh-codebuddy-title">CodeBuddy</h2>
      </div>
      {!signedIn ? <p className="dsh-codebuddy-desc">{t('intro')}</p> : null}
      {error !== undefined ? <p className="dsh-codebuddy-error">{error}</p> : null}

      {/* Multi-account roster: one collapsible panel per signed-in account.
          The header shows who it is, whether it is active, and whether it has
          gone offline (expired refresh token); the expanded body carries the
          account facts, the switch action, and removal. */}
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
              disabled={loginState !== undefined}
              onClick={() => { setAddOpen(true) }}
            >
              {loginState !== undefined ? t('signingIn') : t('createUser')}
            </DshButton>
          </span>
        </div>
        <p className="dsh-codebuddy-accounts-desc">{loginState !== undefined ? t('waiting') : t('accountsDesc')}</p>
        {loginState !== undefined && loginLink !== undefined ? (
          <div className="dsh-codebuddy-login-waiting">
            <span className="dsh-codebuddy-muted">{t('loginWaitingCopy')}</span>
            <DshButton
              htmlType="button"
              size="small"
              theme="light"
              type="tertiary"
              icon={<DshIconCopy />}
              onClick={() => { cbCopyLoginLink(loginLink) }}
            >
              {t('copyLoginLink')}
            </DshButton>
          </div>
        ) : null}
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
                            <span className="dsh-codebuddy-account-name" title={displayName}>{displayName}</span>
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
                                  <DshButton
                                    htmlType="button"
                                    size="small"
                                    type="secondary"
                                    theme="borderless"
                                    disabled={(autoSwitch || (balance !== undefined && !balance.usable)) && account.id !== accounts.find(item => item.active)?.id}
                                    title={balance !== undefined && !balance.usable ? t('noBalanceHint') : ''}
                                    onClick={() => { void switchAccount(account.id) }}
                                  >
                                    {t('selectAccount')}
                                  </DshButton>
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

      {/* Usage preferences: UI-only, configurable whether or not signed in.
          The form keeps a tight label / control grid; Semi drives the layout
          so the rows line up across plugins without per-row styles. */}
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
          label={<PreferenceLabel title={t('autoCheckin')} description={t('autoCheckinDesc')} />}
        >
          <DshSwitch
            checked={autoCheckin}
            onChange={(checked: boolean) => { toggleAutoCheckin(checked) }}
            aria-label={t('autoCheckin')}
          />
        </DshForm.Slot>
        <DshForm.Slot
          label={<PreferenceLabel title={t('travelAuto')} description={t('travelAutoDesc')} />}
        >
          <DshSwitch
            checked={autoTravel}
            onChange={(checked: boolean) => { toggleAutoTravel(checked) }}
            aria-label={t('travelAuto')}
          />
        </DshForm.Slot>
        <DshForm.Slot
          label={<PreferenceLabel title={t('showUsage')} description={t('showUsageDesc')} />}
        >
          <DshSwitch
            checked={showUsage}
            onChange={(checked: boolean) => { setShowUsage(checked); setUsagePref(checked) }}
            aria-label={t('showUsage')}
          />
        </DshForm.Slot>
      </DshForm>
    </div>
  )
}
