/**
 * CodeBuddy settings section: in-app OAuth login plus the UI-only usage
 * preferences.
 *
 * Rendered inside the `settings.section` list slot (same original surface),
 * while the live usage readout now lives in the conversation composer.
 */

import { useCallback, useEffect, useState } from 'react'
import { DshButton, DshInput, DshSwitch } from '@tnnevol/dsh-semi-ui'
import { CODEBUDDY_AUTH_CHANNEL } from '../client/constants.ts'
import type { CodeBuddyLocaleKey } from '../client/locales.ts'
import type { AuthStatus, ConnectionRpc, LoginPoll, LoginStart, RpcErr } from '../client/rpc.ts'
import { describeRpcError } from '../client/rpc.ts'
import { CodeBuddyLogo } from './CodeBuddyLogo.tsx'
import {
  getCustomLimit,
  getDangerPct,
  getUsagePref,
  setCustomLimit,
  setDangerPct,
  setUsagePref,
  subscribeUsagePref,
} from '../client/usage-prefs.ts'

type Translate = (key: CodeBuddyLocaleKey) => string

/** How often the client polls a started login, in ms. */
const POLL_INTERVAL_MS = 1500
/** How long the client keeps polling before giving up, in ms. */
const POLL_DEADLINE_MS = 10 * 60 * 1000

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
}

