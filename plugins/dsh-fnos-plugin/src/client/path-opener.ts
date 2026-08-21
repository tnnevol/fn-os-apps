/** Route DSH's existing path-open action through the fnOS iframe bridge. */

import { isEmbeddedFnosFrame } from './sdk-carrier.ts'

export interface PathOpenerWorkspaces {
  openPath(path: string): Promise<void>
}

export interface PathOpenerSdk {
  readonly isWeb: boolean
  readonly isStandaloneWeb: boolean
  ready(): Promise<unknown>
  openFile(path: string): Promise<unknown>
}

export type PathOpenerMessageKey = 'pathOpenUnavailable'

export interface PathOpenerOptions {
  createSdk: () => PathOpenerSdk
  message?: (key: PathOpenerMessageKey) => string
}

const defaultMessages: Record<PathOpenerMessageKey, string> = {
  pathOpenUnavailable: 'Unable to open this path through fnOS.',
}

/**
 * Decorate the public DSH workspaces service and return a lifecycle disposer.
 * Standalone browser sessions retain DSH's original native opener for local
 * development; fnOS iframe sessions use the app bridge instead of xdg-open.
 */
export function installFnosPathOpener(
  workspaces: PathOpenerWorkspaces,
  options: PathOpenerOptions,
): () => void {
  const originalOpenPath = workspaces.openPath
  const createSdk = options.createSdk
  const message = (key: PathOpenerMessageKey): string => options.message?.(key) ?? defaultMessages[key]
  let sdkPromise: Promise<PathOpenerSdk> | undefined

  const getSdk = (): Promise<PathOpenerSdk> => sdkPromise ??= (async () => {
    const sdk = createSdk()
    await sdk.ready()
    return sdk
  })()

  const wrappedOpenPath = async (path: string): Promise<void> => {
    let sdk: PathOpenerSdk
    try {
      sdk = await getSdk()
    } catch (error: unknown) {
      throw new Error(message('pathOpenUnavailable'), { cause: error })
    }

    const embeddedFnosFrame = isEmbeddedFnosFrame()
    if ((!sdk.isWeb || sdk.isStandaloneWeb) && !embeddedFnosFrame) {
      await originalOpenPath.call(workspaces, path)
      return
    }

    try {
      // Never fall back to DSH's native opener inside fnOS. That opener runs
      // xdg-open in the NAS service container, where the command is absent.
      if (!sdk.isWeb) throw new Error('fnOS iframe SDK did not initialize its web carrier')
      // The SDK is the authority for opening a path. Do not preflight against
      // the plugin's displayed authorization roots: the list is intended for
      // browsing and selecting paths, but it can lag behind fnOS ACL state or
      // use a different path representation. A preflight here caused valid
      // NAS paths to be rejected before fnOS could make the real decision.
      await sdk.openFile(path)
    } catch (error: unknown) {
      throw new Error(message('pathOpenUnavailable'), { cause: error })
    }
  }

  workspaces.openPath = wrappedOpenPath
  return () => {
    if (workspaces.openPath === wrappedOpenPath) workspaces.openPath = originalOpenPath
  }
}
