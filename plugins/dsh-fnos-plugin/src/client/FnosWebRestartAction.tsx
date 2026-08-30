/** DSH sidebar action for restarting the upstream Web process through fnOS. */

import { useCallback, useState } from 'react'
import { DshButton, DshIconButton, DshIconRefresh, DshTooltip } from '@tnnevol/dsh-semi-ui'
import { isEmbeddedFnosFrame } from './sdk-carrier.ts'
import type { FnosLocaleKey } from './locales.ts'

type Translate = (key: FnosLocaleKey) => string

interface FnosWebRestartActionProps {
  wide: boolean
  t: Translate
}

function gatewayControlUrl(path: string): string {
  if (typeof document === 'undefined') return path
  const base = document.querySelector('base')?.href
  if (base !== undefined) {
    try { return new URL(path.slice(1), base).toString() } catch {}
  }
  return path
}

export function FnosWebRestartAction({ wide, t }: FnosWebRestartActionProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const restart = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError(false)
    try {
      const response = await fetch(gatewayControlUrl('/__fnos-gateway/control/web/restart'), {
        method: 'POST',
        headers: { 'x-requested-with': 'fetch' },
        credentials: 'same-origin',
      })
      const value: unknown = await response.json().catch(() => undefined)
      if (!response.ok) throw new Error(
        typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
          ? value.error
          : `HTTP ${response.status}`,
      )
      window.setTimeout(() => { window.location.reload() }, 300)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }, [])

  if (!isEmbeddedFnosFrame()) return null

  const label = error ? t('webRestartFailed') : busy ? t('webRestarting') : t('webRestart')
  const icon = <DshIconRefresh size={wide ? 'small' : 'default'} />
  const control = wide
    ? (
      <DshButton
        size="small"
        type="tertiary"
        disabled={busy}
        onClick={() => { void restart() }}
        title={label}
        style={{ width: '100%', borderRadius: '32px' }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 6 }}>{icon}</span>
        {label}
      </DshButton>
    )
    : (
      <DshIconButton
        size="small"
        type="tertiary"
        theme="borderless"
        disabled={busy}
        icon={icon}
        aria-label={label}
        title={label}
        onClick={() => { void restart() }}
      />
    )

  return wide ? control : (
    <DshTooltip content={label} position="right" showArrow>
      {control}
    </DshTooltip>
  )
}
