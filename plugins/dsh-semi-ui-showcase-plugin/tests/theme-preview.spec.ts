import { describe, expect, it, vi } from 'vitest'
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import { ShowcaseThemeController, THEME_OPTIONS } from '../src/client/theme-preview.ts'

const snapshot = (preference: ThemeSnapshot['preference']): ThemeSnapshot => ({ preference } as ThemeSnapshot)

describe('Semi UI showcase theme preview', () => {
  it('exposes the three DSH theme preferences', () => {
    expect(THEME_OPTIONS.map(option => option.id)).toEqual(['light', 'dark', 'system'])
  })

  it('updates subscribers when DSH publishes a new theme snapshot', () => {
    const controller = new ShowcaseThemeController(snapshot('system'), vi.fn())
    const listener = vi.fn()
    controller.subscribe(listener)
    const next = snapshot('dark')
    controller.sync(next)
    expect(controller.getSnapshot()).toBe(next)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('forwards a selection to the DSH theme runtime', () => {
    const update = vi.fn()
    const controller = new ShowcaseThemeController(snapshot('system'), update)
    controller.setPreference('light')
    expect(update).toHaveBeenCalledWith('light')
  })

  it('removes subscribers when they unsubscribe', () => {
    const controller = new ShowcaseThemeController(snapshot('system'), vi.fn())
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)
    unsubscribe()
    controller.sync(snapshot('dark'))
    expect(listener).not.toHaveBeenCalled()
  })
})
