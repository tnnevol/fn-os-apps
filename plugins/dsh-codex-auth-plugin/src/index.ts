/** Standalone ChatGPT OAuth plugin for DeepSeek Harness. */

import type { Context, Fiber } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import type {} from '@deepseek-ai/dsh-tools'
import { registerCodexAuthRoutes, registerCodexGlobalModelRoute, registerCodexModelRefreshRoute, registerCodexSettingsRoute } from './host/auth-routes.ts'
import { CodexCredentialMirror } from './host/credential-mirror.ts'
import { CodexCredentialStore, CODEX_AUTH_FILENAME, CODEX_PROVIDER, codexAuthPath } from './host/store.ts'
import { CODEX_AUTH_SETTINGS_NS, CodexAuthSettingsSchema } from './host/settings.ts'
import { viewImageTool } from './host/view-image.ts'

/** Stable Host bundle name. */
export const name = 'dsh-codex-auth-plugin'
/** Host services required by the routes, settings card, and credential mirror. */
export const inject = ['webServer', 'settings', 'credentials', 'agentDefaultModel', 'llm']

export function apply(ctx: Context): void {
  const settings = ctx.settings.register(CODEX_AUTH_SETTINGS_NS, CodexAuthSettingsSchema)
  const store = new CodexCredentialStore()
  const mirror = new CodexCredentialMirror(ctx.credentials, store)
  const syncMirror = (): void => {
    void mirror.sync().catch(error => {
      ctx.logger.warn('dsh-codex-auth: failed to synchronize the Codex credential with dsh', error)
    })
  }
  ctx.effect(() => {
    syncMirror()
    const timer = setInterval(syncMirror, 60_000)
    return () => { clearInterval(timer) }
  }, 'dsh-codex-auth: credential mirror')
  registerCodexAuthRoutes(ctx, store, mirror)
  registerCodexSettingsRoute(ctx, settings)
  registerCodexModelRefreshRoute(ctx, store, { update: (ns, patch) => ctx.settings.update(ns, patch) })
  registerCodexGlobalModelRoute(ctx, ctx.agentDefaultModel, ctx.llm)

  let stopped = false
  let imageFiber: Fiber | undefined
  let imageTail = Promise.resolve()

  const reconcileImageTool = async (): Promise<void> => {
    if (stopped) return
    const enabled = settings.get().enableImageTool
    if (enabled === (imageFiber !== undefined)) return

    const previous = imageFiber
    imageFiber = undefined
    if (previous !== undefined) await previous.dispose()
    if (stopped || !enabled) return

    const fiber = ctx.inject(
      ['tools', 'fs', 'attachments', 'llm'],
      toolCtx => toolCtx.tools.register(viewImageTool(toolCtx)),
    )
    imageFiber = fiber
    void Promise.resolve(fiber).catch((error: unknown) => {
      if (imageFiber === fiber) imageFiber = undefined
      ctx.logger.error('dsh-codex-auth: optional view_image tool failed to activate')
      ctx.logger.error(error)
    })
  }

  const scheduleImageTool = (): void => {
    imageTail = imageTail.then(reconcileImageTool, reconcileImageTool).catch((error: unknown) => {
      ctx.logger.error('dsh-codex-auth: could not apply the image-recognition configuration')
      ctx.logger.error(error)
    })
  }

  const unwatch = settings.watch(scheduleImageTool)
  ctx.effect(() => async () => {
    stopped = true
    unwatch()
    await imageTail
    const image = imageFiber
    imageFiber = undefined
    await image?.dispose()
  }, 'dsh-codex-auth: optional image-tool lifecycle')
  scheduleImageTool()
}

export {
  CODEX_AUTH_FILENAME,
  CODEX_PROVIDER,
  CodexCredentialStore,
  codexAuthPath,
} from './host/store.ts'
export { CODEX_API_KEY_ENV, CODEX_API_KEY_REF, CodexCredentialMirror } from './host/credential-mirror.ts'
export { createCodexAdapter, CODEX_STREAM_IDLE_TIMEOUT_MS } from './host/adapter.ts'
export { CodexUsageService, normalizeCodexUsagePayload } from './host/usage.ts'
export { codexAuthStatus, loginCodex, logoutCodex } from './host/auth.ts'
export type { CodexAuthStatus } from './host/auth.ts'
export {
  CODEX_AUTH_LOGIN_PATH,
  CODEX_AUTH_LOGOUT_PATH,
  CODEX_AUTH_STATUS_PATH,
  CODEX_AUTH_SETTINGS_NAMESPACE,
  CODEX_GLOBAL_MODEL_PATH,
} from './contracts/auth-paths.ts'
export { CodexWebAuth, registerCodexAuthRoutes, trustedRequest } from './host/auth-routes.ts'
export type { CodexLoginChallenge, CodexWebAuthStatus } from './host/auth-routes.ts'
