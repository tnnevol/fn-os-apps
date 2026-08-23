/** Browser/Host contract for exporting one DSH Session log to fnOS storage. */

/** Same-origin route that streams the DSH Session log ZIP into an authorized directory. */
export const FNOS_SESSION_LOG_EXPORT_PATH = '/plugins/dsh-fnos/session-log/export'

export interface FnosSessionLogExportRequest {
  sessionId: string
  directory: string
}

export interface FnosSessionLogExportResponse {
  path: string
}
