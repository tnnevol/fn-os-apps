export function isSettingsShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>): boolean {
  return (event.ctrlKey || event.metaKey) && event.key === ','
}
