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
  DshForm,
  DshInput,
  DshModal,
  DshSelect,
  DshSwitch,
} from '@tnnevol/dsh-semi-ui'
import { CODEBUDDY_AUTH_CHANNEL } from '../client/constants.ts'
import {
  CODEBUDDY_CLIENT_IDS,
  CODEBUDDY_CLIENT_LABELS,
  CODEBUDDY_CLIENT_VERSIONS,
  CODEBUDDY_DEFAULT_CLIENT,
  normalizeClientId,
  type CodeBuddyClientId,
} from '../constants.ts'
import type { CodeBuddyLocaleKey } from '../client/locales.ts'
import type { ConnectionRpc, LoginPoll, LoginStart, RpcResult } from '../client/rpc.ts'
import { describeRpcError } from '../client/rpc.ts'
import {
  CODEBUDDY_DEFAULT_ENVIRONMENT,
  CODEBUDDY_ENVIRONMENTS,
  CODEBUDDY_ENVIRONMENT_LABELS,
} from '../constants.ts'
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
    // Browser tab opens for the new handshake; the owner surface decides how
    // to present the in-flight state (waiting card / polling) and refreshes
    // its roster once login completes.
    onLoginStart?.({ authUrl: result.value.authUrl, state: result.value.state })
    close()
  }

  return (
    <DshModal
      title={t('createUserTitle')}
      visible={visible}
      closeOnEsc
      maskClosable={false}
      okText={submitLabel ?? t('createUserGo')}
      cancelText={t('cancel')}
      confirmLoading={submitting}
      onCancel={close}
      onOk={() => { void submit() }}
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