export function CodeBuddySection({ rpc, t }: CodeBuddySectionProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [status, setStatus] = useState<AuthStatus | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [loginState, setLoginState] = useState<string | undefined>(undefined)
  const [showUsage, setShowUsage] = useState<boolean>(getUsagePref())
  const [customLimit, setCustomLimitState] = useState<number | undefined>(getCustomLimit())
  const [limitText, setLimitText] = useState<string>(customLimit === undefined ? '' : String(customLimit))
  const [dangerPct, setDangerPctState] = useState<number>(getDangerPct())
  const [dangerText, setDangerText] = useState<string>(String(getDangerPct()))

  useEffect(() => subscribeUsagePref(() => {
    setShowUsage(getUsagePref())
    const next = getCustomLimit()
    setCustomLimitState(next)
    setLimitText(next === undefined ? '' : String(next))
    const danger = getDangerPct()
    setDangerPctState(danger)
    setDangerText(String(danger))
  }), [])

  const refresh = useCallback(async () => {
    const result = await rpc.call<AuthStatus>(CODEBUDDY_AUTH_CHANNEL, 'status', {})
    if (result.ok) {
      setStatus(result.value)
      setPhase('idle')
    } else {
      setError(describeError(result))
      setPhase('error')
    }
  }, [rpc])

  // Load status once on mount.
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Poll an in-flight login until it completes or the deadline passes.
  useEffect(() => {
    if (loginState === undefined) return
    const startedAt = Date.now()
    let stopped = false
    const tick = async (): Promise<void> => {
      if (stopped) return
      const result = await rpc.call<LoginPoll>(CODEBUDDY_AUTH_CHANNEL, 'pollLogin', { state: loginState })
      if (stopped) return
      if (result.ok && result.value.done) {
        setLoginState(undefined)
        await refresh()
        return
      }
      if (Date.now() - startedAt >= POLL_DEADLINE_MS) {
        setLoginState(undefined)
        setError(t('timeout'))
        setPhase('error')
        return
      }
      window.setTimeout(tick, POLL_INTERVAL_MS)
    }
    void tick()
    return () => { stopped = true }
  }, [loginState, rpc, refresh, t])

  const startLogin = useCallback(async () => {
    setError(undefined)
    const result = await rpc.call<LoginStart>(CODEBUDDY_AUTH_CHANNEL, 'startLogin', {})
    if (!result.ok) {
      setError(describeError(result))
      setPhase('error')
      return
    }
    window.open(result.value.authUrl, '_blank', 'noopener')
    setLoginState(result.value.state)
  }, [rpc])

  const logout = useCallback(async () => {
    const result = await rpc.call<void>(CODEBUDDY_AUTH_CHANNEL, 'logout', {})
    if (result.ok) {
      setStatus({ loggedIn: false })
    } else {
      setError(describeError(result))
      setPhase('error')
    }
  }, [rpc])

  if (phase === 'loading') {
    return <div className="dsh-codebuddy-section"><p className="dsh-codebuddy-muted">{t('loading')}</p></div>
  }

  const signedIn = status?.loggedIn === true

  return (
    <div className="dsh-codebuddy-section">
      <div className="dsh-codebuddy-title-row">
        <CodeBuddyLogo size={18} />
        <h2 className="dsh-codebuddy-title">CodeBuddy</h2>
      </div>
      {!signedIn ? <p className="dsh-codebuddy-desc">{t('intro')}</p> : null}
      {error !== undefined ? <p className="dsh-codebuddy-error">{error}</p> : null}
      {signedIn
        ? (
            <div className="dsh-codebuddy-status">
              <StatusRow label={t('nickname')} value={status?.nickname ?? '—'} />
              {status?.uid !== undefined ? <StatusRow label={t('uid')} value={status.uid} /> : null}
              {status?.uin !== undefined ? <StatusRow label={t('uin')} value={status.uin} /> : null}
              {status?.enterpriseName !== undefined
                ? <StatusRow label={t('enterprise')} value={status.enterpriseName} />
                : null}
              {status?.enterpriseId !== undefined
                ? <StatusRow label={t('enterpriseId')} value={status.enterpriseId} />
                : null}
              {status?.enterpriseUserName !== undefined
                ? <StatusRow label={t('enterpriseUser')} value={status.enterpriseUserName} />
                : null}
              {status?.departmentFullName !== undefined
                ? <StatusRow label={t('department')} value={decodeDepartment(status.departmentFullName)} />
                : null}
              <div className="dsh-codebuddy-actions">
                <DshButton htmlType="button" theme="outline" type="secondary" onClick={() => { void logout() }}>
                  {t('signOut')}
                </DshButton>
              </div>
            </div>
          )
        : (
            <div className="dsh-codebuddy-status">
              <p className="dsh-codebuddy-muted">
                {loginState !== undefined ? t('waiting') : t('notSignedIn')}
              </p>
              <div className="dsh-codebuddy-actions">
                <DshButton
                  htmlType="button"
                  theme="solid"
                  type="primary"
                  disabled={loginState !== undefined}
                  onClick={() => { void startLogin() }}
                >
                  {loginState !== undefined ? t('signingIn') : t('signIn')}
                </DshButton>
              </div>
            </div>
          )}

      {/* Usage preferences: UI-only, configurable whether or not signed in. */}
      <div className="dsh-codebuddy-prefRow">
        <div className="dsh-codebuddy-prefRowText">
          <div className="dsh-codebuddy-prefTitle">{t('showUsage')}</div>
          <div className="dsh-codebuddy-prefDesc">{t('showUsageDesc')}</div>
        </div>
        <DshSwitch
          checked={showUsage}
          onChange={(checked) => { setUsagePref(checked) }}
          aria-label={t('showUsage')}
        />
      </div>
      <div className="dsh-codebuddy-prefRow">
        <div className="dsh-codebuddy-prefRowText">
          <div className="dsh-codebuddy-prefTitle">{t('customLimit')}</div>
          <div className="dsh-codebuddy-prefDesc">{t('customLimitDesc')}</div>
        </div>
        <DshInput
          type="number"
          className="dsh-codebuddy-prefInput"
          value={limitText}
          placeholder={t('customLimitPlaceholder')}
          onChange={(value) => { setLimitText(String(value)) }}
          onBlur={() => {
            const parsed = Number(limitText)
            if (limitText.length === 0 || !Number.isFinite(parsed) || parsed <= 0) {
              setCustomLimit(undefined)
            } else {
              setCustomLimit(parsed)
            }
          }}
        />
      </div>
      <div className="dsh-codebuddy-prefRow">
        <div className="dsh-codebuddy-prefRowText">
          <div className="dsh-codebuddy-prefTitle">{t('dangerPct')}</div>
          <div className="dsh-codebuddy-prefDesc">{t('dangerPctDesc')}</div>
        </div>
        <DshInput
          type="number"
          className="dsh-codebuddy-prefInput"
          value={dangerText}
          onChange={(value) => { setDangerText(String(value)) }}
          onBlur={() => {
            const parsed = Number(dangerText)
            if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
              setDangerPct(undefined)
              setDangerText(String(getDangerPct()))
            } else {
              const clamped = Math.round(parsed)
              setDangerPct(clamped)
              setDangerText(String(clamped))
            }
          }}
        />
      </div>
    </div>
  )
}
