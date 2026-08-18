/** Live optional-capability settings for the Codex Auth plugin. */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { CodexAuthSettingsConfig } from '../settings-contract.ts'
import type { CodexAuthLocaleKey } from './locales.ts'

export interface CodexCapabilitiesProps {
  scope?: SettingsScope<CodexAuthSettingsConfig> | undefined
  t: (key: CodexAuthLocaleKey) => string
}

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  borderTop: '1px solid var(--dsw-alias-border-l2)',
  paddingTop: 14,
}
const headingStyle: CSSProperties = { margin: 0, fontSize: 14, lineHeight: '20px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }
const bodyStyle: CSSProperties = { margin: 0, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-secondary)' }
const fieldsetStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, margin: 0, padding: 0, border: 0 }
const rowStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer' }
const disabledRowStyle: CSSProperties = { ...rowStyle, cursor: 'not-allowed', opacity: 0.62 }
const copyStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2 }
const labelStyle: CSSProperties = { fontSize: 13, lineHeight: '18px', fontWeight: 500, color: 'var(--dsw-alias-label-primary)' }
const actionsStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }
const buttonsStyle: CSSProperties = { display: 'flex', gap: 8 }
const buttonStyle: CSSProperties = {
  boxSizing: 'border-box',
  minHeight: 30,
  padding: '4px 12px',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 16,
  background: 'var(--dsw-alias-bg-layer-1)',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
}
const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  border: 0,
  background: 'var(--dsw-alias-button-primary-fill)',
  color: 'var(--dsw-alias-label-primary-foreground)',
}
const errorStyle: CSSProperties = { ...bodyStyle, color: 'var(--dsw-alias-state-error-primary, #d92d20)' }
const successStyle: CSSProperties = { ...bodyStyle, color: 'var(--dsw-alias-state-success-primary, #16825d)' }

const UNAVAILABLE_SNAPSHOT: SettingsScopeSnapshot<CodexAuthSettingsConfig> = {
  status: 'unavailable',
  value: undefined,
  base: undefined,
  user: undefined,
  revision: undefined,
  writable: false,
  mode: 'memory',
}

/** Render the capability controls with the same Save/Discard contract as DSH settings. */
export function CodexCapabilities({ scope, t }: CodexCapabilitiesProps) {
  const subscribe = useCallback((listener: () => void) => scope?.subscribe(listener) ?? (() => undefined), [scope])
  const getSnapshot = useCallback(() => scope?.getSnapshot() ?? UNAVAILABLE_SNAPSHOT, [scope])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const [draft, setDraft] = useState<CodexAuthSettingsConfig | undefined>(snapshot.value)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    if (!dirty && !busy) setDraft(snapshot.value)
  }, [busy, dirty, snapshot.revision, snapshot.value])

  const updateImageTool = (enabled: boolean): void => {
    setDraft(current => current === undefined ? current : { ...current, enableImageTool: enabled })
    setDirty(true)
    setFeedback('idle')
  }

  const updateImageUpload = (enabled: boolean): void => {
    setDraft(current => current === undefined ? current : { ...current, enableImageUpload: enabled })
    setDirty(true)
    setFeedback('idle')
  }

  const discard = (): void => {
    setDraft(scope?.getSnapshot().value)
    setDirty(false)
    setFeedback('idle')
  }

  const save = async (): Promise<void> => {
    if (scope === undefined || draft === undefined || !snapshot.writable || busy) return
    setBusy(true)
    setFeedback('idle')
    try {
      await scope.set('enableImageTool', draft.enableImageTool)
      await scope.set('enableImageUpload', draft.enableImageUpload)
      const accepted = scope.getSnapshot().value
      if (accepted?.enableImageTool !== draft.enableImageTool || accepted?.enableImageUpload !== draft.enableImageUpload) {
        throw new Error('Host returned a different image setting')
      }
      setDraft(accepted)
      setDirty(false)
      setFeedback('saved')
    } catch {
      setDraft(scope.getSnapshot().value)
      setDirty(false)
      setFeedback('error')
    } finally {
      setBusy(false)
    }
  }

  const loading = snapshot.status === 'loading'
  const editable = snapshot.status === 'ready' && snapshot.writable && !busy

  return (
    <section style={sectionStyle} aria-labelledby="dsh-codex-capabilities-title">
      <div>
        <h3 id="dsh-codex-capabilities-title" style={headingStyle}>{t('capabilitiesTitle')}</h3>
        <p style={{ ...bodyStyle, marginTop: 3 }}>{t('capabilitiesIntro')}</p>
      </div>
      {loading ? <p style={bodyStyle} role="status">{t('settingsLoading')}</p> : null}
      {snapshot.status === 'unavailable' ? <p style={errorStyle} role="alert">{t('settingsUnavailable')}</p> : null}
      {snapshot.status === 'ready' && !snapshot.writable ? <p style={errorStyle} role="alert">{t('settingsReadOnly')}</p> : null}
      {draft === undefined ? null : (
        <fieldset style={fieldsetStyle} disabled={!editable}>
          <label style={rowStyle}>
            <input
              type="checkbox"
              checked={draft.enableImageTool}
              onChange={event => { updateImageTool(event.currentTarget.checked) }}
            />
            <span style={copyStyle}>
              <span style={labelStyle}>{t('enableImageRecognition')}</span>
              <span style={bodyStyle}>{t('enableImageRecognitionHelp')}</span>
            </span>
          </label>
          <label style={rowStyle}>
            <input
              type="checkbox"
              checked={draft.enableImageUpload}
              onChange={event => { updateImageUpload(event.currentTarget.checked) }}
            />
            <span style={copyStyle}>
              <span style={labelStyle}>{t('enableImageUpload')}</span>
              <span style={bodyStyle}>{t('enableImageUploadHelp')}</span>
            </span>
          </label>
          <label style={disabledRowStyle} title={t('imageGenerationUnavailableHelp')}>
            <input type="checkbox" checked={false} disabled aria-label={t('enableImageGeneration')} readOnly />
            <span style={copyStyle}>
              <span style={labelStyle}>{t('enableImageGeneration')}</span>
              <span style={bodyStyle}>{t('imageGenerationUnavailableHelp')}</span>
            </span>
          </label>
        </fieldset>
      )}
      <div style={actionsStyle}>
        <span aria-live="polite">
          {feedback === 'saved' ? <span style={successStyle}>{t('settingsSaved')}</span> : null}
          {feedback === 'error' ? <span style={errorStyle}>{t('settingsSaveFailed')}</span> : null}
        </span>
        <span style={buttonsStyle}>
          <button type="button" style={buttonStyle} disabled={!dirty || busy} onClick={discard}>{t('discard')}</button>
          <button type="button" style={primaryButtonStyle} disabled={!dirty || !snapshot.writable || busy} onClick={() => { void save() }}>
            {busy ? t('saving') : t('save')}
          </button>
        </span>
      </div>
    </section>
  )
}
