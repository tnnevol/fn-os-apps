/**
 * CodeBuddy control-plane client: the browser-OAuth handshake, token refresh,
 * and the non-OpenAI model catalog.
 *
 * Every call here speaks the `{code, msg, data}` envelope rather than HTTP
 * status alone, so a 200 carrying a non-zero `code` is a failure and is
 * reported as one. This module is transport-only: it holds no state and makes
 * no policy decisions, which keeps the login flow, the adapter, and the CLI
 * able to share it.
 *
 * @module dsh-codebuddy/codebuddy
 */

import {
  AUTH_PENDING_CODE,
  CODEBUDDY_CLIENT_PLATFORMS,
  CODEBUDDY_CLIENT_VERSIONS,
  CODEBUDDY_DEFAULT_CLIENT,
  CODEBUDDY_IDE_VERSION,
  CODEBUDDY_PLUGIN_PREFIX,
  LOGIN_POLL_INTERVAL_MS,
  LOGIN_TIMEOUT_MS,
} from './constants.ts'
import type { CodeBuddyClientId } from './constants.ts'
import type {
  Account,
  AccountResponse,
  AuthState,
  AuthStateResponse,
  AuthToken,
  AuthTokenResponse,
  CodeBuddyConfig,
  CodeBuddyEnterpriseModel,
  CodeBuddyEnterpriseModelsResponse,
  ConfigResponse,
} from './types.ts'

/** The identity facts CodeBuddy requires on every authenticated request. */
export interface CodeBuddyIdentity {
  accessToken: string
  domain: string
  uid: string
  enterpriseId?: string
  departmentFullName?: string
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('aborted'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new Error('aborted'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Stamp the client `version` query parameter onto a login URL.
 *
 * The auth-state service returns `authUrl` already carrying `platform` and
 * the server-issued `state`; the version is the client's own product version,
 * appended the same way the official client does before opening the page.
 *
 * 版本按客户端取自 {@link CODEBUDDY_CLIENT_VERSIONS}，都是固定发布版本：
 * 例如 WorkBuddy 是 5.5.4。不要写成随机值——服务端以此归因客户端版本。
 *
 * @param authUrl - the server-provided login URL.
 * @param client - which client identity is signing in.
 * @returns the URL with the fixed `version` parameter set.
 */
function withLoginVersion(authUrl: string, client: CodeBuddyClientId = CODEBUDDY_DEFAULT_CLIENT): string {
  const url = new URL(authUrl)
  url.searchParams.set('version', CODEBUDDY_CLIENT_VERSIONS[client])
  return url.toString()
}

/**
 * Start a browser-login handshake.
 *
 * 服务端按 `platform` 区分客户端并据此生成登录页；实测同一个
 * `/plugin/auth/state` 端点对 `CLI` 与 `workbuddy` 都返回可用的 `state` 与
 * `authUrl`，返回的 URL 会带上调用时所用的 platform，因此两个客户端共用这一
 * 套握手，只是参数不同。
 *
 * @param endpoint - the service root of the environment being signed in to.
 * @param client - which client identity is signing in (`cli` / `workbuddy`).
 * @param signal - optional cancellation.
 * @returns the handshake state and the URL the user must open (with the
 *   client `version` parameter stamped, per the client protocol).
 * @throws Error when the service refuses or answers an unusable body.
 */
export async function requestAuthState(
  endpoint: string,
  client: CodeBuddyClientId = CODEBUDDY_DEFAULT_CLIENT,
  signal?: AbortSignal,
): Promise<AuthState> {
  const platform = CODEBUDDY_CLIENT_PLATFORMS[client]
  const response = await fetch(`${endpoint}/v2${CODEBUDDY_PLUGIN_PREFIX}/auth/state?platform=${encodeURIComponent(platform)}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'X-No-Authorization': 'true',
      'X-No-User-Id': 'true',
      'X-No-Enterprise-Id': 'true',
    },
    ...signal === undefined ? {} : { signal },
  })
  if (!response.ok) {
    throw new Error(`CodeBuddy auth state request failed (HTTP ${response.status})`)
  }
  const body = await response.json() as AuthStateResponse
  if (body.code !== 0 || body.data === undefined) {
    throw new Error(`CodeBuddy auth state request failed: ${body.code} - ${body.msg}`)
  }
  return { ...body.data, authUrl: withLoginVersion(body.data.authUrl, client) }
}

/**
 * Poll until the user finishes signing in in the browser.
 *
 * The service reports "not finished yet" as code {@link AUTH_PENDING_CODE},
 * which is the one code that continues the loop; anything else is a decided
 * outcome and ends it. A transport error also ends it, because a handshake
 * whose state may already be spent must not be retried silently.
 * @param state - the handshake id from {@link requestAuthState}.
 * @param signal - optional cancellation.
 * @returns the issued tokens, or `undefined` when the login failed or timed out.
 */
export async function pollAuthToken(endpoint: string, state: string, signal?: AbortSignal): Promise<AuthToken | undefined> {
  const deadline = Date.now() + LOGIN_TIMEOUT_MS
  while (Date.now() < deadline) {
    await delay(LOGIN_POLL_INTERVAL_MS, signal)
    let response: Response
    try {
      response = await fetch(`${endpoint}/v2${CODEBUDDY_PLUGIN_PREFIX}/auth/token?state=${encodeURIComponent(state)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-No-Authorization': 'true',
        },
        ...signal === undefined ? {} : { signal },
      })
    } catch {
      return undefined
    }
    if (!response.ok) continue
    const body = await response.json() as AuthTokenResponse
    if (body.code === AUTH_PENDING_CODE) continue
    if (body.code !== 0) return undefined
    return normalizeAuthToken(body.data)
  }
  return undefined
}

