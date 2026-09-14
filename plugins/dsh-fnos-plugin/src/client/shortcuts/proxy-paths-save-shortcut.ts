/** Recognize the Ctrl/⌘+S save gesture for the gateway proxy textarea. */

/**
 * Whether a key event is the save shortcut.
 *
 * `S` is matched case-insensitively because Shift or Caps Lock changes `key`
 * without changing the user's intent. Alt is excluded so AltGr/Alt combos on
 * layouts that produce printable characters on Ctrl/⌘+Alt do not save.
 * @param event - the key event fields that decide the gesture.
 * @returns true only for the save shortcut.
 */
export function isProxyPathsSaveShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>,
): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return false
  return event.key.toLowerCase() === 's'
}
