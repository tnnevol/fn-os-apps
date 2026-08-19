import { describe, expect, it } from 'vitest'
import { isPickerCancellation } from '../src/client/picker-result.ts'

describe('fnOS shared-directory picker result', () => {
  it('treats an omitted result and explicit cancel statuses as cancellation', () => {
    expect(isPickerCancellation(undefined)).toBe(true)
    expect(isPickerCancellation({ status: 'cancel' })).toBe(true)
    expect(isPickerCancellation({ data: { status: 'canceled' } })).toBe(true)
    expect(isPickerCancellation(new DOMException('The picker was closed', 'AbortError'))).toBe(true)
  })

  it('recognizes cancel messages and empty responses from older hosts', () => {
    expect(isPickerCancellation({ code: 2, msg: '用户取消选择', data: [] })).toBe(true)
    expect(isPickerCancellation({ code: 2, msg: '', data: [] })).toBe(true)
  })

  it('keeps non-empty permission and API errors visible', () => {
    expect(isPickerCancellation({ code: 1, msg: '仅管理员可进行此操作', data: ['/vol4/share'] })).toBe(false)
    expect(isPickerCancellation({ code: 2, msg: '授权接口不可用', data: [] })).toBe(false)
    expect(isPickerCancellation(new Error('permission denied'))).toBe(false)
  })

  it('silently handles the fnOS empty administrator response used when the picker closes', () => {
    expect(isPickerCancellation({ code: 1, msg: '仅管理员可进行此操作', data: [] })).toBe(true)
    expect(isPickerCancellation({ code: 1, msg: '只有NAS管理员可以授权目录', data: [] })).toBe(true)
    expect(isPickerCancellation({ code: 1, msg: '只有NAS管理员可以授权目录' })).toBe(true)
    expect(isPickerCancellation(new Error('仅管理员可进行此操作'))).toBe(true)
    expect(isPickerCancellation(new Error('只有NAS管理员可以授权目录'))).toBe(true)
  })
})
