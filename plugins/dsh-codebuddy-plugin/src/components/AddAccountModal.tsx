/**
 * 设置区块与管理面板共享的「添加账号」弹框。它持有表单状态
 * （备注名 + 客户端 + 网络环境 + 企业服务地址 + 企业开关）、发起 start-login
 * 握手，并**自己盯到登录落定**。
 *
 * 反馈闭环：主按钮从点击起持续 loading（握手在途 → 等待浏览器授权），落定后用
 * 通知提示结果，成功时主动关闭自己；失败/超时保留表单以便直接重试。轮询归它
 * 所有，因为只有它知道「这次登录是从我发起的」，也只有它能决定关闭自己；宿主
 * 通过 `onLoginStart`/`onFinished` 开窗与刷新名册。
 *
 * @module dsh-codebuddy/add-account-modal
 */

import type { AddAccountModalProps } from '../types/components/AddAccountModal'
export type { AddAccountOptions, AddAccountModalProps } from '../types/components/AddAccountModal'
import { useEffect, useRef, useState } from 'react'
import {
  DshButton,
  DshForm,
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

import type { LoginStart } from '../client/rpc.ts'
import { describeRpcError } from '../client/rpc.ts'
import { startLoginPolling } from '../client/login-polling.ts'
export { POLL_DEADLINE_MS, POLL_INTERVAL_MS, startLoginPolling } from '../client/login-polling.ts'
import {
  CODEBUDDY_DEFAULT_ENVIRONMENT,
  CODEBUDDY_ENVIRONMENTS,
  CODEBUDDY_ENVIRONMENT_LABELS,
} from '../contracts/constants.ts'
import { PreferenceLabel } from './PreferenceLabel.tsx'

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
  /** 握手请求本身在途（点按钮 → startLogin 返回）。 */
  const [handshaking, setHandshaking] = useState(false)
  /**
   * 已发起并仍在等待用户授权的握手 state。`undefined` = 没有在途登录。
   *
   * 主按钮据此**持续** loading 直到登录彻底落定（成功/失败/超时），而不是握手
   * 一返回就停——握手成功只代表「链接已签发」，用户还没在浏览器里授权完。
   */
  const [pendingState, setPendingState] = useState<string | undefined>(undefined)
  const waiting = handshaking || pendingState !== undefined

  /**
   * 登录落定时是否要主动关闭弹框。
   *
   * 用 ref 而非 state：它只在 effect 的回调里读取，不参与渲染；若做成 state
   * 会让轮询 effect 多一个依赖、进而在登录途中重启轮询。
   */
  const closeOnDone = useRef(false)
  /**
   * 始终指向最新的关闭回调。
   *
   * 轮询 effect 只在回调里「调用」它，不因它变化而需要重建轮询；把它收进 ref
   * 让 effect 的依赖表如实只列出真正的数据依赖（state/rpc/t），既不撕掉进行中
   * 的轮询，也不需要抑制依赖检查。
   */
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel
  const onFinishedRef = useRef(onFinished)
  onFinishedRef.current = onFinished

  // 弹框每次打开都重置字段，避免上一次的编辑泄漏到下一次添加账号流程。
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
      // 不清 pendingState：登录可能仍在途（用户关掉弹框又重开），
      // 清掉会让轮询失去 state、按钮 loading 也会错误地停下。
    }
  }

  const close = (): void => { onCancel() }

  const submit = async (): Promise<void> => {
    if (waiting) return
    setHandshaking(true)
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
    setHandshaking(false)
    if (!result.ok) {
      // 握手就失败：没有可等待的登录，直接提示并关框（表单内容已无意义）。
      DshToast.error({ content: `${t('loginFailed')} ${describeRpcError(result)}` })
      onFinished?.(false, describeRpcError(result))
      close()
      return
    }
    /**
     * 进入「等待授权」阶段：按钮继续 loading，并由本组件的轮询 effect 盯到落定。
     *
     * 关框时机是登录**成功之后**（见轮询 effect），不是现在——用户此刻还没授权，
     * 提前关框会让他失去「正在登录」的唯一反馈。
     */
    closeOnDone.current = true
    setPendingState(result.value.state)
    onLoginStart?.({ authUrl: result.value.authUrl, state: result.value.state })
  }

  /**
   * 盯住本弹框发起的登录，直到成功/失败/超时，然后用通知告知结果。
   *
   * 为什么轮询放在弹框里而不是只靠父组件：只有弹框知道「这次登录是从我这里
   * 发起的」，因而只有它能在落定时决定要不要关闭自己。父组件的轮询仍然保留，
   * 服务它自己发起的流程（例如设置页掉线账号的「重新登录」）。
   */
  useEffect(() => {
    const state = pendingState
    if (state === undefined) return
    /**
     * 收尾：清掉在途标记，并把结果回报宿主（刷新名册 / 清「登录中」）。
     *
     * `onFinished` 必须在**每个**结局上调用，不能只在成功时——宿主用它把
     * 「登录中」标记落回 false，漏掉任一分支都会让添加按钮永久停在禁用态。
     */
    const settle = (ok: boolean, text?: string): void => {
      setPendingState(undefined)
      onFinishedRef.current?.(ok, text)
    }
    const shouldClose = (): boolean => {
      const yes = closeOnDone.current
      closeOnDone.current = false
      return yes
    }
    return startLoginPolling(
      rpc,
      state,
      () => {
        settle(true)
        DshToast.success({ content: t('loginSucceeded') })
        // 成功才主动关框：账号已入册，表单没有留存价值。
        if (shouldClose()) onCancelRef.current()
      },
      () => {
        // 超时/失败**不关框**：字段原样保留，用户可直接再点一次重试，
        // 不必重新填一遍备注、客户端与环境。
        settle(false, t('timeout'))
        shouldClose()
        DshToast.warning({ content: t('timeout') })
      },
      (reason: string) => {
        settle(false, reason)
        shouldClose()
        DshToast.error({ content: `${t('loginFailed')} ${reason}` })
      },
    )
  }, [pendingState, rpc, t])

  /**
   * footer 的按钮组：[取消] [打开登录]。
   *
   * 主按钮在**整个登录期间**保持 loading（`waiting` = 握手在途 或 等待授权），
   * 直到轮询判定成功/失败/超时。Semi 的 loading 不会自动禁用按钮，因此另外
   * 显式 disabled，避免重复点击起第二个握手（每个握手都会在 host 侧挂一条
   * 等待中的登录）。
   *
   * 这里曾有一个「复制登录地址」按钮，现已去除：auth 链接由 host 向官方接口
   * 握手后签发（含服务端一次性 state），客户端无法在提交前算出它，做不到
   * 「一直可用且随客户端/环境变化」；跨设备授权改由浏览器自身的分享能力承担。
   */
  const footer = (
    <div className="dsh-codebuddy-add-footer">
      <div className="dsh-codebuddy-add-footer-main">
        <DshButton type="tertiary" onClick={close}>{t('cancel')}</DshButton>
        <DshButton
          type="primary"
          theme="solid"
          loading={waiting}
          disabled={waiting}
          onClick={() => { void submit() }}
        >
          {pendingState === undefined ? submitLabel ?? t('createUserGo') : t('signingIn')}
        </DshButton>
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
         自己渲染——这里需要主按钮在登录期间持续 loading，默认按钮做不到。 */
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
