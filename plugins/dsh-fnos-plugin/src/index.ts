/** fnOS-specific integrations for DeepSeek Harness. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { registerAuthorizedDirectoryRoutes } from './authorized-directories.ts'
import { FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NAMESPACE } from './authorized-directories-contract.ts'
import { injectCachedFnosTheme, type DshThemePreference } from './theme-bootstrap.ts'
import { FNOS_GATEWAY_PROXY_PATHS_FIELD, FNOS_SYSTEM_THEME_FIELD, isFnosTheme, type FnosSettings, type FnosTheme } from './theme-contract.ts'
import { registerGatewayProxyRoutes } from './gateway-proxy-routes.ts'

/** Stable Host bundle name. */
export const name = '@tnnevol/dsh-fnos'

/** Settings back the fnOS card and the cached pre-plugin theme bootstrap. */
export const FnosSettingsSchema = z.object({
  [FNOS_SYSTEM_THEME_FIELD]: z.union(['light', 'dark']),
  [FNOS_GATEWAY_PROXY_PATHS_FIELD]: z.array(z.string()),
})
export const FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NS = settingsNamespace(
  FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NAMESPACE,
)
const DSH_THEME_SETTINGS_NS = settingsNamespace('ui-theme')

/** Host services required by the fnOS settings namespace and Web routes. */
export const inject = ['webServer', 'settings', 'apiProxy']

export function apply(ctx: Context): void {
  const settings = ctx.settings.register(FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NS, FnosSettingsSchema)
  registerAuthorizedDirectoryRoutes(ctx)
  registerGatewayProxyRoutes(ctx, settings)
  ctx.inject(['webServer'], httpCtx => {
    httpCtx.effect(
      () => httpCtx.webServer.tapIndex(html => injectCachedFnosTheme(
        html,
        readDshThemePreference(ctx),
        readCachedFnosTheme(ctx),
      )),
      'dsh-fnos: cached fnOS theme bootstrap',
    )
  })
}

function readDshThemePreference(ctx: Context): DshThemePreference {
  const section = ctx.settings.get(DSH_THEME_SETTINGS_NS) as { preference?: unknown } | undefined
  return section?.preference === 'light' || section?.preference === 'dark' || section?.preference === 'system'
    ? section.preference
    : 'system'
}

function readCachedFnosTheme(ctx: Context): FnosTheme | null {
  const section = ctx.settings.get(FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NS) as FnosSettings | undefined
  return isFnosTheme(section?.[FNOS_SYSTEM_THEME_FIELD]) ? section[FNOS_SYSTEM_THEME_FIELD] : null
}

export {
  FNOS_AUTHORIZED_DIRECTORIES_DELETE_PATH,
  FNOS_AUTHORIZED_ENTRIES_PATH,
  FNOS_AUTHORIZED_DIRECTORIES_PATH,
  FNOS_AUTHORIZED_DIRECTORIES_SETTINGS_NAMESPACE,
  FNOS_PATH_CONVERSION_PATH,
  FNOS_PATH_OPEN_VALIDATION_PATH,
} from './authorized-directories-contract.ts'
export { FNOS_SETTINGS_DOCUMENT_PATH } from './settings-document-contract.ts'
export { FNOS_GATEWAY_PROXY_PATHS_ROUTE, normalizeGatewayProxyPaths } from './gateway-proxy-contract.ts'
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
  validatePathForOpen,
  gatewayUserId,
  loadAuthorizedEntries,
  splitPathEnvironment,
} from './authorized-directories.ts'
