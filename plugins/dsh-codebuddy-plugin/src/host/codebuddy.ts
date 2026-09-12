/**
 * CodeBuddy 控制平面客户端：浏览器 OAuth 握手、token 刷新，以及非 OpenAI 的
 * 模型目录。
 *
 * 这里的每个调用都解析 `{code, msg, data}` 信封，而不是只看 HTTP 状态码，因此
 * 一个携带非零 `code` 的 200 也是失败，并且按失败上报。本模块只负责传输：不持
 * 有状态、不做策略决策，从而让登录流程、adapter 与 CLI 都能共用它。
 *
 * @module dsh-codebuddy/codebuddy
 */

import type { CodeBuddyIdentity } from '../types/host/codebuddy'
export type { CodeBuddyIdentity } from '../types/host/codebuddy'
import {
  AUTH_PENDING_CODE,
  CODEBUDDY_CLIENT_PLATFORMS,
  CODEBUDDY_CLIENT_VERSIONS,
  CODEBUDDY_DEFAULT_CLIENT,
  CODEBUDDY_IDE_VERSION,
  CODEBUDDY_PLUGIN_PREFIX,
  LOGIN_POLL_INTERVAL_MS,
  LOGIN_TIMEOUT_MS,
} from '../contracts/constants.ts'
import type { CodeBuddyClientId } from '../contracts/constants.ts'
import type { Account, AccountResponse, AuthState, AuthStateResponse, AuthToken, AuthTokenResponse, CodeBuddyConfig, CodeBuddyEnterpriseModel, CodeBuddyEnterpriseModelsResponse, ConfigResponse } from './types.ts'

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
 * 把客户端 `version` 查询参数盖到登录 URL 上。
 *
 * auth-state 服务返回的 `authUrl` 已带上 `platform` 与服务端签发的 `state`；
 * version 是客户端自己的产品版本，按官方客户端打开页面前的方式追加。
 *
 * 版本按客户端取自 {@link CODEBUDDY_CLIENT_VERSIONS}，都是固定发布版本：
 * 例如 WorkBuddy 是 5.5.6。不要写成随机值——服务端以此归因客户端版本。
 *
 * @param authUrl - 服务端提供的登录 URL。
 * @param client - 以哪个客户端身份登录。
 * @returns 已设置固定 `version` 参数的 URL。
 */
function withLoginVersion(authUrl: string, client: CodeBuddyClientId = CODEBUDDY_DEFAULT_CLIENT): string {
  const url = new URL(authUrl)
  url.searchParams.set('version', CODEBUDDY_CLIENT_VERSIONS[client])
  return url.toString()
}

/**
 * 发起浏览器登录握手。
 *
 * 服务端按 `platform` 区分客户端并据此生成登录页；实测同一个
 * `/plugin/auth/state` 端点对 `CLI` 与 `workbuddy` 都返回可用的 `state` 与
 * `authUrl`，返回的 URL 会带上调用时所用的 platform，因此两个客户端共用这一
 * 套握手，只是参数不同。
 *
 * @param endpoint - 所登录环境的服务根地址。
 * @param client - 以哪个客户端身份登录（`cli` / `workbuddy`）。
 * @param signal - 可选取消。
 * @returns 握手 state，以及用户必须打开的 URL（按客户端协议盖有客户端
 *   `version` 参数）。
 * @throws Error 服务端拒绝或返回不可用响应体时抛出。
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
 * 轮询直到用户在浏览器中完成登录。
 *
 * 服务端用 code {@link AUTH_PENDING_CODE} 表示「尚未完成」，这是唯一让循环
 * 继续的 code；其他任何值都是已确定的结局并终止循环。传输错误同样终止循环：
 * 一个 state 可能已被消费的握手绝不能静默重试。
 * @param state - 来自 {@link requestAuthState} 的握手 id。
 * @param signal - 可选取消。
 * @returns 签发的 token；登录失败或超时为 `undefined`。
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
 * 读取已登录账号，其 uid 与企业 id 会成为后续每个请求的必备请求头。
 * @param state - 签发这批 token 的握手 id。
 * @param accessToken - 新签发的 access token。
 * @param domain - 签发这批 token 的租户 domain。
 * @returns 账号事实。
 * @throws Error 服务端拒绝或返回不可用响应体时抛出。
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
 * 归一化账号，使空字符串字段读作「不存在」。
 *
 * CodeBuddy 的账号响应会为租户不披露的字段返回空字符串（而不是省略）——例如
 * 企业账号会带 `uin: ""`。整条下游链路（storage、auth 状态、设置 UI）都只把
 * `undefined` 当作「不存在」，空字符串会渲染出一行空内容。在这里统一裁剪一次，
 * 免得每个消费方各自重复检查。
 * @param account - 网络返回的原始账号。
 * @returns 空的可选字符串字段已被剔除的账号。
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
 * 用 refresh token 换取新的 access token。
 * @param identity - 当前身份，包含即将被替换的 access token。
 * @param refreshToken - 要消耗的 refresh token。
 * @returns 新 token；刷新被拒绝时为 `undefined`。
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
 * 读取 CodeBuddy 模型目录。
 *
 * 这是该服务非 OpenAI 兼容的那一半，也是本插件无法被通用 OpenAI 兼容路由
 * 取代的原因：响应披露了每个模型的能力标志与容量，`GET /models` 列表拿不到
 * 这些。
 * @param identity - 已登录身份。
 * @param signal - 可选取消。
 * @returns 模型目录。
 * @throws Error 服务端拒绝或返回不可用响应体时抛出。
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
 * 读取企业自定义模型目录。
 *
 * 企业自定义模型不属于个人 `/v3/config` 目录：官方客户端用账号的企业 id 从
 * 独立的控制台端点拉取它们，再智能合并进模型列表。企业账号能用的每个
 * `custom:*` 模型都源于此。
 *
 * 这属于浏览性质的读取，因此降级为空列表而不是抛错：个人账号（无企业 id）
 * 本来就没有自定义模型，而控制台的瞬时故障也不该弄垮整个目录。
 * @param identity - 已登录身份。
 * @param signal - 可选取消。
 * @returns 企业自定义模型；或空列表。
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
