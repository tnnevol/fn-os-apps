/** Browser-side request for streaming a Session log ZIP into fnOS storage. */

import { FNOS_SESSION_LOG_EXPORT_PATH, type FnosSessionLogExportResponse } from '../../contracts/session-log-export-contract.ts'

export class SessionLogExportRequestError extends Error {
  constructor(readonly code: string, message = code) {
    super(message)
    this.name = 'SessionLogExportRequestError'
  }
}

export async function exportSessionLogToNas(sessionId: string, directory: string): Promise<string> {
  const response = await fetch(FNOS_SESSION_LOG_EXPORT_PATH, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ sessionId, directory }),
  })
  const value: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const code = typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
      ? value.error
      : `HTTP ${response.status}`
    throw new SessionLogExportRequestError(code)
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value) || typeof (value as FnosSessionLogExportResponse).path !== 'string') {
    throw new SessionLogExportRequestError('invalid-session-log-export-response')
  }
  return (value as FnosSessionLogExportResponse).path
}
