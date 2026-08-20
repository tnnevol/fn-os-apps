/** fnOS-specific integrations for DeepSeek Harness. */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { registerAuthorizedDirectoryRoutes } from './authorized-directories.ts'
import { FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NAMESPACE } from './authorized-directories-contract.ts'

/** Stable Host bundle name. */
export const name = '@tnnevol/dsh-fnos'

/** Settings are used to make the read-only fnOS card discoverable. */
export const FnosSettingsSchema = z.object({})
export const FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NS = settingsNamespace(
  FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NAMESPACE,
)

/** Host services required by the fnOS settings namespace and Web routes. */
export const inject = ['webServer', 'settings']

export function apply(ctx: Context): void {
  ctx.settings.register(FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NS, FnosSettingsSchema)
  registerAuthorizedDirectoryRoutes(ctx)
}

export {
  FNOS_AUTHORIZED_DIRECTORIES_DELETE_PATH,
  FNOS_AUTHORIZED_ENTRIES_PATH,
  FNOS_AUTHORIZED_DIRECTORIES_PATH,
  FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NAMESPACE,
  FNOS_PATH_CONVERSION_PATH,
  FNOS_PATH_OPEN_VALIDATION_PATH,
} from './authorized-directories-contract.ts'
export {
  accessiblePathsFromEnvironment,
  convertPathsForDisplay,
  dataSharePathsFromEnvironment,
  FNOS_ACCESSIBLE_PATHS_ENV,
  FNOS_DATA_SHARE_PATHS_ENV,
  mergeAuthorizedPaths,
  markAuthorizedPathRemoved,
  normalizeAuthorizedPath,
  normalizeAuthorizedPaths,
  normalizePathForAuthorization,
  isPathWithinAuthorizedDirectory,
  isAuthorizedPathForOpen,
  loadAuthorizedEntries,
  splitPathEnvironment,
} from './authorized-directories.ts'
