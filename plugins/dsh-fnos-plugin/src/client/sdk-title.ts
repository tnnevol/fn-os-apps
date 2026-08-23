/** Mirror DSH's browser title into the fnOS host page title. */

export const FNOS_PAGE_TITLE = 'DeepSeek Harness'

export interface FnosPageTitleSdk {
  readonly isWeb: boolean
  readonly isStandaloneWeb: boolean
  ready(): Promise<void>
  setTitle(title: string): Promise<void>
}

interface TitleDocument {
  title: string
}

/** Keep the fnOS host title synchronized with DSH's dynamic document title. */
export function installFnosPageTitle(
  createSdk: () => FnosPageTitleSdk,
  titleDocument: TitleDocument | undefined = typeof document === 'undefined' ? undefined : document,
): () => void {
  const sdk = createSdk()
  if (!sdk.isWeb || sdk.isStandaloneWeb || titleDocument === undefined) return () => undefined

  let active = true
  let lastTitle: string | undefined
  let observer: MutationObserver | undefined

  const syncTitle = (): void => {
    if (!active) return
    const title = titleDocument.title.trim() || FNOS_PAGE_TITLE
    if (title === lastTitle) return
    lastTitle = title
    void sdk.setTitle(title).catch(error => {
      console.debug('[dsh-fnos] unable to update fnOS page title', error)
    })
  }

  void sdk.ready().then(() => {
    if (!active) return
    syncTitle()
    if (typeof MutationObserver === 'undefined') return
    observer = new MutationObserver(syncTitle)
    const titleElement = document.querySelector('title')
    if (titleElement !== null) observer.observe(titleElement, {
      characterData: true,
      childList: true,
      subtree: true,
    })
  }).catch(error => {
    console.debug('[dsh-fnos] unable to initialize fnOS page title bridge', error)
  })

  return () => {
    active = false
    observer?.disconnect()
    observer = undefined
  }
}
