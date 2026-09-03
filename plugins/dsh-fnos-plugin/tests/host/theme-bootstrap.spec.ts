import { describe, expect, it } from 'vitest'
import { cachedFnosThemeForBoot, injectCachedFnosTheme, isDshThemePreference } from '../../src/host/theme-bootstrap.ts'

const html = '<body><script>const preference = "system"\nconst systemDark = preference === \'system\'</script><main /></body>'

describe('fnOS theme bootstrap', () => {
  it('does not treat third-party theme ids as persisted DSH preferences', () => {
    expect(isDshThemePreference('light')).toBe(true)
    expect(isDshThemePreference('dark')).toBe(true)
    expect(isDshThemePreference('system')).toBe(true)
    expect(isDshThemePreference('dream-skin')).toBe(false)
  })

  it('uses the cached fnOS theme only for DSH system preference', () => {
    expect(cachedFnosThemeForBoot('system', 'dark')).toBe('dark')
    expect(cachedFnosThemeForBoot('system', 'light')).toBe('light')
    expect(cachedFnosThemeForBoot('light', 'dark')).toBeNull()
    expect(cachedFnosThemeForBoot('dark', 'light')).toBeNull()
    expect(cachedFnosThemeForBoot('system', 'unknown')).toBeNull()
  })

  it('rewrites the official bootstrap preference without touching explicit DSH themes', () => {
    expect(injectCachedFnosTheme(html, 'system', 'dark')).toContain('const preference = "dark"')
    expect(injectCachedFnosTheme(html, 'system', 'light')).toContain('const preference = "light"')
    expect(injectCachedFnosTheme(html, 'light', 'dark')).toBe(html)
    expect(injectCachedFnosTheme(html, 'dark', 'light')).toBe(html)
  })

  it('does not inject a second bootstrap when the official marker is absent', () => {
    const withoutMarker = '<body><main /></body>'
    expect(injectCachedFnosTheme(withoutMarker, 'system', 'dark')).toBe(withoutMarker)
  })
})
