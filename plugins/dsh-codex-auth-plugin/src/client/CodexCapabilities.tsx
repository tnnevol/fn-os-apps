/** Live optional-capability settings for the Codex Auth plugin. */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { DshButton, DshCheckbox } from '@tnnevol/dsh-semi-ui'
import type { CodexAuthSettingsConfig } from '../settings-contract.ts'
import type { CodexAuthLocaleKey } from './locales.ts'
import { formatImageGenerationHelp } from './image-capability-message.ts'

export interface CodexCapabilitiesProps {
  scope?: SettingsScope<CodexAuthSettingsConfig> | undefined
  t: (key: CodexAuthLocaleKey) => string
  dshVersion?: string | undefined
}

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
export function CodexCapabilities({ scope, t, dshVersion }: CodexCapabilitiesProps) {
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
  const imageGenerationHelp = formatImageGenerationHelp(t, dshVersion)

  return (
    <section className="dsh-codex-capabilities" aria-labelledby="dsh-codex-capabilities-title">
      <div>
        <h3 id="dsh-codex-capabilities-title" className="dsh-codex-section-heading">{t('capabilitiesTitle')}</h3>
        <p className="dsh-codex-body dsh-codex-capabilities-intro">{t('capabilitiesIntro')}</p>
      </div>
      {loading ? <p className="dsh-codex-body" role="status">{t('settingsLoading')}</p> : null}
      {snapshot.status === 'unavailable' ? <p className="dsh-codex-error" role="alert">{t('settingsUnavailable')}</p> : null}
      {snapshot.status === 'ready' && !snapshot.writable ? <p className="dsh-codex-error" role="alert">{t('settingsReadOnly')}</p> : null}
      {draft === undefined ? null : (
        <fieldset className="dsh-codex-capabilities-fields" disabled={!editable}>
          <DshCheckbox
            className="dsh-codex-capability-row"
            checked={draft.enableImageTool}
            disabled={!editable}
            aria-label={t('enableImageRecognition')}
            onChange={() => { updateImageTool(!draft.enableImageTool) }}
          >
            <span className="dsh-codex-capability-copy">
              <span className="dsh-codex-capability-label">{t('enableImageRecognition')}</span>
              <span className="dsh-codex-body">{t('enableImageRecognitionHelp')}</span>
            </span>
          </DshCheckbox>
          <DshCheckbox
            className="dsh-codex-capability-row"
            checked={draft.enableImageUpload}
            disabled={!editable}
            aria-label={t('enableImageUpload')}
            onChange={() => { updateImageUpload(!draft.enableImageUpload) }}
          >
            <span className="dsh-codex-capability-copy">
              <span className="dsh-codex-capability-label">{t('enableImageUpload')}</span>
              <span className="dsh-codex-body">{t('enableImageUploadHelp')}</span>
            </span>
          </DshCheckbox>
          <span className="dsh-codex-capability-row dsh-codex-capability-row--disabled" title={imageGenerationHelp}>
            <DshCheckbox
              checked={false}
              disabled
              aria-label={t('enableImageGeneration')}
            >
              <span className="dsh-codex-capability-copy">
                <span className="dsh-codex-capability-label">{t('enableImageGeneration')}</span>
                <span className="dsh-codex-body">{imageGenerationHelp}</span>
              </span>
            </DshCheckbox>
          </span>
        </fieldset>
      )}
      <div className="dsh-codex-capabilities-actions">
        <span aria-live="polite">
          {feedback === 'saved' ? <span className="dsh-codex-success">{t('settingsSaved')}</span> : null}
          {feedback === 'error' ? <span className="dsh-codex-error">{t('settingsSaveFailed')}</span> : null}
        </span>
        <span className="dsh-codex-capabilities-buttons">
          <DshButton htmlType="button" theme="outline" type="secondary" size="small" disabled={!dirty || busy} onClick={discard}>{t('discard')}</DshButton>
          <DshButton htmlType="button" theme="solid" type="primary" size="small" disabled={!dirty || !snapshot.writable || busy} loading={busy} onClick={() => { void save() }}>
            {busy ? t('saving') : t('save')}
          </DshButton>
        </span>
      </div>
    </section>
  )
}
