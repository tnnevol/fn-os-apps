import { describe, expect, it } from 'vitest'
import {
  PICKER_SDK_LOG_PREFIX,
  diagnosePickerResult,
  isPickerCancellation,
  isPickerNoSelection,
  logPickerSdkValue,
} from '../../src/client/input-references/picker-result.ts'

describe('fnOS shared-directory picker result', () => {
  it('treats only documented/explicit close signals as cancellation', () => {
    expect(isPickerCancellation(undefined)).toBe(true)
    expect(isPickerCancellation({ status: 'cancel' })).toBe(true)
    expect(isPickerCancellation({ status: 'canceled' })).toBe(true)
    expect(isPickerCancellation(new DOMException('The picker was closed', 'AbortError'))).toBe(true)
    expect(isPickerCancellation(new Error('用户取消授权'))).toBe(true)
  })

  it('silently treats an empty typed success response as no selection', () => {
    expect(isPickerNoSelection({ code: 0, msg: '', data: [] })).toBe(true)
    expect(isPickerNoSelection({ code: 0, msg: '', data: ['/vol4/share'] })).toBe(false)
    expect(isPickerNoSelection({ code: 1, msg: '仅管理员可进行此操作', data: [] })).toBe(false)
  })

  it('silently treats an explicit active-close bridge response as cancellation', () => {
    expect(isPickerCancellation({ code: 0, msg: '', data: [] })).toBe(false)
    expect(isPickerCancellation({ code: 1, msg: '仅管理员可进行此操作', data: [] })).toBe(false)
    expect(isPickerCancellation({ code: 2, msg: '用户取消选择', data: [] })).toBe(true)
    expect(isPickerCancellation({ code: 2, msg: '', data: [] })).toBe(false)
  })

  it('keeps callback errors, permission errors, and unknown shapes visible', () => {
    expect(isPickerCancellation({ status: 'error', error: 'access_denied', method: 'pickSharedFile' })).toBe(false)
    expect(isPickerCancellation(new Error('permission denied'))).toBe(false)
    expect(isPickerCancellation(null)).toBe(false)
    expect(isPickerCancellation({ msg: '用户取消选择' })).toBe(false)
    expect(isPickerCancellation({ code: 2, msg: '用户取消选择', data: ['/vol4/share'] })).toBe(false)
  })

  it('summarizes the response without logging selected NAS paths', () => {
    const entries: unknown[][] = []
    const logger = {
      info: (...data: unknown[]) => entries.push(data),
      warn: (...data: unknown[]) => entries.push(data),
    }

    const diagnosis = logPickerSdkValue('resolved', {
      code: 0,
      msg: 'ok',
      data: ['/vol4/share/projects'],
    }, logger)

    expect(diagnosis).toMatchObject({
      outcome: 'success',
      reason: 'success-code-0',
      data: { kind: 'array', length: 1, itemTypes: ['string'] },
    })
    expect(entries[0]?.[0]).toBe(PICKER_SDK_LOG_PREFIX)
    expect(JSON.stringify(entries)).not.toContain('/vol4/share/projects')
  })

  it('records the actual shape of an administrator error for diagnostics', () => {
    expect(diagnosePickerResult({ code: 1, msg: '仅管理员可进行此操作', data: [] })).toMatchObject({
      outcome: 'error',
      reason: 'non-zero-code',
      code: 1,
      message: '仅管理员可进行此操作',
      data: { kind: 'array', length: 0 },
    })
  })
})
