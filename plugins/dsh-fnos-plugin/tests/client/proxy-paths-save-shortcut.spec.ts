import { describe, expect, it, vi } from 'vitest'
import { isProxyPathsSaveShortcut } from '../../src/client/shortcuts/proxy-paths-save-shortcut.ts'

describe('gateway proxy paths save shortcut', () => {
  it('accepts Ctrl+S and ⌘+S', () => {
    expect(isProxyPathsSaveShortcut({ key: 's', ctrlKey: true, metaKey: false, altKey: false })).toBe(true)
    expect(isProxyPathsSaveShortcut({ key: 's', ctrlKey: false, metaKey: true, altKey: false })).toBe(true)
  })

  it('accepts the key with Shift or Caps Lock applied', () => {
    // Shift/Caps change `key` to 'S' without changing the user's intent.
    expect(isProxyPathsSaveShortcut({ key: 'S', ctrlKey: true, metaKey: false, altKey: false })).toBe(true)
    expect(isProxyPathsSaveShortcut({ key: 'S', ctrlKey: false, metaKey: true, altKey: false })).toBe(true)
  })

  it('ignores an unmodified S so ordinary typing keeps working', () => {
    expect(isProxyPathsSaveShortcut({ key: 's', ctrlKey: false, metaKey: false, altKey: false })).toBe(false)
  })

  it('ignores other Ctrl/⌘ combinations', () => {
    expect(isProxyPathsSaveShortcut({ key: 'Enter', ctrlKey: true, metaKey: false, altKey: false })).toBe(false)
    expect(isProxyPathsSaveShortcut({ key: 'a', ctrlKey: true, metaKey: false, altKey: false })).toBe(false)
    expect(isProxyPathsSaveShortcut({ key: 'r', ctrlKey: false, metaKey: true, altKey: false })).toBe(false)
  })

  it('ignores Alt combinations that produce printable characters', () => {
    // Ctrl+Alt+S is AltGr+S on some layouts; it must not trigger a save.
    expect(isProxyPathsSaveShortcut({ key: 's', ctrlKey: true, metaKey: false, altKey: true })).toBe(false)
  })

  it('does not depend on the legacy Ctrl+Enter gesture', () => {
    expect(isProxyPathsSaveShortcut({ key: 'Enter', ctrlKey: true, metaKey: false, altKey: false })).toBe(false)
  })
})

describe('textarea save handler wiring', () => {
  it('prevents default and stops propagation only for the matched gesture', async () => {
    const event = {
      key: 's',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }
    expect(isProxyPathsSaveShortcut(event)).toBe(true)
    if (isProxyPathsSaveShortcut(event)) {
      event.preventDefault()
      event.stopPropagation()
    }
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(event.stopPropagation).toHaveBeenCalledOnce()

    const other = {
      key: 'a',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }
    if (isProxyPathsSaveShortcut(other)) {
      other.preventDefault()
      other.stopPropagation()
    }
    expect(other.preventDefault).not.toHaveBeenCalled()
    expect(other.stopPropagation).not.toHaveBeenCalled()
  })
})
