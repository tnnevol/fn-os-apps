/** Copy text in secure and non-secure browser contexts. */

interface CopyEnvironment {
  navigator?: {
    clipboard?: {
      writeText?: (text: string) => Promise<void>
    }
  }
  document?: {
    createElement: (tagName: 'textarea') => HTMLTextAreaElement
    body: HTMLElement
    execCommand: (command: 'copy') => boolean
  }
}

export async function copyTextToClipboard(text: string, environment: CopyEnvironment = {}): Promise<void> {
  const navigatorRef = environment.navigator ?? globalThis.navigator
  const documentRef = environment.document ?? globalThis.document

  try {
    if (typeof navigatorRef?.clipboard?.writeText === 'function') {
      await navigatorRef.clipboard.writeText(text)
      return
    }
  } catch {
    // The Clipboard API is unavailable or rejected on some HTTP origins.
    // Continue with the legacy selection-based fallback below.
  }

  if (documentRef === undefined) throw new Error('Clipboard is unavailable')

  const textarea = documentRef.createElement('textarea') as HTMLTextAreaElement
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  documentRef.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    if (!documentRef.execCommand('copy')) throw new Error('Copy command was rejected')
  } finally {
    documentRef.body.removeChild(textarea)
  }
}
