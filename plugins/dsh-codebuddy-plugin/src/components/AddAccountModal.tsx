/**
 * Shared "add account" modal for the settings section and the management
 * panel. It owns the form state (备注名 + 网络环境 + 企业服务地址 + 企业开关)
 * and the start-login handshake, and reports the in-flight state + result to
 * the caller so both surfaces can show a waiting / done status and refresh
 * their roster once the login completes.
 *
 * @module dsh-codebuddy/add-account-modal
 */

import { useState } from 'react'
import {
  DshButton,
  DshCopyable,
  DshForm,
  DshIconCopy,
  DshIconExternalOpen,
  DshInput,
  DshModal,
  DshSelect,
  DshSwitch,
  DshToast,
} from '@tnnevol/dsh-semi-ui'
import { CODEBUDDY_AUTH_CHANNEL } from '../contracts/constants.ts'

import {
  CODEBUDDY_CLIENT_IDS,
  CODEBUDDY_CLIENT_LABELS,
  CODEBUDDY_CLIENT_VERSIONS,
  CODEBUDDY_DEFAULT_CLIENT,
  normalizeClientId,
  type CodeBuddyClientId,
} from '../contracts/constants.ts'
import type { CodeBuddyLocaleKey } from '../client/locales.ts'
import type { ConnectionRpc, LoginPoll, LoginStart, RpcResult } from '../client/rpc.ts'
import { describeRpcError } from '../client/rpc.ts'
import {
  CODEBUDDY_DEFAULT_ENVIRONMENT,
  CODEBUDDY_ENVIRONMENTS,
  CODEBUDDY_ENVIRONMENT_LABELS,
} from '../contracts/constants.ts'
import { PreferenceLabel } from './PreferenceLabel.tsx'

type Translate = (key: CodeBuddyLocaleKey) => string

/** How often the caller polls a started login, in ms. */
const POLL_INTERVAL_MS = 1500
/** How long the caller keeps polling before giving up, in ms. */
const POLL_DEADLINE_MS = 10 * 60 * 1000

export interface AddAccountOptions {
  /** Local display label; omitted → falls back to nickname. */
  label?: string
  /** 客户端身份：决定登录页与后续请求所用的服务地址。 */
  client?: CodeBuddyClientId
  /** Network environment id; defaults to the plugin default. */
  environment: string
  /** Explicit service root, required for cloudhosted/selfhosted. */
  endpoint: string
  /** Enterprise-account toggle (kept for parity with the settings form). */
  enterprise: boolean
}

export interface AddAccountModalProps {
  rpc: ConnectionRpc
  t: Translate
  visible: boolean
  initial?: AddAccountOptions
  /** Copy of a started login, when the caller shows the wait card below. */
  onLoginStart?: (start: { authUrl: string, state: string }) => void
  onCancel: () => void
  /** Called once a started login finishes (or errors out) so the caller can refresh. */
  onFinished?: (ok: boolean, text?: string) => void
  /** Primary-action label; defaults to the shared "Open sign-in" copy. */
  submitLabel?: string
}

