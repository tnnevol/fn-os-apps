import { describe, expect, it } from 'vitest'
import { isBrowserRefreshShortcut } from '../src/client/browser-refresh-shortcut.ts'

describe('fnOS browser refresh shortcut', () => {
  it('recognizes browser refresh shortcuts', () => {
    expect(isBrowserRefreshShortcut({ key: 'F5', ctrlKey: false, metaKey: false })).toBe(true)
    expect(isBrowserRefreshShortcut({ key: 'r', ctrlKey: true, metaKey: false })).toBe(true)
    expect(isBrowserRefreshShortcut({ key: 'R', ctrlKey: false, metaKey: true })).toBe(true)
    expect(isBrowserRefreshShortcut({ key: 'r', ctrlKey: true, metaKey: false })).toBe(true)
  })

  it('does not treat ordinary or unrelated shortcuts as refresh', () => {
    expect(isBrowserRefreshShortcut({ key: 'r', ctrlKey: false, metaKey: false })).toBe(false)
    expect(isBrowserRefreshShortcut({ key: 'r', ctrlKey: false, metaKey: false })).toBe(false)
    expect(isBrowserRefreshShortcut({ key: 'F4', ctrlKey: true, metaKey: false })).toBe(false)
  })
})