/**
 * 归一化 token 载荷。
 *
 * 服务端在不同客户端/网关下可能用 camelCase 或 snake_case 返回同一组字段。参考实现
 * （workbuddy-switch 的 oauth 解析）对每个字段都**同时容忍**两种写法，这里照做：
 * 只认一种写法的话，另一种会解析成 `undefined`，进而发出 `Authorization: Bearer
 * undefined` 并收到 401——而且由于失败发生在登录流程内、错误又被静默吞掉，表现
 * 就是「登录完了但账号不出现」，很难定位。
 *
 * `domain` 缺失时回退到 `''`：`getLoginAccount` 会把它放进 `X-Domain`，值为
 * undefined 会变成字符串 "undefined" 发给服务端。
 */
export function normalizeAuthToken(raw: unknown): AuthToken | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const source = raw as Record<string, unknown>
  const str = (key: string, snake: string): string | undefined => {
    const value = source[key] ?? source[snake]
    return typeof value === 'string' && value.length > 0 ? value : undefined
  }
  const num = (key: string, snake: string): number | undefined => {
    const value = source[key] ?? source[snake]
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
  }
  const accessToken = str('accessToken', 'access_token')
  // 没有 accessToken 就没有可用的凭据：返回 undefined 让调用方按失败处理，
  // 而不是带着一个残缺对象继续走（那会在下一步发出 `Bearer undefined`）。
  if (accessToken === undefined) return undefined
  const refreshToken = str('refreshToken', 'refresh_token')
  const expiresIn = num('expiresIn', 'expires_in')
  const refreshExpiresIn = num('refreshExpiresIn', 'refresh_expires_in')
  return {
    accessToken,
    ...refreshToken === undefined ? {} : { refreshToken },
    ...expiresIn === undefined ? {} : { expiresIn },
    ...refreshExpiresIn === undefined ? {} : { refreshExpiresIn },
    domain: str('domain', 'domain') ?? '',
  }
}

/**
 * Read the signed-in account, whose uid and enterprise id become required
 * headers on every later request.
 * @param state - the handshake id the tokens were issued for.
 * @param accessToken - the freshly issued access token.
 * @param domain - the tenant domain the tokens were issued for.
 * @returns the account facts.
 * @throws Error when the service refuses or answers an unusable body.
 */
export async function getLoginAccount(
  endpoint: string,
  state: string,
  accessToken: string,
  domain: string,
): Promise<Account> {
  const response = await fetch(
    `${endpoint}/v2${CODEBUDDY_PLUGIN_PREFIX}/login/account?state=${encodeURIComponent(state)}`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-No-User-Id': 'true',
        'X-No-Enterprise-Id': 'true',
        'X-Domain': domain,
      },
    },
  )
  if (!response.ok) {
    throw new Error(`CodeBuddy login account request failed (HTTP ${response.status})`)
  }
  const body = await response.json() as AccountResponse
  if (body.code !== 0 || body.data === undefined) {
    throw new Error(`CodeBuddy login account request failed: ${body.code} - ${body.msg}`)
  }
  return normalizeAccount(body.data)
}

/**
 * Normalize an account so an empty-string field reads as absent.
 *
 * CodeBuddy's account reply emits empty strings (not omissions) for fields a
 * tenant does not disclose — e.g. an enterprise account carries `uin: ""`. The
 * whole downstream (storage, auth status, the settings UI) treats only
 * `undefined` as "not present", so an empty string would render an empty row.
 * Trimming once here covers every consumer without each re-checking.
 * @param account - the raw account from the wire.
 * @returns the account with empty optional string fields dropped.
 */
function normalizeAccount(account: Account): Account {
  const pick = (value: string | undefined): string | undefined =>
    value === undefined || value.length === 0 ? undefined : value
  return {
    uid: account.uid,
    nickname: account.nickname,
    ...pick(account.uin) === undefined ? {} : { uin: account.uin },
    ...pick(account.enterpriseId) === undefined ? {} : { enterpriseId: account.enterpriseId },
    ...pick(account.enterpriseName) === undefined ? {} : { enterpriseName: account.enterpriseName },
    ...pick(account.enterpriseUserName) === undefined ? {} : { enterpriseUserName: account.enterpriseUserName },
    ...pick(account.departmentFullName) === undefined ? {} : { departmentFullName: account.departmentFullName },
  }
}

