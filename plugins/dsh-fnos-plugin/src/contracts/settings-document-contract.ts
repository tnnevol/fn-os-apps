/** Browser/Host contract for opening the DSH settings document through fnOS. */

/** Same-origin route that prepares and returns the current DSH settings document path. */
export const FNOS_SETTINGS_DOCUMENT_PATH = '/plugins/dsh-fnos/settings/document'

export interface FnosSettingsDocumentResponse {
  /** Absolute path prepared by the Host settings provider. */
  path: string
}
