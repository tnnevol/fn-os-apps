/**
 * Detect the result shapes used by different fnOS hosts when a file picker is
 * closed without confirming a selection.
 *
 * The SDK type allows `undefined`, while some host versions return a bridge
 * response with a cancel status/message or an empty result. Keep this helper
 * separate from the card so those host variations can be tested without a
 * browser or React runtime.
 */

const cancellationStatusPattern = /^(?:cancel(?:led|ed)?|abort(?:ed)?)$/iu
const cancellationMessagePattern = /(?:用户\s*)?(?:已\s*)?取消(?:选择|操作|授权)?(?:$|[\s,，。!！])|\b(?:cancel(?:led|ed)?|abort(?:ed)?|user[_ -]?cancel(?:led|ed)?)\b/iu
const adminOnlyPickerMessagePattern = /(?:只有|仅)\s*(?:NAS|fnOS|飞牛)?\s*管理员.*(?:授权|操作|目录)/iu

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function textFields(record: Record<string, unknown>): string {
  return [record.msg, record.message, record.error]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .trim()
}

function hasCancellationStatus(record: Record<string, unknown>): boolean {
  const data = asRecord(record.data)
  return [record.status, data?.status]
    .some(status => typeof status === 'string' && cancellationStatusPattern.test(status.trim()))
}

/** Return true when the fnOS picker was closed without a confirmed selection. */
export function isPickerCancellation(value: unknown): boolean {
  if (value === undefined || value === null) return true

  if (value instanceof Error) {
    if (value.name === 'AbortError' || value.name === 'CanceledError') return true
    if (adminOnlyPickerMessagePattern.test(value.message)) return true
  }

  const record = asRecord(value)
  if (!record) return false
  if (hasCancellationStatus(record)) return true

  const message = textFields(record)
  if (cancellationMessagePattern.test(message)) return true

  // The fnOS iframe host currently uses the same empty-path bridge response
  // when the shared picker closes without a selection. One variant includes
  // code 1 and the administrator-only message; there is no state change to
  // report in either case, so keep the picker dismissal silent. Permission
  // errors from the follow-up Host list/delete routes remain visible.
  if (!Array.isArray(record.data)) return adminOnlyPickerMessagePattern.test(message)
  if (record.data.length !== 0) return false
  if (message.length === 0) return true
  return record.code === 1 && adminOnlyPickerMessagePattern.test(message)
}
