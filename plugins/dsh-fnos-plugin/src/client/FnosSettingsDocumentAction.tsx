/** fnOS replacement for DSH's settings.openDocument header action. */

import { useCallback, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { DshButton, DshIconSetting as IconSetting } from '@tnnevol/dsh-semi-ui'
import { isEmbeddedFnosFrame } from './sdk-carrier.ts'
import { createTrimApp } from './sdk.ts'
import { requestSettingsDocumentPath } from './settings-document-client.ts'
import type { FnosLocaleKey } from './locales.ts'

type Translate = (key: FnosLocaleKey) => string

type SettingsDocumentActionProps = PropsRuntime<'settings.action'> & PropsLocale<'settings.dsh-fnos'> & {
  t: Translate
}

export function FnosSettingsDocumentAction({ t }: SettingsDocumentActionProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const open = useCallback(async () => {
    if (!isEmbeddedFnosFrame()) return
    setBusy(true)
    setError(false)
    try {
      const path = await requestSettingsDocumentPath()
      const sdk = createTrimApp()
      await sdk.ready()
      if (!sdk.isWeb || sdk.isStandaloneWeb) throw new Error('fnOS iframe SDK did not initialize its web carrier')
      await sdk.openFile(path)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }, [])

  if (!isEmbeddedFnosFrame()) return null
  return (
    <DshButton
      size="small"
      type="tertiary"
      style={{ borderRadius: '32px' }}
      disabled={busy}
      title={error ? t('settingsDocumentOpenFailed') : t('openSettingsDocument')}
      onClick={() => { void open() }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '6px' }}>
        <IconSetting />
      </span>
      {error ? t('settingsDocumentOpenFailed') : t('openSettingsDocument')}
    </DshButton>
  )
}
