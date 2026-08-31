export function isBrowserRefreshShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>): boolean {
  if (event.key === 'F5') return true
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r'
}
