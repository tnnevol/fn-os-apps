/** Browser-side API helper for the Host-prepared DSH settings document. */

import { FNOS_SETTINGS_DOCUMENT_PATH, type FnosSettingsDocumentResponse } from '../../contracts/settings-document-contract.ts'

export class SettingsDocumentRequestError extends Error {
  constructor(readonly code: string, message = code) {
    super(message)
    this.name = 'SettingsDocumentRequestError'
  }
}

export async function requestSettingsDocumentPath(): Promise<string> {
  const response = await fetch(FNOS_SETTINGS_DOCUMENT_PATH, {
    headers: { accept: 'application/json' },
    credentials: 'same-origin',
  })
  const value: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const code = typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
      ? value.error
      : `HTTP ${response.status}`
    throw new SettingsDocumentRequestError(code)
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value) || typeof (value as FnosSettingsDocumentResponse).path !== 'string') {
    throw new SettingsDocumentRequestError('invalid-fnos-settings-document-response')
  }
  return (value as FnosSettingsDocumentResponse).path
}
