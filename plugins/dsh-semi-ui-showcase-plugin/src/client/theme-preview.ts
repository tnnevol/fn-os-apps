import type { ThemePreference, ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'

export const THEME_OPTIONS: readonly { id: ThemePreference; label: string }[] = [
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
  { id: 'system', label: '跟随系统' },
]

/** Small external store used by the showcase to mirror DSH's theme runtime. */
export class ShowcaseThemeController {
  private snapshot: ThemeSnapshot
  private readonly listeners = new Set<() => void>()

  constructor(initial: ThemeSnapshot, private readonly update: (preference: ThemePreference) => void) {
    this.snapshot = initial
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  readonly getSnapshot = (): ThemeSnapshot => this.snapshot

  readonly setPreference = (preference: ThemePreference): void => {
    this.update(preference)
  }

  readonly sync = (snapshot: ThemeSnapshot): void => {
    if (snapshot === this.snapshot) return
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }

  dispose(): void {
    this.listeners.clear()
  }
}
