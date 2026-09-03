/** DSH sidebar action for restarting the upstream Web process through fnOS. */

import { useCallback, useState } from 'react'
import { DshButton, DshButtonGroup, DshIconButton, DshIconRefresh2, DshIconSync } from '@tnnevol/dsh-semi-ui'
import { isEmbeddedFnosFrame } from '../client/services/sdk-carrier.ts'
import type { FnosLocaleKey } from '../client/locales.ts'

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

  const refresh = useCallback((): void => {
    window.location.reload()
  }, [])

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

  const restartLabel = error ? t('webRestartFailed') : busy ? t('webRestarting') : t('webRestart')
  const refreshLabel = t('refresh')
  const refreshIcon = <DshIconSync size={wide ? 'small' : 'default'} />
  const restartIcon = <DshIconRefresh2 size={wide ? 'small' : 'default'} spin={busy} />

  if (wide) {
    return (
      <DshButtonGroup
        size="small"
        type="tertiary"
        className="dsh-fnos-web-actions"
        aria-label={`${refreshLabel} / ${restartLabel}`}
      >
        <DshButton
          type="tertiary"
          theme="borderless"
          disabled={busy}
          icon={refreshIcon}
          className="dsh-fnos-web-refresh"
          title={refreshLabel}
          onClick={refresh}
        >
          {refreshLabel}
        </DshButton>
        <DshButton
          type="tertiary"
          theme="borderless"
          disabled={busy}
          icon={restartIcon}
          title={restartLabel}
          onClick={() => { void restart() }}
        >
          {restartLabel}
        </DshButton>
      </DshButtonGroup>
    )
  }

  return (
    <DshButtonGroup
      size="small"
      type="tertiary"
      className="dsh-fnos-web-actions dsh-fnos-web-actions--collapsed"
      aria-label={`${refreshLabel} / ${restartLabel}`}
    >
      <DshIconButton
        size="small"
        type="tertiary"
        theme="borderless"
        disabled={busy}
        icon={refreshIcon}
        className="dsh-fnos-web-refresh"
        aria-label={refreshLabel}
        title={refreshLabel}
        onClick={refresh}
      />
      <DshIconButton
        size="small"
        type="tertiary"
        theme="borderless"
        disabled={busy}
        icon={restartIcon}
        aria-label={restartLabel}
        title={restartLabel}
        onClick={() => { void restart() }}
      />
    </DshButtonGroup>
  )
}