/**
 * Exchange a refresh token for a new access token.
 * @param identity - the current identity, including the access token being replaced.
 * @param refreshToken - the refresh token to spend.
 * @returns the new tokens, or `undefined` when the refresh was refused.
 */
export async function refreshAccessToken(
  endpoint: string,
  identity: CodeBuddyIdentity,
  refreshToken: string,
): Promise<AuthToken | undefined> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${identity.accessToken}`,
    'X-Domain': identity.domain,
    'X-User-Id': identity.uid,
    'X-Refresh-Token': refreshToken,
  }
  if (identity.enterpriseId !== undefined) headers['X-Enterprise-Id'] = identity.enterpriseId
  let response: Response
  try {
    response = await fetch(`${endpoint}/v2${CODEBUDDY_PLUGIN_PREFIX}/auth/token/refresh`, {
      method: 'POST',
      headers,
    })
  } catch {
    return undefined
  }
  if (!response.ok) return undefined
  const body = await response.json() as AuthTokenResponse
  if (body.code !== 0 || body.data === undefined) return undefined
  return body.data
}

/**
 * Read the CodeBuddy model catalog.
 *
 * This is the non-OpenAI-compatible half of the service and the reason this
 * plugin cannot be replaced by a generic OpenAI-compatible route: the reply
 * discloses per-model capability flags and sizes that a `GET /models` listing
 * does not.
 * @param identity - the signed-in identity.
 * @param signal - optional cancellation.
 * @returns the catalog.
 * @throws Error when the service refuses or answers an unusable body.
 */
export async function getConfig(
  endpoint: string,
  identity: CodeBuddyIdentity,
  signal?: AbortSignal,
): Promise<CodeBuddyConfig> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': `CodeBuddyIDE/${CODEBUDDY_IDE_VERSION} CodeBuddy/${CODEBUDDY_IDE_VERSION}`,
    'Authorization': `Bearer ${identity.accessToken}`,
    'X-Domain': identity.domain,
    'X-User-Id': identity.uid,
  }
  if (identity.enterpriseId !== undefined) headers['X-Enterprise-Id'] = identity.enterpriseId
  if (identity.departmentFullName !== undefined) {
    headers['X-Department-Info'] = identity.departmentFullName
  }
  const response = await fetch(`${endpoint}/v3/config`, {
    method: 'GET',
    headers,
    ...signal === undefined ? {} : { signal },
  })
  if (!response.ok) {
    throw new Error(`CodeBuddy config request failed (HTTP ${response.status})`)
  }
  const body = await response.json() as ConfigResponse
  if (body.code !== 0 || body.data === undefined) {
    throw new Error(`CodeBuddy config request failed: ${body.code} - ${body.msg}`)
  }
  return body.data
}

/**
 * Read the enterprise custom models catalog.
 *
 * Enterprise custom models are not part of the personal `/v3/config` catalog:
 * the official client fetches them from a separate console endpoint keyed by
 * the account's enterprise id, then smart-merges them into the model list.
 * That is the source of every `custom:*` model an enterprise account may use.
 *
 * This is a browsing-adjacent read, so it degrades to an empty list rather
 * than throwing: a personal account (no enterprise id) simply has no custom
 * models, and a transient console failure must not break the whole catalog.
 * @param identity - the signed-in identity.
 * @param signal - optional cancellation.
 * @returns the enterprise custom models, or an empty list.
 */
export async function getEnterpriseModels(
  endpoint: string,
  identity: CodeBuddyIdentity,
  signal?: AbortSignal,
): Promise<readonly CodeBuddyEnterpriseModel[]> {
  const enterpriseId = identity.enterpriseId
  if (enterpriseId === undefined || enterpriseId.length === 0) return []

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': `CodeBuddyIDE/${CODEBUDDY_IDE_VERSION} CodeBuddy/${CODEBUDDY_IDE_VERSION}`,
    'Authorization': `Bearer ${identity.accessToken}`,
    'X-Domain': identity.domain,
    'X-User-Id': identity.uid,
    'X-Enterprise-Id': enterpriseId,
  }
  if (identity.departmentFullName !== undefined) {
    headers['X-Department-Info'] = identity.departmentFullName
  }

  let response: Response
  try {
    response = await fetch(
      `${endpoint}/console/enterprises/${encodeURIComponent(enterpriseId)}/config/models`,
      {
        method: 'GET',
        headers,
        ...signal === undefined ? {} : { signal },
      },
    )
  } catch {
    return []
  }
  if (!response.ok) return []
  const body = await response.json() as CodeBuddyEnterpriseModelsResponse
  if (body.code !== 0 || body.data === undefined) return []
  return body.data
}
