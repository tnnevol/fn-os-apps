/**
 * Diagnostics and result classification for the fnOS shared-directory picker.
 *
 * The SDK documents `undefined` as a possible picker result and documents
 * `{ code, msg, data }` as the bridge response. Some NAS versions return the
 * active close as a non-zero bridge response with an explicit cancellation
 * message, so that typed response shape is classified as a silent cancellation.
 */

const cancellationStatusPattern = /^(?:cancel(?:led|ed)?|abort(?:ed)?)$/iu
const cancellationMessagePattern = /(?:cancel|abort|closed|取消|关闭)/iu
const errorStatusPattern = /^(?:error|failed|failure|rejected)$/iu

export type PickerResultOutcome = 'cancelled' | 'success' | 'error' | 'unknown'

export interface PickerDataSummary {
  kind: 'undefined' | 'null' | 'array' | 'object' | 'string' | 'number' | 'boolean' | 'function' | 'symbol' | 'bigint'
  length?: number
  itemTypes?: string[]
}

/** Safe, path-free summary of a value returned by the fnOS SDK. */
export interface PickerResultDiagnosis {
  outcome: PickerResultOutcome
  reason: string
  valueType: string
  keys?: string[]
  code?: number
  errorCode?: string
  errorName?: string
  status?: string
  error?: string
  message?: string
  data?: PickerDataSummary
}

export interface PickerSdkLogger {
  info: (...data: unknown[]) => void
  warn: (...data: unknown[]) => void
}

export const PICKER_SDK_LOG_PREFIX = '[dsh-fnos][fnos-sdk][pickSharedFile]'

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function valueType(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (value instanceof Error) return value.constructor.name || 'Error'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function dataSummary(value: unknown): PickerDataSummary {
  if (value === undefined) return { kind: 'undefined' }
  if (value === null) return { kind: 'null' }
  if (Array.isArray(value)) {
    const itemTypes = [...new Set(value.slice(0, 5).map(item => valueType(item)))]
    return { kind: 'array', length: value.length, itemTypes }
  }
  if (typeof value === 'object') return { kind: 'object' }
  return { kind: typeof value }
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function diagnosisFor(value: unknown, outcome: PickerResultOutcome, reason: string): PickerResultDiagnosis {
  const diagnosis: PickerResultDiagnosis = {
    outcome,
    reason,
    valueType: valueType(value),
  }

  if (value instanceof Error) {
    diagnosis.errorName = value.name
    diagnosis.message = value.message
    const errorCode = (value as Error & { code?: unknown }).code
    if (typeof errorCode === 'string' && errorCode.length > 0) diagnosis.errorCode = errorCode
    return diagnosis
  }

  const record = asRecord(value)
  if (record === undefined) {
    if (value !== undefined && value !== null) diagnosis.data = dataSummary(value)
    return diagnosis
  }

  diagnosis.keys = Object.keys(record).sort()
  if (typeof record.code === 'number' && Number.isFinite(record.code)) diagnosis.code = record.code
  const status = stringField(record, 'status')
  if (status !== undefined) diagnosis.status = status
  const error = stringField(record, 'error')
  if (error !== undefined) diagnosis.error = error
  const message = stringField(record, 'msg') ?? stringField(record, 'message')
  if (message !== undefined) diagnosis.message = message
  diagnosis.data = dataSummary(record.data)
  return diagnosis
}

function explicitStatus(record: Record<string, unknown>): string | undefined {
  const status = stringField(record, 'status')
  return status?.trim()
}

/**
 * Classify only signals that are explicit in the SDK response/error shape.
 * Unknown values remain visible to the caller and are logged as unknown.
 */
export function diagnosePickerResult(value: unknown): PickerResultDiagnosis {
  if (value === undefined) return diagnosisFor(value, 'cancelled', 'sdk-returned-undefined')

  if (value instanceof Error) {
    if (value.name === 'AbortError' || value.name === 'CanceledError') {
      return diagnosisFor(value, 'cancelled', 'abort-error')
    }
    if (cancellationMessagePattern.test(value.message)) {
      return diagnosisFor(value, 'cancelled', 'explicit-cancel-error')
    }
    return diagnosisFor(value, 'error', 'exception')
  }

  const record = asRecord(value)
  if (record === undefined) return diagnosisFor(value, 'unknown', value === null ? 'null-result' : 'non-object-result')

  const status = explicitStatus(record)
  if (status !== undefined && cancellationStatusPattern.test(status)) {
    return diagnosisFor(value, 'cancelled', 'explicit-cancel-status')
  }
  if (status !== undefined && errorStatusPattern.test(status)) {
    return diagnosisFor(value, 'error', 'explicit-error-status')
  }

  const message = stringField(record, 'msg') ?? stringField(record, 'message')
  if (message !== undefined && Array.isArray(record.data) && record.data.length === 0 && cancellationMessagePattern.test(message)) {
    return diagnosisFor(value, 'cancelled', 'explicit-cancel-message')
  }

  if (typeof record.code === 'number' && Number.isFinite(record.code)) {
    return diagnosisFor(value, record.code === 0 ? 'success' : 'error', record.code === 0 ? 'success-code-0' : 'non-zero-code')
  }

  if (typeof record.error === 'string' && record.error.length > 0) {
    return diagnosisFor(value, 'error', 'error-field')
  }

  return diagnosisFor(value, 'unknown', 'unrecognized-result-shape')
}

/** Return true only when the SDK explicitly indicates that the picker closed. */
export function isPickerCancellation(value: unknown): boolean {
  return diagnosePickerResult(value).outcome === 'cancelled'
}

/** The typed success response with no selected paths means the picker was dismissed. */
export function isPickerNoSelection(value: unknown): boolean {
  const record = asRecord(value)
  return record?.code === 0 && Array.isArray(record.data) && record.data.length === 0
}

/** Write a non-sensitive invocation/result summary to the browser console. */
export function logPickerSdkEvent(
  stage: 'created' | 'ready' | 'resolved' | 'rejected',
  details: Record<string, unknown>,
  logger: PickerSdkLogger = console,
): void {
  const method = stage === 'rejected' ? logger.warn : logger.info
  method(PICKER_SDK_LOG_PREFIX, stage, details)
}

/** Diagnose and log an SDK result without logging selected NAS paths. */
export function logPickerSdkValue(
  stage: 'resolved' | 'rejected',
  value: unknown,
  logger: PickerSdkLogger = console,
): PickerResultDiagnosis {
  const diagnosis = diagnosePickerResult(value)
  const method = diagnosis.outcome === 'error' || diagnosis.outcome === 'unknown' ? logger.warn : logger.info
  method(PICKER_SDK_LOG_PREFIX, stage, diagnosis)
  return diagnosis
}
