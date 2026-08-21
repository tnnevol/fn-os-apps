/** Route DSH's existing path-open action through the fnOS iframe bridge. */

import { DirectoryRequestError, requestPathOpenAuthorization } from './authorized-directories-client.ts'

export interface PathOpenerWorkspaces {
  openPath(path: string): Promise<void>
}

export interface PathOpenerSdk {
  readonly isWeb: boolean
  readonly isStandaloneWeb: boolean
  ready(): Promise<unknown>
  openFile(path: string): Promise<unknown>
}

export type PathOpenerMessageKey = 'pathNotAuthorized' | 'pathPermissionDenied' | 'pathOpenUnavailable'

export interface PathOpenerOptions {
  createSdk: () => PathOpenerSdk
  validatePath?: (path: string) => Promise<void>
  message?: (key: PathOpenerMessageKey) => string
}

const defaultMessages: Record<PathOpenerMessageKey, string> = {
  pathNotAuthorized: 'This path is not authorized for DSH.',
  pathPermissionDenied: 'The current fnOS user cannot read this path.',
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
  const validatePath = options.validatePath ?? requestPathOpenAuthorization
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

    if (!sdk.isWeb || sdk.isStandaloneWeb) {
      await originalOpenPath.call(workspaces, path)
      return
    }

    try {
      await validatePath(path)
      await sdk.openFile(path)
    } catch (error: unknown) {
      if (error instanceof DirectoryRequestError && error.code === 'fnos-path-not-authorized') {
        throw new Error(message('pathNotAuthorized'), { cause: error })
      }
      if (error instanceof DirectoryRequestError && error.code === 'fnos-user-permission-denied') {
        throw new Error(message('pathPermissionDenied'), { cause: error })
      }
      if (error instanceof DirectoryRequestError) {
        throw new Error(message('pathOpenUnavailable'), { cause: error })
      }
      throw error
    }
  }

  workspaces.openPath = wrappedOpenPath
  return () => {
    if (workspaces.openPath === wrappedOpenPath) workspaces.openPath = originalOpenPath
  }
}
