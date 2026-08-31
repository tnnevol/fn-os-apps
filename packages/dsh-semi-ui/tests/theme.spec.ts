import { afterEach, describe, expect, it, vi } from 'vitest'
import { installSemiDshTheme, SEMI_DSH_THEME_ATTRIBUTE } from '../src/theme.ts'

function createAttributeTarget() {
  const attributes = new Map<string, string>()
  return {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    hasAttribute: (name: string) => attributes.has(name),
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name),
  }
}

describe('DSH Semi UI theme bridge', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('installs the scoped marker and maps the DSH theme to Semi', () => {
    const body = createAttributeTarget()
    const fakeDocument = {
      body,
      head: { querySelectorAll: vi.fn(() => []) },
    }
    vi.stubGlobal('document', fakeDocument)

    const dispose = installSemiDshTheme()

    expect(body.getAttribute(SEMI_DSH_THEME_ATTRIBUTE)).toBe('')
    expect(body.getAttribute('theme-mode')).toBe('light')

    dispose()
    expect(body.getAttribute(SEMI_DSH_THEME_ATTRIBUTE)).toBeNull()
    expect(body.getAttribute('theme-mode')).toBeNull()
  })

  it('does nothing when called outside a browser document', () => {
    vi.stubGlobal('document', undefined)
    expect(() => installSemiDshTheme()).not.toThrow()
  })
})