export function AddAccountModal({
  rpc,
  t,
  visible,
  initial,
  onLoginStart,
  onCancel,
  onFinished,
  submitLabel,
}: AddAccountModalProps): React.ReactElement | null {
  const [note, setNote] = useState(initial?.label ?? '')
  const [client, setClient] = useState<CodeBuddyClientId>(initial?.client ?? CODEBUDDY_DEFAULT_CLIENT)
  const [environment, setEnvironment] = useState<string>(initial?.environment ?? CODEBUDDY_DEFAULT_ENVIRONMENT)
  const [endpoint, setEndpoint] = useState(initial?.endpoint ?? '')
  const [enterprise, setEnterprise] = useState(initial?.enterprise ?? false)
  const [submitting, setSubmitting] = useState(false)
  /**
   * 握手成功后停留在弹框里展示链接。`null` = 尚未发起（第一阶段）。
   *
   * 为什么不在成功后立即关闭（原行为）：复制按钮要放在 footer，而 auth 地址由
   * host 的 startLogin 握手**签发于提交之后** —— 提交前没有任何内容可复制，
   * footer 里放一个永远禁用的按钮没有意义。留在原地让「点登录 → 取链接」
   * 在一个地方完成，跨设备登录也不必再去页面上找等待卡。
   */
  const [started, setStarted] = useState<{ authUrl: string, state: string } | null>(null)

  // Reset the fields every time the modal opens so a previous edit does not
  // leak into the next add-account flow.
  const open = visible
  const [lastOpen, setLastOpen] = useState(visible)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setNote(initial?.label ?? '')
      setClient(initial?.client ?? CODEBUDDY_DEFAULT_CLIENT)
      setEnvironment(initial?.environment ?? CODEBUDDY_DEFAULT_ENVIRONMENT)
      setEndpoint(initial?.endpoint ?? '')
      setEnterprise(initial?.enterprise ?? false)
      setStarted(null)
    }
  }

  const close = (): void => { onCancel() }

  const submit = async (): Promise<void> => {
    if (submitting) return
    setSubmitting(true)
    // 只把对当前客户端有意义的字段发出去：WorkBuddy 的端点由客户端身份决定，
    // 若仍带上 environment，会被原样存进账号条目，日后误导排查。
    const cliOnly = client === 'cli'
    const options = {
      ...(note.trim().length > 0 ? { label: note.trim() } : {}),
      client,
      ...cliOnly ? { environment } : {},
      ...cliOnly && (environment === 'cloudhosted' || environment === 'selfhosted')
        ? { endpoint: endpoint.trim() }
        : {},
    }
    const result = await rpc.call<LoginStart>(CODEBUDDY_AUTH_CHANNEL, 'startLogin', options)
    setSubmitting(false)
    if (!result.ok) {
      onFinished?.(false, describeRpcError(result))
      close()
      return
    }
    // 拿到链接后**留在弹框里**：footer 的复制按钮据此启用，同时把握手交给
    // 调用方（打开浏览器、开始轮询、登录完成后刷新名单）。
    setStarted({ authUrl: result.value.authUrl, state: result.value.state })
    onLoginStart?.({ authUrl: result.value.authUrl, state: result.value.state })
  }

  const start = started

  /**
   * footer 的按钮组。两阶段：
   *
   *   提交前：                     [取消] [打开登录]
   *   提交后：  [复制登录地址]      [取消] [打开登录]
   *
   * 布局沿用 .dsh-codebuddy-add-footer 的既有约定（复制靠左、主操作靠右）——
   * 那两条样式原本就在样式表里，注释写明了这个意图，只是当时没实现复制按钮。
   *
   * 为什么提交后才出现复制：auth 地址由 host 的 startLogin 握手**签发于提交之后**，
   * 提交前没有任何内容可复制，放一个永远禁用的按钮没有意义。因此握手成功后弹框
   * **不关闭**，就地展示链接——「点登录 → 取链接」在同一处完成，跨设备登录也不必
   * 再去页面上的等待卡里找。
   */
  const footer = (
    <div className="dsh-codebuddy-add-footer">
      {start === null ? null : (
        /* 复制交给 Semi 的 Copyable：它内置 copy-text-to-clipboard（含 execCommand
           回退）与「已复制」成功态计时，无需手写 navigator.clipboard 与失败分支。
           render prop 让我们用自己的按钮承载它，且不产生额外包裹元素。 */
        <DshCopyable
          content={start.authUrl}
          onCopy={(_event: React.MouseEvent, _content: string, ok: boolean) => {
            if (ok) DshToast.success({ content: t('copyLoginLinkDone') })
            else DshToast.warning({ content: t('copyLoginLinkDoneFail') })
          }}
          render={(copied: boolean, doCopy: (event: React.MouseEvent) => void) => (
            <DshButton
              type="tertiary"
              icon={copied ? undefined : <DshIconCopy />}
              onClick={doCopy}
            >
              {copied ? t('copyLoginLinkCopied') : t('copyLoginLink')}
            </DshButton>
          )}
        />
      )}
      <div className="dsh-codebuddy-add-footer-main">
        <DshButton type="tertiary" onClick={close}>{t('cancel')}</DshButton>
        {start === null ? (
          <DshButton type="primary" theme="solid" loading={submitting} onClick={() => { void submit() }}>
            {submitLabel ?? t('createUserGo')}
          </DshButton>
        ) : (
          <DshButton
            type="primary"
            theme="solid"
            icon={<DshIconExternalOpen />}
            onClick={() => { window.open(start.authUrl, '_blank', 'noopener') }}
          >
            {t('createUserGo')}
          </DshButton>
        )}
      </div>
    </div>
  )

  return (
    <DshModal
      title={t('createUserTitle')}
      visible={visible}
      closeOnEsc
      maskClosable={false}
      onCancel={close}
      /* 自定义 footer：Semi 的 `footer` prop 会**完全取代**默认按钮
         （ModalContent 里是 `props.footer ? … : null`），因此取消/确定都由 footer
         自己渲染。这样才能把「复制 auth 地址」与确定按钮并排放在一起。 */
      footer={footer}
    >
      <div className="dsh-codebuddy-add-form">
        <DshForm className="dsh-codebuddy-pref-form" labelPosition="top">
          <DshForm.Slot label={<PreferenceLabel title={t('noteLabel')} />}>
            <DshInput
              className="dsh-codebuddy-pref-control-wide"
              value={note}
              onChange={setNote}
              placeholder={t('accountExpand')}
              showClear
              maxLength={30}
            />
          </DshForm.Slot>
          {/* 客户端选择放在环境之前：它决定登录页与请求所用的服务地址
              （WorkBuddy 走 workbuddy.cn），环境只在 CLI 客户端下生效。 */}
          <DshForm.Slot
            label={<PreferenceLabel title={t('clientLabel')} description={t('clientDesc')} />}
          >
            <DshSelect
              className="dsh-codebuddy-env-select"
              value={client}
              onChange={(value: string | number | string[]) => { setClient(normalizeClientId(value)) }}
              aria-label={t('clientLabel')}
              optionList={CODEBUDDY_CLIENT_IDS.map(id => ({
                value: id,
                label: `${CODEBUDDY_CLIENT_LABELS[id]} · v${CODEBUDDY_CLIENT_VERSIONS[id]}`,
              }))}
            />
          </DshForm.Slot>
          {/* 环境只对 CLI 客户端有效：WorkBuddy 固定访问自己的服务地址，与环境
              无关。此时隐藏该选择器——留一个改了也没有作用的控件会误导用户。 */}
          {client === 'cli' ? (
            <DshForm.Slot
              label={<PreferenceLabel title={t('environmentLabel')} description={t('environmentDesc')} />}
            >
              <DshSelect
                className="dsh-codebuddy-env-select"
                value={environment}
                onChange={(value: string | number | string[]) => { setEnvironment(String(value)) }}
                aria-label={t('environmentLabel')}
                optionList={CODEBUDDY_ENVIRONMENTS.map(env => ({ value: env, label: CODEBUDDY_ENVIRONMENT_LABELS[env] }))}
              />
            </DshForm.Slot>
          ) : null}
          {client === 'cli' && (environment === 'cloudhosted' || environment === 'selfhosted') ? (
            <DshForm.Slot
              label={<PreferenceLabel title={t('endpointLabel')} description={t('endpointDesc')} />}
            >
              <DshInput
                className="dsh-codebuddy-pref-control-wide"
                value={endpoint}
                onChange={setEndpoint}
                placeholder="https://your-company.copilot.qq.com"
              />
            </DshForm.Slot>
          ) : null}
          <DshForm.Slot
            label={<PreferenceLabel title={t('enterpriseSwitch')} description={t('enterpriseSwitchDesc')} />}
          >
            <DshSwitch
              checked={enterprise}
              onChange={(checked: boolean) => { setEnterprise(checked) }}
              aria-label={t('enterpriseSwitch')}
            />
          </DshForm.Slot>
        </DshForm>
      </div>
    </DshModal>
  )
}

/** Poll a started login to completion; useful for the waiting card surfaces. */
export function startLoginPolling(
  rpc: ConnectionRpc,
  state: string,
  onDone: () => void,
  onTimeout: () => void,
  onFailed?: (reason: string) => void,
): () => void {
  const startedAt = Date.now()
  let stopped = false
  const tick = async (): Promise<void> => {
    if (stopped) return
    const result: RpcResult<LoginPoll> = await rpc.call<LoginPoll>(CODEBUDDY_AUTH_CHANNEL, 'pollLogin', { state })
    if (stopped) return
    if (result.ok && result.value.done) {
      onDone()
      return
    }
    // 宿主已判定失败：立即停止轮询并上报原因，不必等到超时——继续等待不会有结果。
    if (result.ok && result.value.error !== undefined && result.value.error.length > 0) {
      if (onFailed === undefined) onTimeout()
      else onFailed(result.value.error)
      return
    }
    if (Date.now() - startedAt >= POLL_DEADLINE_MS) {
      onTimeout()
      return
    }
    window.setTimeout(tick, POLL_INTERVAL_MS)
  }
  void tick()
  return () => { stopped = true }
}

export { POLL_DEADLINE_MS, POLL_INTERVAL_MS }
