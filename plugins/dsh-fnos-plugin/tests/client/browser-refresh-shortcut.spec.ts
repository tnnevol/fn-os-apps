import { describe, expect, it } from 'vitest'
import { isBrowserRefreshShortcut } from '../../src/client/shortcuts/browser-refresh-shortcut-matcher.ts'
import { isSettingsShortcut } from '../../src/client/shortcuts/settings-shortcut-matcher.ts'

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

  it('recognizes the platform settings shortcut', () => {
    expect(isSettingsShortcut({ key: ',', ctrlKey: true, metaKey: false })).toBe(true)
    expect(isSettingsShortcut({ key: ',', ctrlKey: false, metaKey: true })).toBe(true)
  })

  it('does not treat an unmodified comma as the settings shortcut', () => {
    expect(isSettingsShortcut({ key: ',', ctrlKey: false, metaKey: false })).toBe(false)
    expect(isSettingsShortcut({ key: '.', ctrlKey: true, metaKey: false })).toBe(false)
  })

  it('uses the settings shortcut matcher independently from the refresh matcher', () => {
    expect(isSettingsShortcut({ key: ',', ctrlKey: true, metaKey: false })).toBe(true)
    expect(isBrowserRefreshShortcut({ key: ',', ctrlKey: true, metaKey: false })).toBe(false)
  })
})
