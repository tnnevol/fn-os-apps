/** Account and model settings for the Codex Auth plugin. */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import { DshButton, DshIconCheckCircle, DshTypography } from '@tnnevol/dsh-semi-ui'
import type { CodexAuthLocaleKey } from '../client/locales.ts'
import { CodexGlobalModel } from './CodexGlobalModel.tsx'
import {
  CODEX_AUTH_CANCEL_PATH,
  CODEX_AUTH_LOGIN_PATH,
  CODEX_AUTH_LOGOUT_PATH,
  CODEX_AUTH_STATUS_PATH,
  CODEX_MODEL_REFRESH_PATH,
} from '../contracts/auth-paths.ts'

type Translate = (key: CodexAuthLocaleKey) => string

const CODEX_MODEL_REFRESH_FAILED_CODE = 'codex-model-refresh-failed'

type AccountStatus =
  (
    | { status: 'loading' }
    | { status: 'signed-out' }
    | { status: 'signing-in' }
    | { status: 'signed-in'; expiresAt?: string }
    | { status: 'error'; message: string }
    | { status: 'remote-web-origin-not-trusted' }
  )

interface LoginChallenge {
  type: 'device_code'
  userCode: string
  verificationUri: string
  intervalSeconds?: number
  expiresInSeconds?: number
}

interface RefreshedCodexModel {
  id: string
  name: string
  reasoningEfforts: Record<string, string> | false
}

interface ModelRefreshResponse {
  ok: true
  models: RefreshedCodexModel[]
  skipped: string[]
}

type ModelRefreshState =
  | { status: 'idle' }
  | { status: 'busy' }
  | { status: 'done'; count: number }
  | { status: 'error'; message: string }

export interface CodexAuthSectionInjected {
  t: Translate
  connection: ConnectionHandle
  remote: unknown
}

export type CodexAuthSectionProps = CodexAuthSectionInjected

class AccountRequestError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'AccountRequestError'
  }
}

async function jsonRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers: HeadersInit = { accept: 'application/json' }
  if (body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    credentials: 'same-origin',
  })
  const value: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const code = typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
      ? value.error
      : `HTTP ${response.status}`
    throw new AccountRequestError(code, code)
  }
  return value as T
}

function dotClass(status: AccountStatus['status']): string {
  return `dsh-codex-auth-status-dot dsh-codex-auth-status-dot--${status}`
}

/** Render a standalone login/logout page for the Settings section slot. */
export function CodexAuthSection({ t, connection, remote }: CodexAuthSectionProps) {
  if (t === undefined) throw new Error('Codex auth section requires its translation function')
  if (connection === undefined) throw new Error('Codex auth section requires the DSH connection')
  const [status, setStatus] = useState<AccountStatus>({ status: 'loading' })
  const [busy, setBusy] = useState(false)
  const [challenge, setChallenge] = useState<LoginChallenge | undefined>()
  const [copyFailed, setCopyFailed] = useState(false)
  const [notice, setNotice] = useState<CodexAuthLocaleKey | undefined>()
  const [modelRefresh, setModelRefresh] = useState<ModelRefreshState>({ status: 'idle' })
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0)
  /**
   * 本次登录打开过的授权窗口。
   *
   * 用集合而不是单个引用：`signIn()` 会自动开一个，用户还可能再点「打开授权页面」
   * 开第二个。只留最后一个引用会让先前那个变成孤儿——取消时关不掉，留下一个
   * 无人认领的登录页。
   *
   * 跨域窗口只允许读 `closed`，所以轮询是唯一的检测手段。
   */
  const authWindowsRef = useRef<Set<Window>>(new Set())
  /**
   * 登录尝试的代计数。
   *
   * 用户在 `POST /auth/login` 还在途时就点了取消，请求稍后返回会继续走
   * `setChallenge` + 跳转弹窗的后半段，把刚取消的界面又推回授权中。取消时
   * 推进代号，`signIn()` 在 await 之后比对，不一致即整体丢弃。
   */
  const loginGenerationRef = useRef(0)

  const refreshModels = useCallback(async (): Promise<void> => {
    if (status.status !== 'signed-in' || modelRefresh.status === 'busy') return
    setModelRefresh({ status: 'busy' })
    try {
      const response = await jsonRequest<ModelRefreshResponse>(CODEX_MODEL_REFRESH_PATH, 'POST')
      setModelRefresh({ status: 'done', count: response.models.length })
      setCatalogRefreshKey(current => current + 1)
    } catch (error: unknown) {
      setModelRefresh({
        status: 'error',
        message: error instanceof AccountRequestError
          ? error.code === CODEX_MODEL_REFRESH_FAILED_CODE
            ? t('modelRefreshFailed')
            : error.message
          : error instanceof Error ? error.message : t('modelRefreshFailed'),
      })
    }
  }, [status.status, modelRefresh.status, t])

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const next = await jsonRequest<AccountStatus>(CODEX_AUTH_STATUS_PATH)
      setStatus(next)
      if (next.status !== 'signing-in') {
        setChallenge(undefined)
        setCopyFailed(false)
      }
    } catch (error: unknown) {
      setStatus(error instanceof AccountRequestError && error.code === 'remote-web-origin-not-trusted'
        ? { status: 'remote-web-origin-not-trusted' }
        : { status: 'error', message: error instanceof Error ? error.message : t('requestFailed') })
    }
  }, [t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (status.status !== 'signing-in') return
    const timer = window.setInterval(() => { void refresh() }, 1_000)
    return () => { window.clearInterval(timer) }
  }, [refresh, status.status])

  /**
   * 用户放弃本次授权时回收等待状态。
   *
   * 只中止这一次登录，不动已保存的凭据——所以走 cancel 端点而不是 logout。
   * `signOut()` 会连带清掉账号，用它来响应「关掉授权窗口」会把用户已登录的
   * 账号一起删掉。
   *
   * @param notice 关窗场景要展示的提示；用户主动点「取消」时不传，因为那是
   *   他自己的操作，不需要再解释一遍。
   */
  const cancelSignIn = useCallback(async (notice?: CodexAuthLocaleKey): Promise<void> => {
    // 推进代号，作废可能仍在途的 login 请求。
    loginGenerationRef.current += 1
    // 用户点「取消」时授权窗口通常还开着，把本次登录开过的窗口**全部**关掉，
    // 别留下无人认领的登录页。已关闭的跳过（对它调 close 无意义）。
    const authWindows = [...authWindowsRef.current]
    authWindowsRef.current = new Set()
    for (const authWindow of authWindows) {
      if (!authWindow.closed) authWindow.close()
    }
    if (notice !== undefined) setNotice(notice)
    try {
      await jsonRequest<{ ok: true }>(CODEX_AUTH_CANCEL_PATH, 'POST')
    } catch {
      // 取消失败不阻塞界面：轮询会把状态收敛到宿主的真实结果。
    }
    setChallenge(undefined)
    setCopyFailed(false)
    // 取消可能发生在 login 请求在途时，那次 `signIn()` 会因为代号不符而跳过
    // 自己的 `setBusy(false)`，这里兜住，避免登录按钮一直停在禁用态。
    setBusy(false)
    await refresh()
  }, [refresh])

  /**
   * 授权窗口被关掉即视为放弃。
   *
   * 只有轮询 `closed` 这一条路：窗口跳到 OpenAI 域之后就跨域了，读不到任何
   * 内部状态，但 `closed` 始终可读。判定只在 `signing-in` 期间生效，避免把
   * 用户之后自己开的无关窗口算进来。
   */
  useEffect(() => {
    if (status.status !== 'signing-in') return
    const timer = window.setInterval(() => {
      // 全部授权窗口都关掉才算放弃。用户可能通过「打开授权页面」开了第二个窗口，
      // 关掉其中一个（例如重复的那个）时另一个仍可用于授权，不该取消。
      const authWindows = [...authWindowsRef.current]
      if (authWindows.length === 0) return
      if (!authWindows.every(authWindow => authWindow.closed)) return
      void cancelSignIn('authorizationWindowClosed')
    }, 500)
    return () => { window.clearInterval(timer) }
  }, [cancelSignIn, status.status])

  const signIn = async (): Promise<void> => {
    const generation = loginGenerationRef.current + 1
    loginGenerationRef.current = generation
    const popup = window.open('about:blank', '_blank')
    if (popup === null) {
      setStatus({ status: 'error', message: t('popupBlocked') })
      return
    }
    // 刻意不置 `popup.opener = null`：授权窗口离开本页后是跨域的，此时若 opener
    // 已被切断，窗口就不再是 script-closable，`close()` 会静默失效（实测：跨域后
    // 调 close 返回 undefined 且 `closed` 仍为 false），「取消时一并关掉窗口」也就
    // 无从实现。授权地址由宿主校验过（必须 https、不带内嵌凭据），保留 opener 是
    // OAuth 弹窗的常规做法。
    authWindowsRef.current.add(popup)
    setBusy(true)
    setStatus({ status: 'signing-in' })
    setChallenge(undefined)
    setCopyFailed(false)
    setNotice(undefined)
    try {
      const next = await jsonRequest<LoginChallenge>(CODEX_AUTH_LOGIN_PATH, 'POST')
      // 请求期间用户已取消：丢弃这次结果，也不再跳转那个已关闭的窗口。
      if (loginGenerationRef.current !== generation) {
        popup.close()
        return
      }
      setChallenge(next)
      popup.location.replace(next.verificationUri)
    } catch (error: unknown) {
      popup.close()
      authWindowsRef.current.delete(popup)
      if (loginGenerationRef.current !== generation) return
      setChallenge(undefined)
      setCopyFailed(false)
      setStatus(error instanceof AccountRequestError && error.code === 'remote-web-origin-not-trusted'
        ? { status: 'remote-web-origin-not-trusted' }
        : { status: 'error', message: error instanceof Error ? error.message : t('requestFailed') })
    } finally {
      if (loginGenerationRef.current === generation) setBusy(false)
    }
  }

  const signOut = async (): Promise<void> => {
    setBusy(true)
    try {
      await jsonRequest<{ ok: true }>(CODEX_AUTH_LOGOUT_PATH, 'POST')
      setStatus({ status: 'signed-out' })
      setChallenge(undefined)
      setCopyFailed(false)
      setNotice(undefined)
      authWindowsRef.current = new Set()
    } catch (error: unknown) {
      setStatus({ status: 'error', message: error instanceof Error ? error.message : t('requestFailed') })
    } finally {
      setBusy(false)
    }
  }

  const label = status.status === 'signed-in'
    ? t('signedIn')
    : status.status === 'loading'
      ? t('loading')
      : status.status === 'signing-in'
        ? t('signingIn')
        : status.status === 'remote-web-origin-not-trusted'
          ? t('remoteOrigin')
          : status.status === 'error'
            ? t('requestFailed')
            : t('signedOut')

  return (
    <div className="dsh-codex-auth-section">
      <h2 className="dsh-codex-auth-section-title">{t('title')}</h2>
      <p className="dsh-codex-body dsh-codex-auth-section-desc">{t('intro')}</p>
      <div className="dsh-codex-auth-row">
        <div className="dsh-codex-auth-status" role="status">
          <span aria-hidden="true" className={dotClass(status.status)} />
          <span>{label}</span>
        </div>
        {status.status === 'loading' || status.status === 'remote-web-origin-not-trusted'
          ? null
          : status.status === 'signed-in'
            ? <DshButton htmlType="button" theme="solid" type="primary" disabled={busy} loading={busy} onClick={() => { void signOut() }}>{busy ? t('working') : t('signOut')}</DshButton>
            : status.status === 'signing-in'
              ? <DshButton htmlType="button" theme="solid" type="primary" onClick={() => { void cancelSignIn() }}>{t('cancelSignIn')}</DshButton>
              : <DshButton htmlType="button" theme="solid" type="primary" disabled={busy} loading={busy} onClick={() => { void signIn() }}>{busy ? t('working') : t('signIn')}</DshButton>}
      </div>
      {status.status === 'error' ? <p className="dsh-codex-auth-error">{status.message}</p> : null}
      {status.status === 'remote-web-origin-not-trusted' ? <p className="dsh-codex-auth-error">{t('remoteOrigin')}</p> : null}
      {notice !== undefined && status.status !== 'error' ? <p className="dsh-codex-auth-notice">{t(notice)}</p> : null}
      {status.status === 'signing-in' && challenge !== undefined ? (
        <div className="dsh-codex-auth-signing-in">
          <p className="dsh-codex-auth-body">{t('authorizationCodeHelp')}</p>
          <div className="dsh-codex-auth-signing-in-actions">
            <DshTypography.Text
              className="dsh-codex-auth-code"
              aria-label={t('authorizationCodeLabel')}
              copyable={{
                content: challenge.userCode,
                copyTip: t('copyAuthorizationCode'),
                // 成功态用等宽的勾选图标而不是「已复制」文案：两者都是 16px，
                // 切换时授权码框宽度不变，不会把右侧「打开授权页」按钮推走。
                successTip: <DshIconCheckCircle aria-label={t('authorizationCodeCopied')} />,
                onCopy: (_event: unknown, _content: unknown, result: boolean) => { setCopyFailed(!result) },
              }}
            >
              {challenge.userCode}
            </DshTypography.Text>
            <DshButton
              htmlType="button"
              theme="outline"
              type="secondary"
              size="small"
              onClick={() => {
                // 不能带 `noopener`（那会让 window.open 返回 null，拿不到窗口引用，
                // 也就无法检测用户关掉它、更无法在取消时关掉它），也不能在开窗后置
                // `opener = null`——原因同 `signIn()`：跨域窗口会因此无法被脚本关闭。
                const opened = window.open(challenge.verificationUri, '_blank')
                if (opened === null) return
                authWindowsRef.current.add(opened)
              }}
            >
              {t('openAuthorization')}
            </DshButton>
          </div>
          {copyFailed ? <p className="dsh-codex-auth-error">{t('authorizationCodeCopyFailed')}</p> : null}
        </div>
      ) : null}
      <CodexGlobalModel connection={connection} remote={remote} catalogRefreshKey={catalogRefreshKey} t={t} />
      {status.status === 'signed-in' ? (
        <section className="dsh-codex-model-refresh" aria-labelledby="dsh-codex-model-refresh-title">
          <div className="dsh-codex-model-refresh-header">
            <div>
              <h3 id="dsh-codex-model-refresh-title" className="dsh-codex-section-heading">{t('modelRefreshTitle')}</h3>
              <p className="dsh-codex-body dsh-codex-model-refresh-intro">{t('modelRefreshIntro')}</p>
            </div>
            <DshButton
              htmlType="button"
              theme="outline"
              type="secondary"
              size="small"
              disabled={modelRefresh.status === 'busy'}
              loading={modelRefresh.status === 'busy'}
              onClick={() => { void refreshModels() }}
            >
              {modelRefresh.status === 'busy' ? t('modelRefreshing') : t('modelRefreshAction')}
            </DshButton>
          </div>
          <p className="dsh-codex-body dsh-codex-model-refresh-status" aria-live="polite">
            {modelRefresh.status === 'done'
              ? t('modelRefreshDone').replace('{count}', String(modelRefresh.count))
              : modelRefresh.status === 'error'
                ? modelRefresh.message
                : ''}
          </p>
        </section>
      ) : null}
    </div>
  )
}
